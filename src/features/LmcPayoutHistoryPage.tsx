'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { LmcPayoutService, ServicePayoutHistoryRecord } from '@/services/lmc-payout';

function formatDate(raw: string | null) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(n: number | string | null) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  const isPr = status === 'PR';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.05em', background: isPr ? '#dcfce7' : '#fef9c3', color: isPr ? '#15803d' : '#92400e',
      border: `1px solid ${isPr ? '#86efac' : '#fde68a'}`, fontFamily: 'Nunito, sans-serif',
    }}>{status}</span>
  );
}

function SourceBadge({ source }: { source: 'portal' | 'java' | string }) {
  const isPortal = source === 'portal';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.05em', background: isPortal ? '#e0f2fe' : '#f3e8ff', color: isPortal ? '#0369a1' : '#7c3aed',
      border: `1px solid ${isPortal ? '#7dd3fc' : '#c4b5fd'}`, fontFamily: 'Nunito, sans-serif',
    }}>{isPortal ? 'Portal' : 'Java ERP'}</span>
  );
}

type SourceFilter = 'all' | 'portal' | 'java';
type StatusFilter = 'all' | 'DR' | 'PR';

export default function LmcPayoutHistoryPage() {
  const [records,      setRecords]      = useState<ServicePayoutHistoryRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null);
  const [ioSearch,     setIoSearch]     = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cancelingId,  setCancelingId]  = useState<number | null>(null);
  const [notice,       setNotice]       = useState('');
  const [cancelTarget, setCancelTarget] = useState<ServicePayoutHistoryRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await LmcPayoutService.listServicePayoutHistory();
      setRecords(result.data);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load payout history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Open the cancel modal for a PROCESSED (PR) payout.
  const openCancel = (r: ServicePayoutHistoryRecord) => {
    setError('');
    setNotice('');
    setCancelReason('');
    setCancelTarget(r);
  };

  // Perform the cancel → -CA counter-doc + budget reversal.
  const doCancel = async () => {
    const r = cancelTarget;
    if (!r || !cancelReason.trim()) return;
    setCancelingId(r.payout_id);
    setNotice('');
    setError('');
    try {
      const res = await LmcPayoutService.cancelPayout(r.payout_id, cancelReason.trim());
      setCancelTarget(null);
      setCancelReason('');
      await load();
      setNotice(res.message || `Cancelled ${r.payout_documentno}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed.');
    } finally {
      setCancelingId(null);
    }
  };

  const filtered = records.filter(r => {
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
    if (statusFilter !== 'all' && r.docstatus !== statusFilter) return false;
    if (ioSearch) {
      const q = ioSearch.trim().toLowerCase();
      if (!r.io_documentno.toLowerCase().includes(q) && !(r.payee_name?.toLowerCase().includes(q) ?? false)) return false;
    }
    return true;
  });

  const totalNet = filtered.reduce((sum, r) => sum + (r.amt_total_payout_net ?? 0), 0);

  const filterBtn = (active: boolean): CSSProperties => ({
    padding: '6px 12px', borderRadius: 6, border: '1px solid', fontSize: '0.78rem', cursor: 'pointer',
    fontFamily: 'Nunito, sans-serif', fontWeight: active ? 700 : 400,
    background: active ? '#0a352d' : '#fff', color: active ? '#eae1d4' : '#44403c',
    borderColor: active ? '#0a352d' : '#d6d3d1', minHeight: 36,
  });

  const cancelBtnStyle: CSSProperties = {
    padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2',
    color: '#b91c1c', fontFamily: 'Nunito, sans-serif', fontSize: '0.72rem', fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4' }}>
      <div style={{ background: 'linear-gradient(135deg, #0a352d 0%, #0c3d34 100%)', padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, color: '#eae1d4', margin: 0, fontSize: '1.15rem' }}>
              LMC Payout History
            </h1>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.65rem', color: 'rgba(177,131,67,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '2px 0 0' }}>
              Emcee · Singer · Photographer · Lapida · Merienda
            </p>
          </div>
          <button onClick={() => void load()} disabled={loading} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(234,225,212,0.2)', borderRadius: 8,
            padding: '7px 12px', color: '#eae1d4', fontFamily: 'Nunito, sans-serif', fontSize: '0.78rem',
            fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, minHeight: 36,
          }}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>

      <div style={{ padding: '24px 32px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e7e5e4', padding: '14px 16px', marginBottom: 12 }}>
          <input type="text" placeholder="Search IO # or payee name…" value={ioSearch} onChange={e => setIoSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d6d3d1', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem', fontFamily: 'Nunito, sans-serif', outline: 'none', marginBottom: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', color: '#78716c', fontFamily: 'Nunito, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 48 }}>Source</span>
              {(['all', 'portal', 'java'] as SourceFilter[]).map(v => (
                <button key={v} onClick={() => setSourceFilter(v)} style={filterBtn(sourceFilter === v)}>
                  {v === 'all' ? 'All' : v === 'portal' ? 'Portal' : 'Java ERP'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', color: '#78716c', fontFamily: 'Nunito, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 48 }}>Status</span>
              {(['all', 'DR', 'PR'] as StatusFilter[]).map(v => (
                <button key={v} onClick={() => setStatusFilter(v)} style={filterBtn(statusFilter === v)}>{v === 'all' ? 'All' : v}</button>
              ))}
            </div>
          </div>
          {!loading && filtered.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f3f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Nunito, sans-serif' }}>
              <span style={{ fontSize: '0.78rem', color: '#78716c' }}>
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                {lastRefresh && <span style={{ marginLeft: 8, color: '#a8a29e', fontSize: '0.7rem' }}>· {lastRefresh.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0a352d' }}>{formatAmount(totalNet)} net</span>
            </div>
          )}
        </div>

        {notice && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '12px 16px', marginBottom: 12, color: '#047857', fontFamily: 'Nunito, sans-serif', fontSize: '0.83rem', fontWeight: 600 }}>✓ {notice}</div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 12, color: '#b91c1c', fontFamily: 'Nunito, sans-serif', fontSize: '0.83rem', fontWeight: 600 }}>✕ {error}</div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'Nunito, sans-serif', fontSize: '0.85rem', color: '#78716c' }}>Loading payout history…</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#a8a29e', fontFamily: 'Nunito, sans-serif', fontSize: '0.88rem' }}>No records match the selected filters.</div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e7e5e4', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#fafaf9', borderBottom: '1px solid #e7e5e4' }}>
                  {['IO #', 'Interment Date', 'Payee', 'Service Lines', 'Payout Doc #', 'Net Amount', 'Status', 'Source', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Net Amount' ? 'right' : 'left', fontWeight: 700, color: '#78716c', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.payout_id} style={{ borderBottom: '1px solid #f5f5f4', background: i % 2 === 0 ? '#fff' : '#fafaf9' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0a352d', whiteSpace: 'nowrap' }}>{r.io_documentno}</td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: '#44403c' }}>{formatDate(r.date_interment)}</td>
                    <td style={{ padding: '11px 14px', color: '#1c1917', maxWidth: 180 }}>{r.payee_name ?? <span style={{ color: '#a8a29e' }}>—</span>}</td>
                    <td style={{ padding: '11px 14px', color: '#57534e', maxWidth: 240 }}>
                      <span title={r.line_descriptions ?? ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.line_descriptions ?? <span style={{ color: '#a8a29e' }}>—</span>}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap', color: '#57534e' }}>{r.payout_documentno}</td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', fontWeight: 700, color: '#0a352d', textAlign: 'right' }}>{formatAmount(r.amt_total_payout_net)}</td>
                    <td style={{ padding: '11px 14px' }}><StatusBadge status={r.docstatus} /></td>
                    <td style={{ padding: '11px 14px' }}><SourceBadge source={r.source} /></td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      {r.docstatus === 'PR' ? (
                        <button onClick={() => openCancel(r)} disabled={cancelingId === r.payout_id}
                          style={{ ...cancelBtnStyle, opacity: cancelingId === r.payout_id ? 0.6 : 1, cursor: cancelingId === r.payout_id ? 'not-allowed' : 'pointer' }}>
                          {cancelingId === r.payout_id ? 'Cancelling…' : 'Cancel PR'}
                        </button>
                      ) : <span style={{ color: '#a8a29e' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelTarget && (
        <div
          onClick={() => { if (cancelingId === null) setCancelTarget(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, maxWidth: 440, width: '100%', padding: '20px 22px', fontFamily: 'Nunito, sans-serif', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 6px', fontFamily: "'Playfair Display', serif", color: '#0a352d', fontSize: '1.05rem' }}>Cancel PR payout</h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#57534e' }}>
              This creates <b>{cancelTarget.payout_documentno}-CA</b> and frees the budget line (it becomes payable again). Blocked if it has been liquidated.
            </p>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason *</label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Why is this payout being cancelled?"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, border: '1px solid #d6d3d1', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem', fontFamily: 'Nunito, sans-serif', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setCancelTarget(null)} disabled={cancelingId !== null}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d6d3d1', background: '#fff', color: '#44403c', fontWeight: 600, fontSize: '0.8rem', cursor: cancelingId !== null ? 'not-allowed' : 'pointer' }}>
                Close
              </button>
              <button onClick={() => void doCancel()} disabled={cancelingId !== null || !cancelReason.trim()}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #b91c1c', background: (cancelReason.trim() && cancelingId === null) ? '#b91c1c' : '#fca5a5', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: (cancelingId !== null || !cancelReason.trim()) ? 'not-allowed' : 'pointer' }}>
                {cancelingId !== null ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
