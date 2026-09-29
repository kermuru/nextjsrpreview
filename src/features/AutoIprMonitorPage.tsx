'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getRuns, getStatus, runNow, updateRule, updateSetting,
} from '@/services/auto-ipr';
import type {
  AutoIprRule, AutoIprRun, AutoIprRunStatus, AutoIprStatus,
} from '@/services/auto-ipr';

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

const STATUS: Record<AutoIprRunStatus, { label: string; fg: string; bg: string; hint: string }> = {
  posted: {
    label: 'POSTED', fg: C.green, bg: C.greenBg,
    hint: 'A real requisition was created and processed in the ERP',
  },
  nothing_due: {
    label: 'NOTHING DUE', fg: C.muted, bg: C.bg,
    hint: 'The agent ran and no threshold had been crossed — this is the healthy idle state',
  },
  skipped: {
    label: 'SKIPPED', fg: C.amber, bg: C.amberBg,
    hint: 'The agent is disarmed, so it evaluated and deliberately wrote nothing',
  },
  failed: {
    label: 'FAILED', fg: C.red, bg: C.redBg,
    hint: 'The driver refused the document — watermarks were NOT advanced, so the same blocks retry next run',
  },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All runs' },
  { value: 'posted', label: 'Posted' },
  { value: 'failed', label: 'Failed' },
  { value: 'nothing_due', label: 'Nothing due' },
  { value: 'skipped', label: 'Skipped' },
];

function fmtStamp(value: string | null) {
  if (!value) return '—';
  return value.replace('T', ' ').slice(0, 19);
}

function fmtQty(n: number, unit: string | null) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}

/**
 * Stock position against the ordering level — the number an operator actually watches.
 *
 * Shows the position (balance + in-flight) relative to the level, because the position is what
 * the trigger compares. In-flight is broken out: without it a shortage already on order looks
 * identical to one that isn't.
 */
function StockGauge({ rule }: { rule: AutoIprRule }) {
  if (rule.trigger_mode === 'interment_ratio') {
    if (!rule.io_per_block) return <span style={{ color: C.muted }}>no ratio set</span>;
    const done = rule.carry_remainder ?? 0;
    const pct = Math.min(100, Math.round((done / rule.io_per_block) * 100));
    return (
      <div style={{ minWidth: 150 }}>
        <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: C.primary }} />
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          {done} / {rule.io_per_block} interment orders
        </div>
      </div>
    );
  }

  if (rule.balance === null || rule.balance === undefined) {
    return <span style={{ color: C.muted, fontSize: 12 }}>never moved at this locator</span>;
  }

  const level = rule.reorder_level;
  const pos = rule.stock_position ?? 0;
  const below = rule.below_level === true;
  // Bar is filled relative to order_up_to (or 2x level as a stand-in).
  const ceiling = rule.order_up_to ?? (level !== null && level !== undefined ? level * 2 : 0);
  const pct = ceiling > 0 ? Math.max(0, Math.min(100, Math.round((pos / ceiling) * 100))) : 0;

  return (
    <div style={{ minWidth: 190 }}>
      <div style={{
        height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 4,
        position: 'relative',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: below ? C.red : C.green }} />
        {ceiling > 0 && level !== null && level !== undefined && (
          <div style={{
            position: 'absolute', top: -2, bottom: -2,
            left: `${Math.min(100, (level / ceiling) * 100)}%`,
            width: 2, background: C.amber,
          }} title={`ordering level ${level}`} />
        )}
      </div>
      <div style={{ fontSize: 11, color: below ? C.red : C.muted }}>
        <strong style={{ color: below ? C.red : C.textSub }}>{pos.toFixed(2)}</strong>
        {' '}={' '}{rule.balance.toFixed(2)} on hand
        {rule.in_flight ? ` + ${rule.in_flight.toFixed(2)} on order` : ''}
        {level !== null && level !== undefined
          ? <> · level {level}{below ? ' — BELOW' : ''}</>
          : <> · <span style={{ color: C.amber }}>no level set</span></>}
      </div>
    </div>
  );
}

/**
 * Why an item that is clearly short is ordering nothing.
 *
 * The agent holds off while a requisition it raised itself is still waiting to be purchased or
 * delivered — one open order per item. Without this cell the operator sees a red, below-level
 * row with a dash in "due now" and has no way to tell a working guard from a broken agent, so
 * the blocking document and the quantity it would otherwise have ordered are both named.
 */
function BlockedCell({ rule }: { rule: AutoIprRule }) {
  const b = rule.blocked_by;
  if (!b) return null;
  const would = rule.qty_would_be ?? 0;

  return (
    <div style={{ textAlign: 'right' }}>
      <span style={{
        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
        color: C.blue, background: C.blueBg, whiteSpace: 'nowrap',
      }} title={b.reason}>
        ON ORDER
      </span>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginTop: 4, lineHeight: 1.45 }}>
        <span style={{ fontFamily: 'monospace' }}>{b.document_no ?? `#${b.requisition_id}`}</span>
        <br />
        {b.qty_received.toFixed(2)} of {b.qty.toFixed(2)} received
        <br />
        <span style={{ color: C.amber }}>{b.reason}</span>
        {would > 0 && (
          <>
            <br />
            would order {fmtQty(would, rule.unit)}
          </>
        )}
      </div>
    </div>
  );
}

export default function AutoIprMonitorPage() {
  const [status, setStatus] = useState<AutoIprStatus | null>(null);
  const [runs, setRuns] = useState<AutoIprRun[]>([]);
  const [runFilter, setRunFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [editing, setEditing] = useState<Record<number, { level: string; upTo: string }>>({});

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        getStatus(),
        getRuns({ status: (runFilter || undefined) as AutoIprRunStatus | undefined, per_page: 25 }),
      ]);
      setStatus(s);
      setRuns(r.data);
    } catch (e) {
      setNotice({ tone: 'err', text: e instanceof Error ? e.message : 'Failed to load.' });
    } finally {
      setLoading(false);
    }
  }, [runFilter]);

  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, okText: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice({ tone: 'ok', text: okText });
      await load();
    } catch (e) {
      setNotice({ tone: 'err', text: e instanceof Error ? e.message : 'Action failed.' });
    } finally {
      setBusy(null);
    }
  };

  const armed = status?.setting.enabled ?? false;
  const dueCount = status?.total_due ?? 0;

  return (
    <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto', color: C.text }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Auto IPR — interment-order replenishment</h1>
      <p style={{ color: C.muted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
        Raises a <strong>normal (non-BOQ) requisition</strong> when an item&apos;s stock at the purchase locator falls to its ordering level.
        An item it has already requisitioned is <strong>never ordered again</strong> until that document has been
        purchased and received — one open order per item. The document is raised under org{' '}
        <strong>{status?.setting.org_code ?? '—'}</strong>.
      </p>

      {notice && (
        <div style={{
          margin: '14px 0', padding: '10px 12px', borderRadius: 6, fontSize: 13,
          color: notice.tone === 'ok' ? C.green : C.red,
          background: notice.tone === 'ok' ? C.greenBg : C.redBg,
          border: `1px solid ${notice.tone === 'ok' ? C.green : C.red}33`,
        }}>
          {notice.text}
        </div>
      )}

      {/* ── Arm / disarm ─────────────────────────────────────────────── */}
      <section style={{
        marginTop: 18, padding: 16, borderRadius: 8,
        border: `1px solid ${armed ? C.green : C.border}`,
        background: armed ? C.greenBg : C.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {armed ? 'ARMED — posts to the ERP unattended' : 'Disarmed — evaluates only, writes nothing'}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4, maxWidth: 680, lineHeight: 1.5 }}>
              {armed
                ? 'The daily 07:30 run will create and process a real requisition the moment a threshold is crossed. No one confirms it first.'
                : 'Every scheduled run records "skipped" and touches nothing. Arm it only when the ratios below are right.'}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              Last run: <strong>{fmtStamp(status?.setting.last_run_at ?? null)}</strong>
            </div>
          </div>
          <button
            disabled={busy !== null}
            onClick={() => act('arm',
              () => updateSetting({ enabled: !armed }),
              armed ? 'Agent disarmed.' : 'Agent armed — it will post on the next scheduled run.')}
            style={{
              padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', color: '#fff', background: armed ? C.red : C.active,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {armed ? 'Disarm' : 'Arm agent'}
          </button>
        </div>
      </section>

      {/* ── Due now ──────────────────────────────────────────────────── */}
      {dueCount > 0 && (
        <section style={{
          marginTop: 16, padding: 14, borderRadius: 8,
          border: `1px solid ${C.green}55`, background: C.greenBg,
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.green }}>
            {dueCount} line{dueCount === 1 ? '' : 's'} due now
          </div>
          <div style={{ fontSize: 13, marginTop: 6, color: C.textSub }}>
            {status?.due.map((d) => (
              <span key={d.rule_id} style={{ marginRight: 14 }}>
                <strong>{fmtQty(d.qty_due, d.unit)}</strong> {d.skucode}
                <span style={{ color: C.muted }}> ({d.blocks_due} block{d.blocks_due === 1 ? '' : 's'})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Rules ────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 15, fontWeight: 800, marginTop: 26, marginBottom: 10 }}>Watched items</h2>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>SKU</th>
              <th style={TH}>Item</th>
              <th style={{ ...TH, textAlign: 'right' }}>On hand (purch. locator)</th>
              <th style={TH}>Ordering level</th>
              <th style={TH}>Stock position</th>
              <th style={{ ...TH, textAlign: 'right' }}>Due now</th>
              <th style={TH}>On</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td style={TD({ color: C.muted })} colSpan={8}>Loading…</td></tr>
            )}
            {!loading && status?.rules.map((r) => {
              const ed = editing[r.rule_id];
              return (
                <tr key={r.rule_id} style={{
                  borderTop: `1px solid ${C.border}`,
                  // Blocked wins over below-level: the item IS short, but it is already handled,
                  // so painting it red would send someone chasing a non-problem.
                  background: r.blocked_by ? C.blueBg : r.below_level ? C.redBg : undefined,
                }}>
                  <td style={TD({ fontFamily: 'monospace', fontSize: 12 })}>{r.skucode}</td>
                  <td style={TD()}>
                    {r.item_name}
                    <div style={{ fontSize: 11, color: C.muted }}>sku id {r.nvt_i_sku_id}</div>
                  </td>
                  {/* Exact stocked quantity at the purchase locator — the raw number, not the
                      position, so it can be read straight against the ERP stockcard. */}
                  <td style={TD({ textAlign: 'right', whiteSpace: 'nowrap' })}>
                    {r.balance === null || r.balance === undefined ? (
                      <span style={{ color: C.muted, fontSize: 12 }}>never moved</span>
                    ) : (
                      <strong style={{ fontSize: 15, color: r.balance < 0 ? C.red : C.text }}>
                        {fmtQty(r.balance, r.unit)}
                      </strong>
                    )}
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>
                      {r.locator_code ?? '—'}
                      {r.balance_as_of ? ` · as of ${r.balance_as_of}` : ''}
                    </div>
                  </td>
                  <td style={TD()}>
                    {ed ? (
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: C.muted, width: '100%' }}>order when at or below / bring up to</span>
                        <input
                          value={ed.level} placeholder="level"
                          onChange={(e) => setEditing({ ...editing, [r.rule_id]: { ...ed, level: e.target.value } })}
                          style={{ width: 62, padding: '4px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13 }} />
                        <span style={{ color: C.muted, fontSize: 12 }}>→</span>
                        <input
                          value={ed.upTo} placeholder="up to"
                          onChange={(e) => setEditing({ ...editing, [r.rule_id]: { ...ed, upTo: e.target.value } })}
                          style={{ width: 62, padding: '4px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13 }} />
                      </span>
                    ) : r.reorder_level !== null && r.reorder_level !== undefined ? (
                      <>
                        <strong>{fmtQty(r.reorder_level, r.unit)}</strong>
                        {r.order_up_to != null && (
                          <div style={{ fontSize: 11, color: C.muted }}>
                            bring up to {fmtQty(r.order_up_to, r.unit)}
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: C.amber, fontWeight: 600 }}>not set</span>
                    )}
                  </td>
                  <td style={TD()}><StockGauge rule={r} /></td>
                  <td style={TD({ textAlign: 'right', fontWeight: r.qty_due > 0 ? 800 : 400, color: r.qty_due > 0 ? C.green : C.muted })}>
                    {r.blocked_by ? (
                      <BlockedCell rule={r} />
                    ) : r.qty_due > 0 ? fmtQty(r.qty_due, r.unit) : '—'}
                  </td>
                  <td style={TD()}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      color: r.enabled ? C.green : C.muted,
                      background: r.enabled ? C.greenBg : C.bg,
                      border: `1px solid ${r.enabled ? C.green : C.border}44`,
                    }}>
                      {r.enabled ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td style={TD({ textAlign: 'right', whiteSpace: 'nowrap' })}>
                    {ed ? (
                      <>
                        <button
                          disabled={busy !== null}
                          onClick={() => act(`rule-${r.rule_id}`,
                            () => updateRule(r.rule_id, {
                              reorder_level: ed.level === '' ? null : Number(ed.level),
                              order_up_to: ed.upTo === '' ? null : Number(ed.upTo),
                            }),
                            `${r.skucode} ordering level saved.`).then(() => setEditing((p) => {
                              const n = { ...p }; delete n[r.rule_id]; return n;
                            }))}
                          style={{ padding: '4px 10px', fontSize: 12, marginRight: 6, cursor: 'pointer',
                            border: 'none', borderRadius: 4, background: C.active, color: '#fff' }}
                        >Save</button>
                        <button
                          onClick={() => setEditing((p) => { const n = { ...p }; delete n[r.rule_id]; return n; })}
                          style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                            border: `1px solid ${C.border}`, borderRadius: 4, background: '#fff', color: C.textSub }}
                        >Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing({
                            ...editing,
                            [r.rule_id]: {
                              level: r.reorder_level == null ? '' : String(r.reorder_level),
                              upTo: r.order_up_to == null ? '' : String(r.order_up_to),
                            },
                          })}
                          style={{ padding: '4px 10px', fontSize: 12, marginRight: 6, cursor: 'pointer',
                            border: `1px solid ${C.border}`, borderRadius: 4, background: '#fff', color: C.textSub }}
                        >Set level</button>
                        <button
                          disabled={busy !== null || (!r.enabled && !r.configured)}
                          title={!r.enabled && !r.configured ? 'Set an ordering level before switching this on' : undefined}
                          onClick={() => act(`toggle-${r.rule_id}`,
                            () => updateRule(r.rule_id, { enabled: !r.enabled }),
                            `${r.skucode} turned ${r.enabled ? 'off' : 'on'}.`)}
                          style={{ padding: '4px 10px', fontSize: 12, cursor: (!r.enabled && !r.configured) ? 'not-allowed' : 'pointer',
                            border: `1px solid ${C.border}`, borderRadius: 4, background: '#fff',
                            color: (!r.enabled && !r.configured) ? C.muted : C.textSub,
                            opacity: (!r.enabled && !r.configured) ? 0.55 : 1 }}
                        >{r.enabled ? 'Turn off' : 'Turn on'}</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Manual run ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          disabled={busy !== null}
          onClick={() => act('dry', () => runNow(false), 'Dry run recorded — the ERP was not touched.')}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${C.border}`, borderRadius: 6, background: '#fff', color: C.textSub }}
        >Dry run</button>
        <button
          disabled={busy !== null || dueCount === 0}
          title={dueCount === 0 ? 'Nothing is due' : undefined}
          onClick={() => {
            if (!window.confirm(
              `Post a real IPR now for ${dueCount} line(s)?\n\nThis creates and processes a document in the ERP immediately.`
            )) return;
            void act('post', () => runNow(true), 'Requisition posted.');
          }}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: dueCount === 0 ? 'not-allowed' : 'pointer',
            border: 'none', borderRadius: 6, background: dueCount === 0 ? C.border : C.primary,
            color: dueCount === 0 ? C.muted : '#fff', opacity: busy ? 0.6 : 1 }}
        >Post now</button>
        <span style={{ fontSize: 12, color: C.muted }}>
          Scheduled daily at 07:30. Highest interment order seen: <strong>#{status?.io_high_id ?? '—'}</strong>
        </span>
      </div>

      {/* ── Run ledger ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Run history</h2>
        <select
          value={runFilter}
          onChange={(e) => setRunFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6 }}
        >
          {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>When</th>
              <th style={TH}>Status</th>
              <th style={TH}>Trigger</th>
              <th style={TH}>Document</th>
              <th style={TH}>Lines</th>
              <th style={TH}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {!loading && runs.length === 0 && (
              <tr><td style={TD({ color: C.muted })} colSpan={6}>No runs recorded yet.</td></tr>
            )}
            {runs.map((run) => {
              const s = STATUS[run.status];
              return (
                <tr key={run.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={TD({ whiteSpace: 'nowrap', fontSize: 12 })}>{fmtStamp(run.ran_at)}</td>
                  <td style={TD()}>
                    <span title={s.hint} style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      color: s.fg, background: s.bg, whiteSpace: 'nowrap',
                    }}>{s.label}</span>
                    {run.dry_run && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: C.muted }}>dry</span>
                    )}
                  </td>
                  <td style={TD({ fontSize: 12, color: C.muted })}>{run.trigger}</td>
                  <td style={TD({ fontFamily: 'monospace', fontSize: 12 })}>
                    {run.document_no ?? '—'}
                    {run.requisition_id && (
                      <div style={{ fontSize: 11, color: C.muted }}>#{run.requisition_id}</div>
                    )}
                  </td>
                  <td style={TD({ fontSize: 12 })}>
                    {run.lines?.length
                      ? run.lines.map((l) => `${l.skucode} ${fmtQty(l.qty_due, l.unit)}`).join(', ')
                      : '—'}
                  </td>
                  <td style={TD({ fontSize: 12, color: run.status === 'failed' ? C.red : C.muted, maxWidth: 320 })}>
                    {run.error ?? s.hint}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
