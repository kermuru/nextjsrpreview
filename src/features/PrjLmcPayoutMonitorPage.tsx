'use client';

import { useCallback, useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  getPayoutMonitor,
  peso,
  type PayoutMonitorRow,
  type SoState,
} from '@/services/prjlmc-monitor';

/**
 * Project LMC payout monitor.
 *
 * The column that matters is SERVICE ORDER. A payout is committed in SAERP before
 * its service order is attempted, so the two diverge silently — NLMC0008648,
 * NLMC0008649 and NLMC0008672 all posted correctly and none produced a service
 * order. SAERP records nothing about that, because there is nothing for it to
 * record. This screen is where the gap becomes visible.
 */

const ORGS = [
  { id: 162012, label: 'RP Tan A (162012)' },
  { id: 162011, label: 'VRC Renaissance Park Tantangan (162011)' },
];

const SO_FILTERS: { value: '' | SoState; label: string }[] = [
  { value: '',            label: 'All service-order states' },
  { value: 'missing',     label: 'Missing — never raised' },
  { value: 'undelivered', label: 'Undelivered — raised, not delivered' },
  { value: 'pending',     label: 'Pending — awaiting an answer' },
  { value: 'accepted',    label: 'Accepted' },
  { value: 'declined',    label: 'Declined' },
];

export default function PrjLmcPayoutMonitorPage() {
  const [rows, setRows] = useState<PayoutMonitorRow[]>([]);
  const [orgId, setOrgId] = useState<number | ''>('');
  const [soState, setSoState] = useState<'' | SoState>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPayoutMonitor({
        payout_org_id: orgId === '' ? undefined : orgId,
        so_state: soState === '' ? undefined : soState,
        limit: 200,
      });
      setRows(res.data ?? []);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to load the payout monitor.');
    } finally {
      setLoading(false);
    }
  }, [orgId, soState]);

  useEffect(() => {
    void load();
  }, [load]);

  // Counts come off the loaded rows, so they describe what is on screen rather
  // than implying a separate server-side total.
  const missing = rows.filter((r) => r.so_state === 'missing').length;

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Project LMC — Payout Monitor
      </h1>
      <p style={{ color: '#475569', marginBottom: 18, lineHeight: 1.5 }}>
        Recent payouts and whether each contractor was actually told. A payout is committed
        in SAERP before its service order is attempted, so the two can diverge — and SAERP
        keeps no record of the gap.
      </p>

      {error && <Banner tone="error" text={error} />}

      {missing > 0 && (
        <Banner
          tone="warn"
          text={`${missing} of the ${rows.length} payouts shown have NO service order. Those contractors were paid and never notified.`}
        />
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={orgId} onChange={(e) => setOrgId(e.target.value ? Number(e.target.value) : '')} style={select}>
          <option value="">Both payout orgs</option>
          {ORGS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>

        <select value={soState} onChange={(e) => setSoState(e.target.value as '' | SoState)} style={select}>
          {SO_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <button type="button" onClick={() => void load()} disabled={loading} style={btn}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        <span style={{ alignSelf: 'center', color: '#64748b', fontSize: 13 }}>
          {rows.length} payout{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {!loading && rows.length === 0 && (
        <p style={{ color: '#64748b' }}>Nothing matches those filters.</p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={th}>Document</th>
                <th style={th}>Date</th>
                <th style={th}>Project / scope</th>
                <th style={th}>Payee</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>Service order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.documentno}|${r.ad_org_id}`}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    // Tint only the genuinely wrong state, so it reads at a glance
                    // without turning the whole table into a colour chart.
                    background: r.so_state === 'missing' ? '#fff7ed' : '#fff',
                  }}
                >
                  <td style={td}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.documentno}</span>
                    <div style={meta}>org {r.ad_org_id} · {r.docstatus}</div>
                  </td>
                  <td style={td}>
                    {fmtDate(r.date_trans)}
                    {r.coverage_from && (
                      <div style={meta}>cover {fmtDate(r.coverage_from)} → {fmtDate(r.coverage_to)}</div>
                    )}
                  </td>
                  <td style={td}>
                    {r.project_name ?? '—'}
                    <div style={meta}>{r.scope_name ?? '—'}{r.scope_id ? ` · scope ${r.scope_id}` : ''}</div>
                  </td>
                  <td style={td}>
                    {r.payee_name ?? '—'}
                    <div style={meta}>{r.bpar_i_person_id ? `person ${r.bpar_i_person_id}` : ''}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {peso(r.amt_total_payout)}
                  </td>
                  <td style={td}>
                    <SoBadge state={r.so_state} />
                    <div style={meta}>
                      {r.so_state === 'missing' && 'never raised'}
                      {r.so_state === 'undelivered' && 'raised, Discord never confirmed'}
                      {r.so_state === 'pending' && `sent ${fmtDate(r.so_notified_at)}`}
                      {(r.so_state === 'accepted' || r.so_state === 'declined') &&
                        `${r.so_state} ${fmtDate(r.so_responded_at)}`}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SoBadge({ state }: { state: SoState }) {
  const palette: Record<SoState, { bg: string; fg: string; label: string }> = {
    missing:     { bg: '#ffedd5', fg: '#9a3412', label: 'MISSING' },
    undelivered: { bg: '#fef9c3', fg: '#854d0e', label: 'UNDELIVERED' },
    pending:     { bg: '#e0f2fe', fg: '#075985', label: 'PENDING' },
    accepted:    { bg: '#dcfce7', fg: '#166534', label: 'ACCEPTED' },
    declined:    { bg: '#fee2e2', fg: '#991b1b', label: 'DECLINED' },
  };
  const p = palette[state];

  return (
    <span style={{
      background: p.bg, color: p.fg, fontSize: 10, fontWeight: 700,
      padding: '3px 8px', borderRadius: 999, letterSpacing: 0.4,
    }}>
      {p.label}
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
  // The API returns MySQL datetimes; take the date and time, drop the seconds.
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
