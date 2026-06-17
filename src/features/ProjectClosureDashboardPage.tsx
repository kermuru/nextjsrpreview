'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getClosureSummary, getAutoClosedProjects, getManualClosedProjects,
  getCommencedProjects, getClosureLogs, getRunSummary, getClosureFilters,
  triggerAutoClose, getPendingChecker, getClosureReport, processClosureDR,
} from '@/services/project-closure';
import type {
  AutoClosedProject, ManualClosedProject, CommencedProject,
  ClosureLog, RunSummary, FilterOptions, TriggerResult, PagedResponse,
  PendingCheckerItem, ClosureReport,
} from '@/services/project-closure';

type Tab = 'pending_checker' | 'commenced' | 'auto_closed' | 'manual_closed' | 'logs' | 'run_history';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7', grayBg: '#f3f4f6',
};

function fmt(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtAmt(v: number | null) {
  if (v == null) return '—';
  return '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

const TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted,
  background: C.bg, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};
const TD = (extra?: React.CSSProperties): React.CSSProperties => ({ padding: '10px 12px', fontSize: 13, color: C.text, ...extra });

function PaginationBar({ page, lastPage, total, perPage, onPrev, onNext }: {
  page: number; lastPage: number; total: number; perPage: number;
  onPrev: () => void; onNext: () => void;
}) {
  if (lastPage <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.bg, borderTop: `1px solid ${C.border}`, fontFamily: 'Nunito, sans-serif' }}>
      <span style={{ fontSize: 12, color: C.muted }}>
        Showing <strong style={{ color: C.text }}>{from}–{to}</strong> of <strong style={{ color: C.text }}>{total}</strong>
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onPrev} disabled={page === 1}
          style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: page === 1 ? C.bg : C.active, color: page === 1 ? C.muted : '#fff', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>‹ Prev</button>
        <span style={{ padding: '4px 8px', fontSize: 12, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>{page} / {lastPage}</span>
        <button onClick={onNext} disabled={page === lastPage}
          style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: page === lastPage ? C.bg : C.active, color: page === lastPage ? C.muted : '#fff', cursor: page === lastPage ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>Next ›</button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, bg }: { label: string; value: number | string; color: string; bg: string }) {
  return (
    <div style={{ flex: '1 1 130px', background: bg, borderRadius: 12, padding: '16px 18px', fontFamily: 'Nunito, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

function ResultPill({ result }: { result: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    closed:  { bg: C.greenBg, color: C.green, label: '✅ Closed' },
    blocked: { bg: C.redBg,   color: C.red,   label: '❌ Blocked' },
    skipped: { bg: C.amberBg, color: C.amber, label: '⏭ Skipped' },
    error:   { bg: '#fce7f3', color: '#be185d', label: '⚠ Error' },
  };
  const s = map[result] ?? { bg: C.grayBg, color: C.muted, label: result };
  return <span style={{ padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
}

export default function ProjectClosureDashboardPage() {
  const [tab, setTab]         = useState<Tab>('pending_checker');
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [orgFilter, setOrgFilter]   = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);

  const [summary, setSummary]         = useState<any>(null);
  const [commenced, setCommenced]     = useState<CommencedProject[]>([]);
  const [commencedPage, setCommencedPage]   = useState(1);
  const [commencedTotal, setCommencedTotal] = useState(0);
  const [commencedLastPage, setCommencedLastPage] = useState(1);
  const [autoClosed, setAutoClosed]   = useState<AutoClosedProject[]>([]);
  const [autoPage, setAutoPage]       = useState(1);
  const [autoTotal, setAutoTotal]     = useState(0);
  const [autoLastPage, setAutoLastPage] = useState(1);

  const [manualClosed, setManualClosed] = useState<ManualClosedProject[]>([]);
  const [manualPage, setManualPage]     = useState(1);
  const [manualTotal, setManualTotal]   = useState(0);
  const [manualLastPage, setManualLastPage] = useState(1);
  const [logs, setLogs]               = useState<ClosureLog[]>([]);
  const [logsPage, setLogsPage]       = useState(1);
  const [logsTotal, setLogsTotal]     = useState(0);
  const [logsLastPage, setLogsLastPage] = useState(1);
  const [runHistory, setRunHistory]   = useState<RunSummary[]>([]);
  const [pending, setPending]         = useState<PendingCheckerItem[]>([]);
  const [reportModal, setReportModal] = useState<{ item: PendingCheckerItem; report: ClosureReport } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [processing, setProcessing]   = useState<number | null>(null);
  const [triggering, setTriggering]   = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);
  const [triggerDate, setTriggerDate] = useState(new Date().toISOString().slice(0, 10));

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (orgFilter) p.ad_org_id = orgFilter;
    if (typeFilter) p.project_type = typeFilter;
    return p;
  }, [orgFilter, typeFilter]);

  useEffect(() => { getClosureFilters().then(setFilters).catch(() => null); }, []);
  useEffect(() => { getClosureSummary(params).then(setSummary).catch(() => null); }, [params]);
  useEffect(() => { getPendingChecker().then(setPending).catch(() => null); }, [tab]);

  useEffect(() => {
    if (tab === 'commenced') {
      setLoading(true);
      getCommencedProjects({ ...params, page: String(commencedPage), per_page: '15' })
        .then(r => { setCommenced(r.data); setCommencedTotal(r.total); setCommencedLastPage(r.last_page); })
        .finally(() => setLoading(false));
    }
    if (tab === 'auto_closed') {
      setLoading(true);
      getAutoClosedProjects({ ...params, page: String(autoPage), per_page: '20' })
        .then(r => { setAutoClosed(r.data); setAutoTotal(r.total); setAutoLastPage(r.last_page); })
        .finally(() => setLoading(false));
    }
    if (tab === 'manual_closed') {
      setLoading(true);
      getManualClosedProjects({ ...params, page: String(manualPage), per_page: '20' })
        .then(r => { setManualClosed(r.data); setManualTotal(r.total); setManualLastPage(r.last_page); })
        .finally(() => setLoading(false));
    }
    if (tab === 'logs') {
      setLoading(true);
      getClosureLogs({ ...params, page: String(logsPage), per_page: '50' })
        .then(r => { setLogs(r.data ?? []); setLogsTotal(r.total ?? 0); setLogsLastPage(r.last_page ?? 1); })
        .finally(() => setLoading(false));
    }
    if (tab === 'run_history') {
      setLoading(true);
      getRunSummary().then(setRunHistory).finally(() => setLoading(false));
    }
  }, [tab, params, commencedPage, autoPage, manualPage, logsPage]);

  const filteredCommenced = useMemo(() => {
    if (!search) return commenced;
    const q = search.toLowerCase();
    return commenced.filter(p => p.project_name?.toLowerCase().includes(q) || p.category_name?.toLowerCase().includes(q));
  }, [commenced, search]);

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'pending_checker', label: '⏳ Pending Checker', badge: pending.length },
    { key: 'commenced',       label: 'Commenced Projects' },
    { key: 'auto_closed',     label: 'Auto Closed' },
    { key: 'manual_closed',   label: 'Manual Closed' },
    { key: 'logs',            label: 'Process Logs' },
    { key: 'run_history',     label: 'Run History' },
  ];


  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">

          <Link href="/supplierio" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.primary, color: 'white', padding: '7px 14px', borderRadius: 6, textDecoration: 'none', width: 'fit-content', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
            ← Menu
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingBottom: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, fontFamily: 'Nunito, sans-serif' }}>Project Auto Closure Dashboard</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>Monitor auto closure status — blocked projects, manual closures, and process run history</p>
            </div>

            {/* Manual trigger — auto closure does NOT run on schedule */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input type="date" value={triggerDate} onChange={e => setTriggerDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: 'none', background: C.bg, fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }} />
              <button
                disabled={triggering}
                onClick={async () => {
                  if (!confirm('Run auto closure now? This will draft and process all eligible COMMENCED projects.')) return;
                  setTriggering(true);
                  setTriggerResult(null);
                  try {
                    const r = await triggerAutoClose(triggerDate);
                    setTriggerResult(r);
                    // Reload summary + run history
                    getClosureSummary(params).then(setSummary).catch(() => null);
                    if (tab === 'run_history') getRunSummary().then(setRunHistory).catch(() => null);
                    if (tab === 'logs') getClosureLogs(params).then(r2 => setLogs(r2.data ?? [])).catch(() => null);
                  } catch (e: unknown) {
                    alert('Trigger failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
                  } finally {
                    setTriggering(false);
                  }
                }}
                style={{ padding: '7px 18px', borderRadius: 6, border: 'none', cursor: triggering ? 'not-allowed' : 'pointer', background: triggering ? C.muted : C.active, color: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 800, opacity: triggering ? 0.7 : 1 }}>
                {triggering ? 'Running…' : '▶ Run Auto Closure'}
              </button>
            </div>
          </div>

          {/* Trigger result banner */}
          {triggerResult && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: C.greenBg, fontFamily: 'Nunito, sans-serif', fontSize: 13 }}>
              <strong style={{ color: C.green }}>✅ Auto closure completed — Run ID: {triggerResult.run_id.slice(0, 8)}…</strong>
              <span style={{ marginLeft: 16, color: C.text }}>
                Checked: <strong>{triggerResult.total_checked}</strong> · Closed: <strong style={{ color: C.green }}>{triggerResult.closed}</strong> · Blocked: <strong style={{ color: C.red }}>{triggerResult.blocked}</strong> · Errors: <strong style={{ color: '#be185d' }}>{triggerResult.errors}</strong>
              </span>
            </div>
          )}

          {/* Summary cards */}
          {summary && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <SummaryCard label="Auto Closed"     value={summary.auto_closed}   color={C.green} bg={C.greenBg} />
              <SummaryCard label="Manual Closed"   value={summary.manual_closed} color={C.amber} bg={C.amberBg} />
              <SummaryCard label="Commenced"        value={summary.commenced}     color={C.active} bg="#f0f9f6" />
              <SummaryCard label="Blocked (logged)" value={summary.blocked_logged} color={C.red}  bg={C.redBg} />
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: C.bg, fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <option value="">All BU / Org</option>
              {filters?.orgs.map(o => <option key={o.ad_org_id} value={o.ad_org_id}>{o.org_name || `Org ${o.ad_org_id}`}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: C.bg, fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <option value="">All Project Types</option>
              {filters?.project_types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {tab === 'commenced' && (
              <input type="text" placeholder="Search project…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding: '6px 12px', border: 'none', borderRadius: 6, background: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 200 }} />
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 8, padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif', fontSize: 13,
                fontWeight: tab === t.key ? 800 : 600,
                background: tab === t.key ? C.active : 'transparent',
                color: tab === t.key ? '#fff' : C.muted,
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span style={{ background: C.red, color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>Loading…</div>}

          {/* TAB: PENDING CHECKER */}
          {tab === 'pending_checker' && (
            <>
              <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
                  <thead><tr>
                    {['Draft Doc', 'Project', 'Category', 'Org', 'Closure Amount', 'GL: Debit → Credit', 'Drafted On', 'Actions'].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {pending.map((p, i) => (
                      <tr key={p.closure_id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...TD({ fontWeight: 700, color: C.active, fontFamily: 'monospace', fontSize: 12 }) }}>{p.documentno}</td>
                        <td style={TD({ fontWeight: 600 })}>{p.project_name}</td>
                        <td style={TD({ color: C.textSub, fontSize: 12 })}>{p.category_name}</td>
                        <td style={TD({ fontSize: 11 })}>{p.ad_org_id}</td>
                        <td style={TD({ fontWeight: 700, color: C.green })}>{fmtAmt(p.amt_closure)}</td>
                        <td style={TD({ fontSize: 11, color: C.muted })}>
                          <div>DR: {p.debit_acct_no} {p.debit_acct_title}</div>
                          <div>CR: {p.credit_acct_no} {p.credit_acct_title}</div>
                        </td>
                        <td style={TD({ color: C.muted, fontSize: 12 })}>{fmt(p.date_created)}</td>
                        <td style={TD()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={async () => {
                                setReportLoading(true);
                                try {
                                  const report = await getClosureReport(p.closure_id);
                                  setReportModal({ item: p, report });
                                } catch { alert('Failed to load report'); }
                                finally { setReportLoading(false); }
                              }}
                              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: C.active, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Nunito, sans-serif' }}>
                              {reportLoading ? '…' : '📋 View Report'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pending.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
                        ✅ No closures pending checker review
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Report Modal */}
              {reportModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 860, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)', fontFamily: 'Nunito, sans-serif' }}>

                    {/* Modal header */}
                    <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>PROJECT DETAILS FOR CLOSURE</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginTop: 2 }}>{reportModal.item.project_name}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          {reportModal.item.documentno} · Closure: {fmtAmt(reportModal.item.amt_closure)} · Date: {fmt(reportModal.item.date_closure)}
                        </div>
                      </div>
                      <button onClick={() => setReportModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.muted }}>✕</button>
                    </div>

                    <div style={{ padding: '20px 24px' }}>

                      {/* Actual Consumption */}
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actual Consumption</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                        <thead><tr style={{ background: C.bg }}>
                          {['', 'Budget', 'Actual', 'Variance'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: h === '' ? 'left' : 'right', fontWeight: 700, fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {[
                            { label: 'Material (BOM)', data: reportModal.report.material_consumption },
                            { label: 'Labor (LMC)',    data: reportModal.report.lmc_consumption },
                          ].map(row => (
                            <tr key={row.label}>
                              <td style={{ padding: '9px 12px', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{row.label}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{fmtAmt(row.data?.budget ?? null)}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{fmtAmt(row.data?.actual ?? null)}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}`, color: (row.data?.variance ?? 0) > 0 ? C.amber : C.green }}>
                                {fmtAmt(row.data?.variance ?? null)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Unconsumed BOM */}
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unconsumed BOM</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                        <thead><tr style={{ background: C.bg }}>
                          {['Description', 'BOM Qty', 'Consumed', 'Remaining'].map(h => <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Description' ? 'left' : 'right', fontWeight: 700, fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {reportModal.report.unconsumed_bom.length === 0
                            ? <tr><td colSpan={4} style={{ padding: '10px 12px', color: C.green, fontWeight: 700 }}>✅ All materials consumed</td></tr>
                            : reportModal.report.unconsumed_bom.map((b, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : C.bg }}>
                                <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>{b.sku_description || '—'}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{b.qty_totalbom}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{b.qty_totalconsumed}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: C.red, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{b.qty_remaining}</td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>

                      {/* Unconsumed LMC */}
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unconsumed LMC</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                        <thead><tr style={{ background: C.bg }}>
                          {['Item', 'Type', 'Budget', 'Paid', 'Remaining'].map(h => <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Item' || h === 'Type' ? 'left' : 'right', fontWeight: 700, fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {reportModal.report.unconsumed_lmc.length === 0
                            ? <tr><td colSpan={5} style={{ padding: '10px 12px', color: C.green, fontWeight: 700 }}>✅ All LMC budget lines paid</td></tr>
                            : reportModal.report.unconsumed_lmc.map((l, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : C.bg }}>
                                <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>{l.description}</td>
                                <td style={{ padding: '7px 12px', fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{l.lmc_type}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{fmtAmt(l.budget)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{fmtAmt(l.paid)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: C.amber, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmtAmt(l.remaining)}</td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>

                      {/* Unconsumed LMC Account Pair Credit */}
                      {reportModal.report.unconsumed_acct_pair.length > 0 && (
                        <>
                          <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unconsumed LMC — Account Pair Credit</h3>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
                            <thead><tr style={{ background: C.bg }}>
                              {['Account', 'Budget', 'Paid', 'Remaining'].map(h => <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Account' ? 'left' : 'right', fontWeight: 700, fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {reportModal.report.unconsumed_acct_pair.map((a, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : C.bg }}>
                                  <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>{a.acct_no} — {a.acct_title}</td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{fmtAmt(a.budget)}</td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{fmtAmt(a.paid)}</td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right', color: C.amber, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmtAmt(a.remaining)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}

                      {/* GL Entry */}
                      <div style={{ background: '#f0f9f6', border: `1px solid #bbf7d0`, borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.active, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>GL Journal Entry on Process</div>
                        <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div><span style={{ fontWeight: 700 }}>DEBIT:</span> {reportModal.item.debit_acct_no} — {reportModal.item.debit_acct_title} <strong style={{ color: C.active }}>{fmtAmt(reportModal.item.amt_closure)}</strong></div>
                          <div><span style={{ fontWeight: 700 }}>CREDIT:</span> {reportModal.item.credit_acct_no} — {reportModal.item.credit_acct_title} <strong style={{ color: C.active }}>{fmtAmt(reportModal.item.amt_closure)}</strong></div>
                        </div>
                      </div>

                      {/* Process button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button onClick={() => setReportModal(null)}
                          style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14 }}>
                          Cancel
                        </button>
                        <button
                          disabled={processing === reportModal.item.closure_id}
                          onClick={async () => {
                            if (!confirm(`Process closure ${reportModal.item.documentno}? This will permanently close the project and post GL entries.`)) return;
                            setProcessing(reportModal.item.closure_id);
                            try {
                              const res = await processClosureDR(reportModal.item.closure_id);
                              alert(`✅ Processed successfully!\nPR Document: ${res.documentno_pr}\nAmount: ${fmtAmt(res.amt_closure)}`);
                              setReportModal(null);
                              getPendingChecker().then(setPending).catch(() => null);
                              getClosureSummary(params).then(setSummary).catch(() => null);
                            } catch (e: unknown) {
                              alert('❌ Process failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
                            } finally {
                              setProcessing(null);
                            }
                          }}
                          style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: processing === reportModal.item.closure_id ? C.muted : C.active, color: '#fff', cursor: processing === reportModal.item.closure_id ? 'not-allowed' : 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14 }}>
                          {processing === reportModal.item.closure_id ? 'Processing…' : '✅ Confirm & Process'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB: COMMENCED */}
          {!loading && tab === 'commenced' && (
            <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
                <thead><tr>
                  <th style={TH}>Project</th><th style={TH}>Category</th><th style={TH}>Type</th>
                  <th style={TH}>Org</th><th style={TH}>Status</th><th style={TH}>Failed Rules</th>
                </tr></thead>
                <tbody>
                  {filteredCommenced.map((p, i) => (
                    <tr key={p.project_id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f9f6')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}>
                      <td style={TD({ fontWeight: 700, color: C.active, maxWidth: 260 })}>{p.project_name}</td>
                      <td style={TD({ color: C.textSub })}>{p.category_name}</td>
                      <td style={TD({ fontSize: 11 })}>{p.project_type}</td>
                      <td style={TD({ fontSize: 11 })}>{p.ad_org_id}</td>
                      <td style={TD()}>
                        {p.eligible
                          ? <span style={{ padding: '3px 10px', borderRadius: 999, background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 700 }}>✅ Eligible</span>
                          : <span style={{ padding: '3px 10px', borderRadius: 999, background: C.redBg, color: C.red, fontSize: 11, fontWeight: 700 }}>❌ Blocked ({p.failed_count})</span>}
                      </td>
                      <td style={TD({ fontSize: 11, color: C.muted, maxWidth: 360 })}>
                        {p.failed_rules.map((r, ri) => (
                          <div key={ri} style={{ marginBottom: 2 }}>
                            <strong style={{ color: C.red }}>{r.label}</strong>
                            {r.details.slice(0, 2).map((d, di) => <div key={di} style={{ paddingLeft: 8, color: C.muted }}>· {d}</div>)}
                            {r.details.length > 2 && <div style={{ paddingLeft: 8, color: C.muted }}>· +{r.details.length - 2} more</div>}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {filteredCommenced.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: C.muted }}>No commenced projects found</td></tr>}
                </tbody>
              </table>
              {commencedLastPage > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.bg, borderTop: `1px solid ${C.border}`, fontFamily: 'Nunito, sans-serif' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>Page {commencedPage} of {commencedLastPage} · {commencedTotal} projects</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCommencedPage(p => Math.max(1, p - 1))} disabled={commencedPage === 1}
                      style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: commencedPage === 1 ? C.bg : C.active, color: commencedPage === 1 ? C.muted : '#fff', cursor: commencedPage === 1 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>‹ Prev</button>
                    <button onClick={() => setCommencedPage(p => Math.min(commencedLastPage, p + 1))} disabled={commencedPage === commencedLastPage}
                      style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: commencedPage === commencedLastPage ? C.bg : C.active, color: commencedPage === commencedLastPage ? C.muted : '#fff', cursor: commencedPage === commencedLastPage ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>Next ›</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: AUTO CLOSED */}
          {!loading && tab === 'auto_closed' && (
            <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
                <thead><tr>
                  <th style={TH}>Project</th><th style={TH}>Category</th><th style={TH}>Org</th>
                  <th style={TH}>Closure Doc</th><th style={TH}>Amount</th><th style={TH}>Date Closed</th><th style={TH}>GL Account</th>
                </tr></thead>
                <tbody>
                  {autoClosed.map((p, i) => (
                    <tr key={p.wip_i_project_id + p.documentno} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={TD({ fontWeight: 700, color: C.active })}>{p.project_name}</td>
                      <td style={TD({ color: C.textSub })}>{p.category_name}</td>
                      <td style={TD({ fontSize: 11 })}>{p.ad_org_id}</td>
                      <td style={TD({ fontSize: 12, fontFamily: 'monospace' })}>{p.documentno}</td>
                      <td style={TD({ fontWeight: 600 })}>{fmtAmt(p.amt_closure)}</td>
                      <td style={TD({ color: C.muted, fontSize: 12 })}>{fmt(p.date_closure)}</td>
                      <td style={TD({ fontSize: 11, color: C.muted })}>{p.acct_no} {p.acct_title}</td>
                    </tr>
                  ))}
                  {autoClosed.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: C.muted }}>No auto-closed projects yet</td></tr>}
                </tbody>
              </table>
              <PaginationBar page={autoPage} lastPage={autoLastPage} total={autoTotal} perPage={20}
                onPrev={() => setAutoPage(p => Math.max(1, p - 1))}
                onNext={() => setAutoPage(p => Math.min(autoLastPage, p + 1))} />
            </div>
          )}

          {/* TAB: MANUAL CLOSED */}
          {!loading && tab === 'manual_closed' && (
            <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
                <thead><tr>
                  <th style={TH}>Project</th><th style={TH}>Category</th><th style={TH}>Type</th>
                  <th style={TH}>Org</th><th style={TH}>Closure Doc</th><th style={TH}>Amount</th>
                  <th style={TH}>Date Closed</th><th style={TH}>Closed By</th>
                </tr></thead>
                <tbody>
                  {manualClosed.map((p, i) => (
                    <tr key={p.wip_i_project_id + p.documentno} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={TD({ fontWeight: 700, color: C.active })}>{p.project_name}</td>
                      <td style={TD({ color: C.textSub })}>{p.category_name}</td>
                      <td style={TD({ fontSize: 11 })}>{p.project_type}</td>
                      <td style={TD({ fontSize: 11 })}>{p.ad_org_id}</td>
                      <td style={TD({ fontSize: 12, fontFamily: 'monospace' })}>{p.documentno}</td>
                      <td style={TD({ fontWeight: 600 })}>{fmtAmt(p.amt_closure)}</td>
                      <td style={TD({ color: C.muted, fontSize: 12 })}>{fmt(p.date_closure)}</td>
                      <td style={TD({ fontSize: 11, color: C.muted })}>{p.closed_by || '—'}</td>
                    </tr>
                  ))}
                  {manualClosed.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: C.muted }}>No manual closures found</td></tr>}
                </tbody>
              </table>
              <PaginationBar page={manualPage} lastPage={manualLastPage} total={manualTotal} perPage={20}
                onPrev={() => setManualPage(p => Math.max(1, p - 1))}
                onNext={() => setManualPage(p => Math.min(manualLastPage, p + 1))} />
            </div>
          )}

          {/* TAB: LOGS */}
          {!loading && tab === 'logs' && (
            <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
                <thead><tr>
                  <th style={TH}>Run At</th><th style={TH}>Project</th><th style={TH}>Type</th>
                  <th style={TH}>Org</th><th style={TH}>Result</th><th style={TH}>Doc / Amount</th><th style={TH}>Why Blocked</th>
                </tr></thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={l.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={TD({ color: C.muted, fontSize: 12 })}>{fmt(l.run_at)}</td>
                      <td style={TD({ fontWeight: 600, color: C.text })}>{l.project_name || '—'}</td>
                      <td style={TD({ fontSize: 11 })}>{l.project_type || '—'}</td>
                      <td style={TD({ fontSize: 11 })}>{l.ad_org_id || '—'}</td>
                      <td style={TD()}><ResultPill result={l.result} /></td>
                      <td style={TD({ fontSize: 12 })}>
                        {l.closure_documentno && <div style={{ fontFamily: 'monospace' }}>{l.closure_documentno}</div>}
                        {l.amt_closure != null && <div style={{ color: C.green }}>{fmtAmt(l.amt_closure)}</div>}
                      </td>
                      <td style={TD({ fontSize: 11, color: C.red, maxWidth: 320 })}>
                        {l.failed_rules?.map((r, ri) => (
                          <div key={ri}>· {r.label}</div>
                        ))}
                        {l.error_message && <div style={{ color: '#be185d' }}>{l.error_message}</div>}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: C.muted }}>No logs yet — auto process has not run</td></tr>}
                </tbody>
              </table>
              <PaginationBar page={logsPage} lastPage={logsLastPage} total={logsTotal} perPage={50}
                onPrev={() => setLogsPage(p => Math.max(1, p - 1))}
                onNext={() => setLogsPage(p => Math.min(logsLastPage, p + 1))} />
            </div>
          )}

          {/* TAB: RUN HISTORY */}
          {!loading && tab === 'run_history' && (
            <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
                <thead><tr>
                  <th style={TH}>Run ID</th><th style={TH}>Run At</th><th style={TH}>Triggered By</th>
                  <th style={TH}>Checked</th><th style={TH}>Closed</th><th style={TH}>Blocked</th>
                  <th style={TH}>Skipped</th><th style={TH}>Errors</th>
                </tr></thead>
                <tbody>
                  {runHistory.map((r, i) => (
                    <tr key={r.run_id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={TD({ fontSize: 11, fontFamily: 'monospace', color: C.muted })}>{r.run_id.slice(0, 8)}…</td>
                      <td style={TD({ color: C.muted, fontSize: 12 })}>{fmt(r.run_at)}</td>
                      <td style={TD({ fontSize: 12 })}>{r.triggered_by}</td>
                      <td style={TD({ fontWeight: 700 })}>{r.total_checked}</td>
                      <td style={TD({ color: C.green, fontWeight: 700 })}>{r.closed}</td>
                      <td style={TD({ color: C.red, fontWeight: 700 })}>{r.blocked}</td>
                      <td style={TD({ color: C.amber })}>{r.skipped}</td>
                      <td style={TD({ color: '#be185d' })}>{r.errors}</td>
                    </tr>
                  ))}
                  {runHistory.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: C.muted }}>No run history yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
