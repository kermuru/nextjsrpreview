'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { getRunHistory, getRun, getRunSummary } from '@/services/stage-consumption-run-history';
import type {
  RunRow, RunDetail, RunSummary, RunStatus, HistoryMeta,
} from '@/services/stage-consumption-run-history';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7', blue: '#1d4ed8', blueBg: '#dbeafe',
};

const TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted,
  background: C.bg, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};
const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 12px', fontSize: 13, color: C.text, ...extra,
});

const STATUS: Record<RunStatus, { label: string; fg: string; bg: string; hint: string }> = {
  success:    { label: 'SUCCESS',    fg: C.green, bg: C.greenBg, hint: 'Every stage in the run was applied' },
  partial:    { label: 'PARTIAL',    fg: C.amber, bg: C.amberBg, hint: 'Some stages applied, some were rejected' },
  failed:     { label: 'FAILED',     fg: C.red,   bg: C.redBg,   hint: 'No stage in the run was applied' },
  idle:       { label: 'NOTHING TO DO', fg: C.muted, bg: C.bg,   hint: 'Ran, found no eligible stage' },
  skipped:    { label: 'SKIPPED',    fg: C.muted, bg: C.bg,      hint: 'Auto-schedule was off — the run exited immediately' },
  aborted:    { label: 'ABORTED',    fg: C.red,   bg: C.redBg,   hint: 'Executor/usercode not configured — exited before touching anything' },
  incomplete: { label: 'INCOMPLETE', fg: C.blue,  bg: C.blueBg,  hint: 'Started but never logged a summary — still running, or it died mid-sweep' },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '',           label: 'All statuses' },
  { value: 'success',    label: 'Success' },
  { value: 'partial',    label: 'Partial' },
  { value: 'failed',     label: 'Failed' },
  { value: 'idle',       label: 'Nothing to do' },
  { value: 'skipped',    label: 'Skipped' },
  { value: 'aborted',    label: 'Aborted' },
  { value: 'incomplete', label: 'Incomplete' },
];

/** Log timestamps are already in the app timezone — shown verbatim, never re-parsed. */
function fmtStamp(value: string | null) {
  if (!value) return '—';
  const [date, time] = value.split(' ');
  if (!time) return value;
  return `${date} ${time.slice(0, 5)}`;
}

function fmtDuration(seconds: number | null) {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function StatusPill({ status }: { status: RunStatus }) {
  const s = STATUS[status];
  return (
    <span title={s.hint}
      style={{ padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.fg, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 160, background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: accent ?? C.text, marginTop: 4, lineHeight: 1.2 }}>{value}</div>
      {sub !== undefined && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

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

/** Per-stage rows for one run, fetched the first time the run is expanded. */
function RunEvents({ run, loading }: { run: RunDetail | null; loading: boolean }) {
  if (loading) {
    return <div style={{ padding: '14px 16px', fontSize: 12, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>Loading run detail…</div>;
  }
  if (!run) {
    return <div style={{ padding: '14px 16px', fontSize: 12, color: C.red, fontFamily: 'Nunito, sans-serif' }}>Run detail could not be loaded.</div>;
  }
  if (run.events.length === 0) {
    return (
      <div style={{ padding: '14px 16px', fontSize: 12, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
        {run.note ?? 'This run logged no per-stage activity.'}
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0 10px', background: '#fcfcfd' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
        <thead>
          <tr>
            {['Time', 'Project No.', 'Stage', 'Stage ID', 'Result', 'HTTP', 'Message'].map(h => (
              <th key={h} style={{ ...TH, background: 'transparent', fontSize: 9 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {run.events.map((e, i) => {
            const ok = e.kind === 'applied';
            return (
              <tr key={`${e.at}-${e.stage_id}-${i}`} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={TD({ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' })}>{e.at.split(' ')[1]}</td>
                <td style={TD({ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.active, whiteSpace: 'nowrap' })}>{e.project_no ?? '—'}</td>
                <td style={TD({ fontSize: 12, color: C.textSub })}>{e.stage_name ?? '—'}</td>
                <td style={TD({ fontSize: 12, color: C.muted })}>{e.stage_id ?? '—'}</td>
                <td style={TD()}>
                  <span style={{ padding: '2px 9px', borderRadius: 999, background: ok ? C.greenBg : C.redBg, color: ok ? C.green : C.red, fontSize: 10, fontWeight: 800 }}>
                    {ok ? 'APPLIED' : e.kind === 'unreachable' ? 'UNREACHABLE' : 'REJECTED'}
                  </span>
                </td>
                <td style={TD({ fontSize: 12, color: C.muted })}>{e.http_status ?? '—'}</td>
                <td style={TD({ fontSize: 12, color: ok ? C.muted : C.red })}>{e.error ?? 'consumption_type set to CONSUME'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StageConsumptionRunHistoryPage() {
  const [runs, setRuns]         = useState<RunRow[]>([]);
  const [page, setPage]         = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal]       = useState(0);
  const [meta, setMeta]         = useState<HistoryMeta | null>(null);
  const [summary, setSummary]   = useState<RunSummary | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [status, setStatus] = useState('');
  const [date, setDate]     = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [expanded, setExpanded]         = useState<string | null>(null);
  const [details, setDetails]           = useState<Record<string, RunDetail | null>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), per_page: '20' };
    if (status) params.status = status;
    if (date) params.date = date;
    if (debouncedSearch) params.search = debouncedSearch;

    getRunHistory(params)
      .then(r => {
        setRuns(r.data);
        setTotal(r.total);
        setLastPage(r.last_page);
        setMeta(r.meta);
        setError(null);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load run history'))
      .finally(() => setLoading(false));
  }, [page, status, date, debouncedSearch]);

  const loadSummary = useCallback(() => {
    getRunSummary().then(r => setSummary(r.data)).catch(() => null);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Opt-in polling — the sweep fires roughly every 53 minutes, so this is for
  // watching a run land, not for constant background traffic.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { load(); loadSummary(); }, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, load, loadSummary]);

  function toggleExpand(runId: string) {
    if (expanded === runId) { setExpanded(null); return; }
    setExpanded(runId);
    if (details[runId] !== undefined) return;

    setDetailLoading(runId);
    getRun(runId)
      .then(d => setDetails(prev => ({ ...prev, [runId]: d })))
      .catch(() => setDetails(prev => ({ ...prev, [runId]: null })))
      .finally(() => setDetailLoading(null));
  }

  const last = summary?.last_run ?? null;

  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/project-stage-consumption" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.primary, color: 'white', padding: '7px 14px', borderRadius: 6, textDecoration: 'none', width: 'fit-content', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
              ← Stage Consumption
            </Link>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.bg, color: C.textSub, padding: '7px 14px', borderRadius: 6, textDecoration: 'none', width: 'fit-content', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
              Menu
            </Link>
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingBottom: 4 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, fontFamily: 'Nunito, sans-serif' }}>Auto-Run History</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
                Every scheduled sweep that set stages to <strong>CONSUME</strong> — {total} run{total === 1 ? '' : 's'} in the monitored window
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: summary?.auto_enabled ? C.greenBg : C.bg, border: `1px solid ${summary?.auto_enabled ? '#bbf7d0' : C.border}`, borderRadius: 10, padding: '10px 16px', fontFamily: 'Nunito, sans-serif' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-Schedule</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                  {summary === null ? 'Checking…' : summary.auto_enabled ? 'Enabled' : 'Disabled'}
                  {summary?.next_run_at ? ` — next ${fmtStamp(summary.next_run_at)}` : ''}
                </div>
              </div>
              <span style={{ padding: '7px 16px', borderRadius: 6, background: summary?.auto_enabled ? C.green : C.muted, color: '#fff', fontSize: 13, fontWeight: 800, minWidth: 80, textAlign: 'center' }}>
                {summary === null ? '…' : summary.auto_enabled ? '● ON' : '○ OFF'}
              </span>
            </div>
          </div>

          {/* Headline numbers */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard
              label="Last run"
              value={last ? <StatusPill status={last.status} /> : '—'}
              sub={last ? `${fmtStamp(last.started_at)} · ${fmtDuration(last.duration_seconds)}` : 'No run in the window'}
            />
            <StatCard
              label="Last run result"
              value={last ? `${last.success} / ${last.total}` : '—'}
              sub={last ? `${last.fail} failed` : undefined}
              accent={last && last.fail > 0 ? C.red : C.green}
            />
            <StatCard
              label="Today"
              value={summary ? summary.today.runs : '—'}
              sub={summary ? `${summary.today.applied} applied · ${summary.today.failed} failed` : undefined}
            />
            <StatCard
              label="Last 7 days"
              value={summary ? summary.last_7_days.runs : '—'}
              sub={summary ? `${summary.last_7_days.applied} applied · ${summary.last_7_days.failed} failed` : undefined}
            />
            <StatCard
              label="Next scheduled"
              value={summary?.next_run_at ? fmtStamp(summary.next_run_at).split(' ')[1] : '—'}
              sub={summary?.next_run_at ? summary.next_run_at.split(' ')[0] : 'Not scheduled'}
              accent={C.active}
            />
          </div>

          {/* Recurring errors */}
          {summary && summary.top_errors.length > 0 && (
            <div style={{ borderRadius: 10, background: '#fff', padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', fontFamily: 'Nunito, sans-serif' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted, marginBottom: 8 }}>
                Recurring errors in the window
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summary.top_errors.map(e => (
                  <div key={e.error} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ padding: '2px 9px', borderRadius: 999, background: C.redBg, color: C.red, fontWeight: 800, minWidth: 34, textAlign: 'center' }}>{e.count}</span>
                    <span style={{ color: C.textSub }}>{e.error}</span>
                  </div>
                ))}
              </div>
              {summary.last_failure && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
                  Most recent: <strong style={{ color: C.textSub }}>{summary.last_failure.label ?? `Stage ${summary.last_failure.stage_id}`}</strong> at {fmtStamp(summary.last_failure.at)}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: C.redBg, color: C.red, fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search project no., stage or error…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px', border: 'none', borderRadius: 6, background: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 260 }}
            />
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              style={{ padding: '7px 12px', border: 'none', borderRadius: 6, background: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              {STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setPage(1); }}
              style={{ padding: '7px 12px', border: 'none', borderRadius: 6, background: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            />
            {(status || date || search) && (
              <button onClick={() => { setStatus(''); setDate(''); setSearch(''); setPage(1); }}
                style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: C.bg, color: C.textSub, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
                Clear
              </button>
            )}
            <button onClick={() => { load(); loadSummary(); }} disabled={loading}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? C.muted : C.active, color: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 800, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Refreshing…' : '⟳ Refresh'}
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Nunito, sans-serif', fontSize: 12, color: C.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ cursor: 'pointer' }} />
              Auto-refresh every minute
            </label>
          </div>

          {/* Runs table */}
          <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 36 }} />
                  {['Started', 'Status', 'Duration', 'Stages', 'Applied', 'Failed', 'Finished'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && runs.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>Loading…</td></tr>
                )}
                {!loading && runs.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>
                    {status || date || search
                      ? 'No run matches these filters'
                      : 'No auto-run recorded in the monitored log window'}
                  </td></tr>
                )}
                {runs.map((r, i) => {
                  const isOpen = expanded === r.run_id;
                  return (
                    <React.Fragment key={r.run_id}>
                      <tr
                        onClick={() => toggleExpand(r.run_id)}
                        style={{ background: isOpen ? '#f0f9f6' : i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f5f5f5'; }}
                        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'; }}>
                        <td style={TD({ textAlign: 'center', color: C.muted, fontWeight: 800 })}>{isOpen ? '▾' : '▸'}</td>
                        <td style={TD({ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.active, whiteSpace: 'nowrap' })}>{fmtStamp(r.started_at)}</td>
                        <td style={TD()}><StatusPill status={r.status} /></td>
                        <td style={TD({ color: C.muted, fontSize: 12, whiteSpace: 'nowrap' })}>{fmtDuration(r.duration_seconds)}</td>
                        <td style={TD({ fontWeight: 700, textAlign: 'center' })}>{r.total}</td>
                        <td style={TD({ fontWeight: 700, color: r.success > 0 ? C.green : C.muted, textAlign: 'center' })}>{r.success}</td>
                        <td style={TD({ fontWeight: 700, color: r.fail > 0 ? C.red : C.muted, textAlign: 'center' })}>{r.fail}</td>
                        <td style={TD({ color: C.muted, fontSize: 12, whiteSpace: 'nowrap' })}>
                          {r.finished_at ? r.finished_at.split(' ')[1].slice(0, 5) : '— still open'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, borderTop: `1px solid ${C.border}` }}>
                            <RunEvents run={details[r.run_id] ?? null} loading={detailLoading === r.run_id} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar page={page} lastPage={lastPage} total={total} perPage={20}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(lastPage, p + 1))} />
          </div>

          {/* Where the numbers come from */}
          {meta && (
            <p style={{ margin: 0, fontSize: 11, color: C.muted, fontFamily: 'Nunito, sans-serif', lineHeight: 1.6 }}>
              {meta.log_readable
                ? <>Reconstructed from <strong>{meta.log_path}</strong> ({meta.timezone}). History shown from <strong>{meta.window_from ?? '—'}</strong>
                    {meta.truncated ? ' — older runs fall outside the scanned window.' : '.'}</>
                : <>The application log could not be read, so no run history is available.</>}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
