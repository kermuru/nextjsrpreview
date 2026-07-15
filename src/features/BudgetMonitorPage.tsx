'use client';

import { useCallback, useEffect, useState } from 'react';
import { isApiError, formatDate } from '@/lib/api';
import { logout } from '@/lib/auth';
import { getProcessMonitor, type ProcessedDoc } from '@/services/budget-monitor';

function Spinner() {
  return (
    <span
      style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--muted)', borderRadius: '50%', animation: 'bm-spin 0.7s linear infinite' }}
    />
  );
}

const TYPE_COLORS: Record<string, [string, string]> = {
  irb: ['#e0f2fe', '#075985'],
  arb: ['#fef3c7', '#92400e'],
  exb: ['#ede9fe', '#5b21b6'],
};

function TypeBadge({ t }: { t: string }) {
  const [bg, fg] = TYPE_COLORS[t] ?? ['#e7e5e4', '#44403c'];
  return <span style={{ background: bg, color: fg, borderRadius: 6, padding: '2px 7px', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.03em' }}>{t.toUpperCase()}</span>;
}

function SourceBadge({ s }: { s: ProcessedDoc['source'] }) {
  const ours = s === 'our-system';
  return (
    <span style={{ background: ours ? '#dcfce7' : '#e0e7ff', color: ours ? '#166534' : '#3730a3', borderRadius: 6, padding: '3px 9px', fontSize: '0.7rem', fontWeight: 800 }}>
      {ours ? 'Our System' : 'Java (UI)'}
    </span>
  );
}

type Filter = 'all' | 'our-system' | 'java';

export default function BudgetMonitorPage() {
  const [rows, setRows] = useState<ProcessedDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getProcessMonitor();
      setRows(res.data ?? []);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to load the monitor.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const shown = filter === 'all' ? rows : rows.filter((r) => r.source === filter);
  const ours = rows.filter((r) => r.source === 'our-system').length;
  const java = rows.length - ours;

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 760 }}>
        <div className="page-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 2px', fontSize: '1.15rem', color: 'var(--accent)' }}>Processing Monitor</h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                Processed IPR-IRB / ARB-IPR / EXB-ADV — {rows.length} total · {ours} our-system · {java} Java
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => load()} disabled={loading} style={ghostBtn}>{loading ? 'Refreshing…' : 'Refresh'}</button>
              <button onClick={() => logout()} style={ghostBtn}>Log out</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, margin: '14px 0 12px', flexWrap: 'wrap' }}>
            {(['all', 'our-system', 'java'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={chip(filter === f)}>
                {f === 'all' ? 'All' : f === 'our-system' ? 'Our System' : 'Java (UI)'}
              </button>
            ))}
          </div>

          {error && <div style={errorStyle}>{error}</div>}
          {loading && <div style={emptyStyle}><Spinner /> Loading…</div>}
          {!loading && shown.length === 0 && <div style={emptyStyle}>No processed documents.</div>}

          {!loading && shown.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map((r) => (
                <div key={`${r.type}-${r.documentno}`} style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <TypeBadge t={r.type} />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', wordBreak: 'break-all' }}>{r.documentno}</span>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--muted)', flexShrink: 0 }}>{formatDate(r.processed_at ?? undefined)}</span>
                  <SourceBadge s={r.source} />
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: '14px 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>
            Source = <b>Our System</b> when this system recorded processing the document; <b>Java (UI)</b> otherwise. The headless driver reuses the same SAERP services as the JavaFX UI, so the only reliable signal is our own processing log — not maker/checker or the document-number prefix.
          </p>
        </div>
      </div>
      <style>{`@keyframes bm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const errorStyle: React.CSSProperties = { marginTop: 12, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 11px', fontSize: '0.8rem' };
const emptyStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '26px 8px', color: 'var(--muted)', fontSize: '0.88rem' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' };
const ghostBtn: React.CSSProperties = { background: '#fff', color: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' };
const chip = (active: boolean): React.CSSProperties => ({ background: active ? 'var(--accent)' : '#fff', color: active ? '#fff' : 'var(--muted)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 999, padding: '6px 14px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' });
