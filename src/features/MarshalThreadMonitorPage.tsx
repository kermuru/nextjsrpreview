'use client';

import { useCallback, useEffect, useState } from 'react';
import { isApiError, formatDate } from '@/lib/api';
import { logout } from '@/lib/auth';
import {
  getMarshalThreadMonitor,
  type MarshalThreadRow,
  type MarshalThreadStatus,
} from '@/services/marshal-thread-monitor';

function Spinner() {
  return (
    <span
      style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--muted)', borderRadius: '50%', animation: 'mt-spin 0.7s linear infinite' }}
    />
  );
}

const STATUS_META: Record<MarshalThreadStatus, { label: string; bg: string; fg: string }> = {
  keeping_alive: { label: '🟢 Keeping alive', bg: '#dcfce7', fg: '#166534' },
  done:          { label: '✓ Done',           bg: '#e7e5e4', fg: '#44403c' },
  unknown:       { label: '? Unknown',         bg: '#fef3c7', fg: '#92400e' },
};

function StatusBadge({ s }: { s: MarshalThreadStatus }) {
  const m = STATUS_META[s] ?? STATUS_META.unknown;
  return <span style={{ background: m.bg, color: m.fg, borderRadius: 6, padding: '3px 9px', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{m.label}</span>;
}

function daysLabel(row: MarshalThreadRow): string {
  if (row.days_to_go == null) return '—';
  const d = row.days_to_go;
  if (d === 0) return 'Interment today';
  if (d > 0) return `in ${d} day${d === 1 ? '' : 's'}`;
  const past = Math.abs(d);
  return `${past} day${past === 1 ? '' : 's'} ago`;
}

type Filter = 'all' | 'keeping_alive' | 'done';

export default function MarshalThreadMonitorPage() {
  const [rows, setRows] = useState<MarshalThreadRow[]>([]);
  const [summary, setSummary] = useState({ keeping_alive: 0, done: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getMarshalThreadMonitor();
      setRows(res.data ?? []);
      setSummary(res.summary ?? { keeping_alive: 0, done: 0, total: 0 });
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to load the monitor.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 820 }}>
        <div className="page-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 2px', fontSize: '1.15rem', color: 'var(--accent)' }}>Marshal Thread Monitor</h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                Discord threads kept alive until the interment day — {summary.total} total · {summary.keeping_alive} keeping alive · {summary.done} done
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => load()} disabled={loading} style={ghostBtn}>{loading ? 'Refreshing…' : 'Refresh'}</button>
              <button onClick={() => logout()} style={ghostBtn}>Log out</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, margin: '14px 0 12px', flexWrap: 'wrap' }}>
            {(['all', 'keeping_alive', 'done'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={chip(filter === f)}>
                {f === 'all' ? 'All' : f === 'keeping_alive' ? 'Keeping alive' : 'Done'}
              </button>
            ))}
          </div>

          {error && <div style={errorStyle}>{error}</div>}
          {loading && <div style={emptyStyle}><Spinner /> Loading…</div>}
          {!loading && shown.length === 0 && <div style={emptyStyle}>No marshal threads to show.</div>}

          {!loading && shown.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map((r) => (
                <div key={r.documentno} style={rowStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <StatusBadge s={r.status} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', wordBreak: 'break-all' }}>{r.documentno}</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{r.occupant || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>{formatDate(r.date_interment ?? undefined) || '—'}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{daysLabel(r)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, minWidth: 120 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>last refreshed</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{formatDate(r.last_refreshed ?? undefined) || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ margin: '14px 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>
            The hourly <b>interment:refresh-marshal-threads</b> job silently un-archives any thread Discord archived after 7 days of inactivity, keeping it live until the interment day — then leaves it to archive. <b>Last refreshed</b> updates only when the job actually had to un-archive a thread.
          </p>
        </div>
      </div>
      <style>{`@keyframes mt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const errorStyle: React.CSSProperties = { marginTop: 12, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 11px', fontSize: '0.8rem' };
const emptyStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '26px 8px', color: 'var(--muted)', fontSize: '0.88rem' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' };
const ghostBtn: React.CSSProperties = { background: '#fff', color: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' };
const chip = (active: boolean): React.CSSProperties => ({ background: active ? 'var(--accent)' : '#fff', color: active ? '#fff' : 'var(--muted)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 999, padding: '6px 14px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' });
