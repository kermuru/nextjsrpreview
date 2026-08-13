'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getEligibleStages, applyStage, applyBulk, getAutoStatus, toggleAuto,
} from '@/services/stage-consumption-type';
import type { EligibleStage, ApplyResult } from '@/services/stage-consumption-type';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7',
};

const TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted,
  background: C.bg, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};
const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 12px', fontSize: 13, color: C.text, ...extra,
});

function fmt(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
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

export default function StageConsumptionTypeDashboardPage() {
  const [stages, setStages]       = useState<EligibleStage[]>([]);
  const [page, setPage]           = useState(1);
  const [lastPage, setLastPage]   = useState(1);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading]     = useState(false);
  const [applying, setApplying]   = useState<number | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [autoEnabled, setAutoEnabled] = useState<boolean | null>(null);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [bulkResult, setBulkResult] = useState<ApplyResult[] | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadStages = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), per_page: '20' };
    if (debouncedSearch) params.search = debouncedSearch;
    getEligibleStages(params)
      .then(r => { setStages(r.data); setTotal(r.total); setLastPage(r.last_page); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { loadStages(); }, [loadStages]);
  useEffect(() => { getAutoStatus().then(r => setAutoEnabled(r.enabled)).catch(() => null); }, []);

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === stages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(stages.map(s => s.wip_i_project_scope_stage_id)));
    }
  }

  async function handleApply(stageId: number) {
    setApplying(stageId);
    try {
      await applyStage(stageId);
      loadStages();
      setSelected(prev => { const n = new Set(prev); n.delete(stageId); return n; });
    } catch (e) {
      alert('Failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setApplying(null);
    }
  }

  async function handleBulkApply() {
    if (selected.size === 0) return;
    if (!confirm(`Apply CONSUME to ${selected.size} selected stage(s)?`)) return;
    setBulkApplying(true);
    setBulkResult(null);
    try {
      const results = await applyBulk(Array.from(selected));
      setBulkResult(results);
      setSelected(new Set());
      loadStages();
    } catch (e) {
      alert('Bulk apply failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setBulkApplying(false);
    }
  }

  async function handleToggleAuto() {
    setTogglingAuto(true);
    try {
      const r = await toggleAuto();
      setAutoEnabled(r.enabled);
    } catch (e) {
      alert('Toggle failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setTogglingAuto(false);
    }
  }

  const successCount = bulkResult?.filter(r => r.success).length ?? 0;
  const failCount    = bulkResult?.filter(r => !r.success).length ?? 0;

  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">

          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.primary, color: 'white', padding: '7px 14px', borderRadius: 6, textDecoration: 'none', width: 'fit-content', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700 }}>
            ← Menu
          </Link>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingBottom: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, fontFamily: 'Nunito, sans-serif' }}>Stage Consumption Type</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
                Project stages with GR'd items that are not yet set to <strong>CONSUME</strong> — {total} eligible
              </p>
            </div>

            {/* Auto-schedule toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: autoEnabled ? C.greenBg : C.bg, border: `1px solid ${autoEnabled ? '#bbf7d0' : C.border}`, borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ fontFamily: 'Nunito, sans-serif' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-Schedule</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Runs nightly when enabled</div>
              </div>
              <button
                onClick={handleToggleAuto}
                disabled={togglingAuto || autoEnabled === null}
                style={{
                  padding: '7px 16px', borderRadius: 6, border: 'none', cursor: togglingAuto ? 'not-allowed' : 'pointer',
                  background: autoEnabled ? C.green : C.muted, color: '#fff',
                  fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 800, opacity: togglingAuto ? 0.7 : 1,
                  minWidth: 80,
                }}>
                {togglingAuto ? '…' : autoEnabled ? '● ON' : '○ OFF'}
              </button>
            </div>
          </div>

          {/* Bulk result banner */}
          {bulkResult && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: failCount > 0 ? C.amberBg : C.greenBg, fontFamily: 'Nunito, sans-serif', fontSize: 13 }}>
              <strong style={{ color: failCount > 0 ? C.amber : C.green }}>
                Bulk apply done — {successCount} succeeded{failCount > 0 ? `, ${failCount} failed` : ''}
              </strong>
              {failCount > 0 && (
                <ul style={{ margin: '8px 0 0', padding: '0 0 0 18px', color: C.red, fontSize: 12 }}>
                  {bulkResult.filter(r => !r.success).map(r => (
                    <li key={r.stage_id}>Stage {r.stage_id}: {r.error}</li>
                  ))}
                </ul>
              )}
              <button onClick={() => setBulkResult(null)}
                style={{ marginTop: 8, padding: '3px 10px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 12, fontFamily: 'Nunito, sans-serif' }}>
                Dismiss
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by project no. or stage name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px', border: 'none', borderRadius: 6, background: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 260 }}
            />
            {selected.size > 0 && (
              <button
                onClick={handleBulkApply}
                disabled={bulkApplying}
                style={{ padding: '7px 18px', borderRadius: 6, border: 'none', cursor: bulkApplying ? 'not-allowed' : 'pointer', background: bulkApplying ? C.muted : C.active, color: '#fff', fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 800, opacity: bulkApplying ? 0.7 : 1 }}>
                {bulkApplying ? 'Applying…' : `✅ Apply to ${selected.size} selected`}
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 36 }}>
                    <input
                      type="checkbox"
                      checked={stages.length > 0 && selected.size === stages.length}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  {['Project No.', 'Project Name', 'Stage Name', 'Current Type', 'GR Count', 'Latest GR', 'Action'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>Loading…</td></tr>
                )}
                {!loading && stages.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.green, fontFamily: 'Nunito, sans-serif', fontWeight: 700 }}>
                    ✅ No eligible stages — all GR'd stages are set to CONSUME
                  </td></tr>
                )}
                {!loading && stages.map((s, i) => {
                  const isSelected = selected.has(s.wip_i_project_scope_stage_id);
                  return (
                    <tr key={s.wip_i_project_scope_stage_id}
                      style={{ background: isSelected ? '#f0f9f6' : i % 2 === 0 ? '#fff' : '#fafafa' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'; }}>
                      <td style={TD({ textAlign: 'center' })}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(s.wip_i_project_scope_stage_id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={TD({ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.active, whiteSpace: 'nowrap' })}>{s.project_no}</td>
                      <td style={TD({ fontWeight: 600, maxWidth: 220 })}>{s.project_name}</td>
                      <td style={TD({ color: C.textSub, maxWidth: 200 })}>{s.stage_name}</td>
                      <td style={TD()}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: C.amberBg, color: C.amber, fontSize: 11, fontWeight: 700 }}>
                          {s.consumption_type ?? 'NOT SET'}
                        </span>
                      </td>
                      <td style={TD({ fontWeight: 700, color: C.active, textAlign: 'center' })}>{s.gr_count}</td>
                      <td style={TD({ color: C.muted, fontSize: 12, whiteSpace: 'nowrap' })}>{fmt(s.latest_gr_date)}</td>
                      <td style={TD()}>
                        <button
                          onClick={() => handleApply(s.wip_i_project_scope_stage_id)}
                          disabled={applying === s.wip_i_project_scope_stage_id}
                          style={{
                            padding: '5px 14px', borderRadius: 6, border: 'none', cursor: applying === s.wip_i_project_scope_stage_id ? 'not-allowed' : 'pointer',
                            background: applying === s.wip_i_project_scope_stage_id ? C.muted : C.active, color: '#fff',
                            fontSize: 12, fontWeight: 700, fontFamily: 'Nunito, sans-serif',
                            opacity: applying === s.wip_i_project_scope_stage_id ? 0.7 : 1, whiteSpace: 'nowrap',
                          }}>
                          {applying === s.wip_i_project_scope_stage_id ? '…' : 'Set CONSUME'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar page={page} lastPage={lastPage} total={total} perPage={20}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(lastPage, p + 1))} />
          </div>

        </div>
      </div>
    </div>
  );
}
