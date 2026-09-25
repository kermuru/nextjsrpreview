'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCandidates, commenceProject, commenceBulk,
} from '@/services/project-commence';
import type {
  CommenceCandidate, ApplyResult, BulkResultRow,
} from '@/services/project-commence';

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

function fmtDate(value: string | null) {
  if (!value) return '—';
  return value.slice(0, 10);
}

export default function ProjectCommencePage() {
  const [rows, setRows]         = useState<CommenceCandidate[]>([]);
  const [page, setPage]         = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal]       = useState(0);
  const [allowedOrgs, setAllowedOrgs] = useState<number[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [org, setOrg]           = useState('');
  const [onlyEligible, setOnlyEligible] = useState(true);

  // Default ON. Each live call changes an ERP project's status through the
  // maker/checker services, so the safe mode is the one you start in.
  const [dryRun, setDryRun]     = useState(true);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [running, setRunning]   = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [single, setSingle]     = useState<ApplyResult | null>(null);
  const [bulk, setBulk]         = useState<{ rows: BulkResultRow[]; dryRun: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), per_page: '20' };
    if (debouncedSearch) params.search = debouncedSearch;
    if (org) params.org = org;
    if (onlyEligible) params.only_eligible = '1';

    getCandidates(params)
      .then(r => {
        setRows(r.data);
        setTotal(r.total);
        setLastPage(r.last_page);
        setAllowedOrgs(r.allowed_orgs);
        setError(null);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load candidates'))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, org, onlyEligible]);

  useEffect(() => { load(); }, [load]);

  const eligibleOnPage = useMemo(() => rows.filter(r => r.eligible), [rows]);

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === eligibleOnPage.length
        ? new Set()
        : new Set(eligibleOnPage.map(r => r.wip_i_project_id)));
  }

  function confirmLive(count: number) {
    if (dryRun) return true;
    return window.confirm(
      `Commence ${count} project${count === 1 ? '' : 's'} for real?\n\n` +
      'This runs the ERP maker/checker pair: a PENDING project log is created and immediately ' +
      'approved, which sets project_status to COMMENCED and writes a status-change row. ' +
      'There is no undo from this screen.'
    );
  }

  async function runOne(row: CommenceCandidate) {
    if (!confirmLive(1)) return;
    setRunning(row.wip_i_project_id);
    setSingle(null);
    try {
      const r = await commenceProject(row.wip_i_project_id, dryRun);
      setSingle(r);
      if (!dryRun && r.success) load();
    } catch (e) {
      setSingle({
        success: false, dry_run: dryRun,
        project: { wip_i_project_id: row.wip_i_project_id, documentno: row.documentno },
        error: e instanceof Error ? e.message : 'Request failed',
      });
    } finally {
      setRunning(null);
    }
  }

  async function runBulk() {
    if (selected.size === 0) return;
    if (!confirmLive(selected.size)) return;
    setBulkRunning(true);
    setBulk(null);
    try {
      const r = await commenceBulk([...selected], dryRun);
      setBulk({ rows: r.results, dryRun: r.dry_run });
      setSelected(new Set());
      if (!dryRun) load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk run failed');
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">

          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.primary, color: 'white', padding: '7px 14px', borderRadius: 6, textDecoration: 'none', width: 'fit-content', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
            ← Menu
          </Link>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingBottom: 4 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, fontFamily: 'Nunito, sans-serif' }}>Commence Project</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
                Move a project from <strong>BUDGETING</strong> to <strong>COMMENCED</strong> — {total} candidate{total === 1 ? '' : 's'}
              </p>
            </div>

            {/* Dry run / live switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: dryRun ? C.blueBg : C.redBg, border: `1px solid ${dryRun ? '#bfdbfe' : '#fecaca'}`, borderRadius: 10, padding: '10px 16px', fontFamily: 'Nunito, sans-serif' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {dryRun ? 'Dry run' : 'Live'}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                  {dryRun ? 'Shows the payload, calls nothing' : 'Writes to the ERP'}
                </div>
              </div>
              <button
                onClick={() => setDryRun(v => !v)}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: dryRun ? C.blue : C.red, color: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 800, minWidth: 92 }}>
                {dryRun ? '○ DRY RUN' : '● LIVE'}
              </button>
            </div>
          </div>

          {/* What this actually does */}
          <div style={{ padding: '12px 16px', borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, fontFamily: 'Nunito, sans-serif', fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
            Commencing in SAERP is a <strong>maker/checker pair</strong>, not one write. Each run creates a
            PENDING project log and immediately approves it — that approval is what sets{' '}
            <code>project_status</code> and writes the status-change row. The executor bot is stamped as both
            maker and checker. Projects outside orgs {allowedOrgs.join(', ') || '—'} are listed but cannot be
            sent: the driver fails closed on any org outside its default tenant.
          </div>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: C.redBg, color: C.red, fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          )}

          {/* Single result */}
          {single && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: single.success ? (single.dry_run ? C.blueBg : C.greenBg) : C.redBg, fontFamily: 'Nunito, sans-serif', fontSize: 13 }}>
              <strong style={{ color: single.success ? (single.dry_run ? C.blue : C.green) : C.red }}>
                {single.project.documentno ?? `Project ${single.project.wip_i_project_id}`}
                {' — '}
                {single.success
                  ? (single.dry_run ? 'dry run OK, nothing sent' : `commenced (${single.driverResponse?.pr?.projectStatus ?? 'COMMENCED'})`)
                  : `failed${single.stage ? ` at ${single.stage}` : ''}`}
              </strong>
              {single.error && <div style={{ marginTop: 6, color: C.red, fontSize: 12 }}>{single.error}</div>}
              {single.dry_run && single.payload && (
                <pre style={{ margin: '8px 0 0', fontSize: 11, background: 'rgba(0,0,0,0.05)', padding: 10, borderRadius: 6, overflowX: 'auto' }}>
{`POST ${single.endpoint}
${JSON.stringify(single.payload, null, 2)}`}
                </pre>
              )}
              {!single.dry_run && single.success && single.driverResponse?.dr && (
                <div style={{ marginTop: 6, fontSize: 12, color: C.textSub }}>
                  log #{single.driverResponse.dr.wipIProjectLogsId} {single.driverResponse.dr.logsAction}/{single.driverResponse.dr.logsStatus} → approved
                </div>
              )}
              <button onClick={() => setSingle(null)}
                style={{ marginTop: 8, padding: '3px 10px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 12, fontFamily: 'Nunito, sans-serif' }}>
                Dismiss
              </button>
            </div>
          )}

          {/* Bulk result */}
          {bulk && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: bulk.rows.some(r => !r.success) ? C.amberBg : (bulk.dryRun ? C.blueBg : C.greenBg), fontFamily: 'Nunito, sans-serif', fontSize: 13 }}>
              <strong style={{ color: bulk.rows.some(r => !r.success) ? C.amber : (bulk.dryRun ? C.blue : C.green) }}>
                {bulk.dryRun ? 'Dry run' : 'Run'} finished — {bulk.rows.filter(r => r.success).length} of {bulk.rows.length} OK
              </strong>
              <ul style={{ margin: '8px 0 0', padding: '0 0 0 18px', fontSize: 12 }}>
                {bulk.rows.map(r => (
                  <li key={r.project_id} style={{ color: r.success ? C.textSub : C.red }}>
                    {r.documentno ?? r.project_id}: {r.success ? (r.projectStatus ?? (bulk.dryRun ? 'would be sent' : 'OK')) : r.error}
                  </li>
                ))}
              </ul>
              <button onClick={() => setBulk(null)}
                style={{ marginTop: 8, padding: '3px 10px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 12, fontFamily: 'Nunito, sans-serif' }}>
                Dismiss
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by project no. or name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px', border: 'none', borderRadius: 6, background: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 260 }}
            />
            <input
              type="number"
              placeholder="Org id"
              value={org}
              onChange={e => { setOrg(e.target.value); setPage(1); }}
              style={{ padding: '7px 12px', border: 'none', borderRadius: 6, background: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', width: 110 }}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Nunito, sans-serif', fontSize: 12, color: C.muted, cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyEligible} onChange={e => { setOnlyEligible(e.target.checked); setPage(1); }} style={{ cursor: 'pointer' }} />
              Eligible only
            </label>
            {selected.size > 0 && (
              <button
                onClick={runBulk}
                disabled={bulkRunning}
                style={{ padding: '7px 18px', borderRadius: 6, border: 'none', cursor: bulkRunning ? 'not-allowed' : 'pointer', background: bulkRunning ? C.muted : (dryRun ? C.blue : C.red), color: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 800, opacity: bulkRunning ? 0.7 : 1 }}>
                {bulkRunning ? 'Running…' : `${dryRun ? 'Dry-run' : 'Commence'} ${selected.size} selected`}
              </button>
            )}
            <button onClick={load} disabled={loading}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? C.muted : C.active, color: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 800, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Loading…' : '⟳ Refresh'}
            </button>
          </div>

          {/* Table */}
          <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 36 }}>
                    <input
                      type="checkbox"
                      checked={eligibleOnPage.length > 0 && selected.size === eligibleOnPage.length}
                      onChange={toggleAll}
                      disabled={eligibleOnPage.length === 0}
                      style={{ cursor: eligibleOnPage.length === 0 ? 'default' : 'pointer' }}
                    />
                  </th>
                  {['Project No.', 'Project Name', 'Type', 'Org', 'Created', 'Eligibility', 'Action'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>Loading…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>
                    No BUDGETING project matches these filters
                  </td></tr>
                )}
                {rows.map((r, i) => {
                  const isSelected = selected.has(r.wip_i_project_id);
                  const busy = running === r.wip_i_project_id;
                  return (
                    <tr key={r.wip_i_project_id}
                      style={{ background: isSelected ? '#f0f9f6' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={TD({ textAlign: 'center' })}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!r.eligible}
                          onChange={() => toggleSelect(r.wip_i_project_id)}
                          style={{ cursor: r.eligible ? 'pointer' : 'not-allowed' }}
                        />
                      </td>
                      <td style={TD({ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.active, whiteSpace: 'nowrap' })}>{r.documentno}</td>
                      <td style={TD({ fontWeight: 600, maxWidth: 240 })}>{r.project_name}</td>
                      <td style={TD({ color: C.textSub, fontSize: 12 })}>{r.project_type ?? '—'}</td>
                      <td style={TD({ color: C.muted, fontSize: 12 })}>{r.ad_org_id}</td>
                      <td style={TD({ color: C.muted, fontSize: 12, whiteSpace: 'nowrap' })}>{fmtDate(r.date_created)}</td>
                      <td style={TD({ maxWidth: 280 })}>
                        {r.eligible ? (
                          <span style={{ padding: '3px 10px', borderRadius: 999, background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 800 }}>ELIGIBLE</span>
                        ) : (
                          <span title={r.blocked_reason ?? ''} style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: C.amberBg, color: C.amber, fontSize: 11, fontWeight: 800 }}>
                            {!r.tenant_ok ? 'OTHER TENANT' : r.pending_logs > 0 ? `${r.pending_logs} PENDING LOG` : 'RESUME CASE'}
                          </span>
                        )}
                      </td>
                      <td style={TD()}>
                        <button
                          onClick={() => runOne(r)}
                          disabled={!r.eligible || busy}
                          title={r.blocked_reason ?? ''}
                          style={{
                            padding: '5px 14px', borderRadius: 6, border: 'none',
                            cursor: !r.eligible || busy ? 'not-allowed' : 'pointer',
                            background: !r.eligible ? C.bg : busy ? C.muted : (dryRun ? C.blue : C.active),
                            color: !r.eligible ? C.muted : '#fff',
                            fontSize: 12, fontWeight: 700, fontFamily: 'Nunito, sans-serif',
                            whiteSpace: 'nowrap',
                          }}>
                          {busy ? '…' : dryRun ? 'Dry run' : 'Commence'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {lastPage > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.bg, borderTop: `1px solid ${C.border}`, fontFamily: 'Nunito, sans-serif' }}>
                <span style={{ fontSize: 12, color: C.muted }}>
                  Page <strong style={{ color: C.text }}>{page}</strong> of <strong style={{ color: C.text }}>{lastPage}</strong> · {total} total
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: page === 1 ? C.bg : C.active, color: page === 1 ? C.muted : '#fff', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>‹ Prev</button>
                  <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
                    style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: page === lastPage ? C.bg : C.active, color: page === lastPage ? C.muted : '#fff', cursor: page === lastPage ? 'default' : 'pointer', fontSize: 13, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>Next ›</button>
                </div>
              </div>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 11, color: C.muted, fontFamily: 'Nunito, sans-serif', lineHeight: 1.6 }}>
            Eligibility here mirrors the driver&apos;s own guards (already commenced · pending logs · previously
            commenced · tenant). The ERP re-checks all of them inside the transaction, so a row marked eligible
            can still be refused — that refusal is the authority, not this list.
          </p>

        </div>
      </div>
    </div>
  );
}
