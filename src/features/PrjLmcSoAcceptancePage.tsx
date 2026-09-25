'use client';

import { useCallback, useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import { getSoMonitor, peso, type SoMonitorRow } from '@/services/prjlmc-monitor';

/**
 * Project LMC service-order acceptance monitor.
 *
 * Accepting is the agreement artifact — the message tells the contractor that
 * pressing Accept records their agreement to the service order — so who answered
 * and when is the substance of this screen, not decoration.
 *
 * `discord_responder_id` is shown next to `discord_user_id` on purpose. The
 * interactions handler records who clicked but does not compare it to who the
 * service order was sent to, so the two can differ. Seeing them side by side is
 * how that would be noticed.
 */

type Filter = '' | 'pending' | 'accepted' | 'declined' | 'undelivered';

const FILTERS: { value: Filter; label: string }[] = [
  { value: '',            label: 'All service orders' },
  { value: 'pending',     label: 'Pending — awaiting an answer' },
  { value: 'accepted',    label: 'Accepted' },
  { value: 'declined',    label: 'Declined' },
  { value: 'undelivered', label: 'Undelivered — never reached them' },
];

export default function PrjLmcSoAcceptancePage() {
  const [rows, setRows] = useState<SoMonitorRow[]>([]);
  const [filter, setFilter] = useState<Filter>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSoMonitor({
        status: filter === '' ? undefined : filter,
        limit: 200,
      });
      setRows(res.data ?? []);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to load the acceptance monitor.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const mismatched = rows.filter(
    (r) => r.discord_responder_id && r.discord_user_id && r.discord_responder_id !== r.discord_user_id,
  ).length;

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Project LMC — Service Order Acceptance
      </h1>
      <p style={{ color: '#475569', marginBottom: 18, lineHeight: 1.5 }}>
        Service orders sent to contractors after a payout posts, and how each was answered.
        Accepting records the contractor&apos;s agreement to the service order — release of
        payment is handled separately by the office.
      </p>

      {error && <Banner tone="error" text={error} />}

      {mismatched > 0 && (
        <Banner
          tone="warn"
          text={`${mismatched} service order(s) were answered by a different Discord account than the one they were sent to. Check the Sent to / Answered by columns.`}
        />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={select}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <button type="button" onClick={() => void load()} disabled={loading} style={btn}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        <span style={{ alignSelf: 'center', color: '#64748b', fontSize: 13 }}>
          {rows.length} service order{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {!loading && rows.length === 0 && (
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          No service orders{filter ? ' in that state' : ''} yet. One is raised after a payout
          posts — if payouts exist but nothing is listed here, the payout monitor&apos;s
          &ldquo;Missing&rdquo; filter will show which ones never produced a service order.
        </p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={th}>Payout</th>
                <th style={th}>Contractor</th>
                <th style={th}>Service</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>Sent to</th>
                <th style={th}>Answer</th>
                <th style={th}>Answered by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mismatch =
                  !!r.discord_responder_id &&
                  !!r.discord_user_id &&
                  r.discord_responder_id !== r.discord_user_id;

                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.payout_documentno}</span>
                      <div style={meta}>org {r.ad_org_id} · SO #{r.id}</div>
                    </td>
                    <td style={td}>
                      {r.payee_name ?? '—'}
                      <div style={meta}>person {r.bpar_i_person_id}</div>
                    </td>
                    <td style={{ ...td, maxWidth: 280 }}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{r.service_description ?? '—'}</div>
                      <div style={meta}>{r.project_name ?? ''}{r.scope_name ? ` · ${r.scope_name}` : ''}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {peso(r.service_amount)}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
                      {r.discord_user_id ?? '—'}
                      <div style={meta}>
                        {r.notified_at ? `delivered ${fmtDate(r.notified_at)}` : 'NOT delivered'}
                      </div>
                    </td>
                    <td style={td}>
                      <AnswerBadge row={r} />
                      {r.decline_reason && (
                        <div style={{ ...meta, color: '#991b1b' }}>{r.decline_reason}</div>
                      )}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
                      {r.discord_responder_id ?? '—'}
                      {mismatch && (
                        <div style={{ ...meta, color: '#9a3412', fontWeight: 700 }}>
                          ≠ sent to
                        </div>
                      )}
                      {r.responded_at && <div style={meta}>{fmtDate(r.responded_at)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnswerBadge({ row }: { row: SoMonitorRow }) {
  let bg = '#e0f2fe', fg = '#075985', label = 'PENDING';

  if (row.supplier_response === 'accepted')      { bg = '#dcfce7'; fg = '#166534'; label = 'ACCEPTED'; }
  else if (row.supplier_response === 'declined') { bg = '#fee2e2'; fg = '#991b1b'; label = 'DECLINED'; }
  else if (!row.notified_at)                     { bg = '#fef9c3'; fg = '#854d0e'; label = 'UNDELIVERED'; }

  return (
    <span style={{
      background: bg, color: fg, fontSize: 10, fontWeight: 700,
      padding: '3px 8px', borderRadius: 999, letterSpacing: 0.4,
    }}>
      {label}
    </span>
  );
}

function Banner({ tone, text }: { tone: 'error' | 'warn'; text: string }) {
  const p = tone === 'error'
    ? { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' }
    : { bg: '#fffbeb', border: '#fde68a', fg: '#92400e' };

  return (
    <div style={{
      background: p.bg, border: `1px solid ${p.border}`, color: p.fg,
      borderRadius: 8, padding: '10px 12px', marginBottom: 14, lineHeight: 1.5,
    }}>
      {text}
    </div>
  );
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  return v.replace('T', ' ').slice(0, 16);
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
const meta: React.CSSProperties = { fontSize: 11, color: '#94a3b8', marginTop: 2 };
const select: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, background: '#fff',
};
const btn: React.CSSProperties = {
  padding: '8px 16px', background: '#0f5132', color: '#fff', border: 'none',
  borderRadius: 8, fontWeight: 600, cursor: 'pointer',
};
