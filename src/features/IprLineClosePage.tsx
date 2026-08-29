'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClosableLine,
  closeIprLine,
  fetchClosableLines,
} from '@/services/ipr-line-close';

/**
 * IPR-BOQ line closing — remediation for lines stranded by the retired legacy
 * post path.
 *
 * These lines sit on PR'd IPR-BOQ documents that were posted without the ERP
 * consuming the BOQ budget. Closing retires the line on the DOCUMENT; the BOM
 * line is never touched, which is correct because nothing was ever consumed.
 *
 * WHAT CLOSING DOES AND DOES NOT DO
 *   It does NOT gate re-requisitioning. Eligibility is computed from the BOM
 *   line's remaining budget alone, so these items are already re-offerable today
 *   and stay so afterwards. What closing prevents is a buyer raising a purchase
 *   order against a requisition the budget knows nothing about — which is exactly
 *   how two lines on NIPR-BOQ0002507 became unrepairable by any ERP action.
 *
 *   So this is time-sensitive rather than optional: every line here is one PO
 *   away from needing a manual data fix instead.
 */
export default function IprLineClosePage() {
  const [lines, setLines] = useState<ClosableLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [closed, setClosed] = useState<string[]>([]);
  const [reason, setReason] = useState('Legacy IPR post — budget never drawn; superseded');

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchClosableLines();
      setLines(data.lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load closable lines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Group by document so an operator works through one requisition at a time.
  const byDoc = useMemo(() => {
    const m = new Map<string, ClosableLine[]>();
    for (const l of lines) {
      const k = l.documentno;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return Array.from(m.entries());
  }, [lines]);

  async function handleClose(line: ClosableLine) {
    const text = reason.trim();
    if (!text) {
      setRowError((r) => ({ ...r, [line.nvt_t_requisitionline_id]: 'Enter a reason first.' }));
      return;
    }
    if (
      !window.confirm(
        `Close line ${line.nvt_t_requisitionline_id} (${line.skucode ?? '—'}, qty ${line.qty}) ` +
          `on ${line.documentno}?\n\nThis retires the line on the document. It cannot be undone ` +
          `from here.`,
      )
    )
      return;

    setBusyId(line.nvt_t_requisitionline_id);
    setRowError((r) => {
      const n = { ...r };
      delete n[line.nvt_t_requisitionline_id];
      return n;
    });

    try {
      const res = await closeIprLine(line.nvt_t_requisitionline_id, text);
      setClosed((c) => [...c, `${res.documentno} · line ${res.nvt_t_requisitionline_id}`]);
      // Re-read rather than splicing locally: the server decides eligibility, and
      // a refusal elsewhere should surface immediately rather than after a reload.
      await load({ silent: true });
    } catch (e) {
      setRowError((r) => ({
        ...r,
        [line.nvt_t_requisitionline_id]:
          e instanceof Error ? e.message : 'Failed to close the line.',
      }));
      await load({ silent: true });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card stack">
          <h1 style={{ margin: 0 }}>Close IPR-BOQ Lines</h1>
          <p style={{ margin: '4px 0 0', color: '#5c6672', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Requisition lines posted through the retired legacy route, where the BOQ budget was
            never drawn down. Closing retires the line on its IPR-BOQ document — the BOQ budget
            itself is not touched, because nothing was ever consumed from it.
          </p>

          <div
            style={{
              border: '1px solid #fcd34d',
              background: '#fffbeb',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: '0.83rem',
              color: '#78350f',
              lineHeight: 1.55,
            }}
          >
            <b>Why this matters now.</b> Closing does not stop the item being requisitioned
            again — that is driven by the BOQ budget, which still reads as available. What it
            prevents is a buyer raising a purchase order against a requisition the budget knows
            nothing about. Once a line is purchase-ordered, no ERP action can repair it and it
            needs a manual data fix instead.
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.85rem', color: '#5c6672' }}>
              <b style={{ color: '#1a1d21', fontSize: '1.05rem' }}>{lines.length}</b> line
              {lines.length === 1 ? '' : 's'} across{' '}
              <b style={{ color: '#1a1d21' }}>{byDoc.length}</b> document
              {byDoc.length === 1 ? '' : 's'}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || busyId !== null}
              style={btnGhost}
            >
              Refresh
            </button>
          </div>

          <label style={{ display: 'block', fontSize: '0.82rem', color: '#5c6672' }}>
            Reason — written to the line and its closure record
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busyId !== null}
              maxLength={255}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '8px 10px',
                border: '1px solid #d0dbe3',
                borderRadius: 6,
                fontSize: '0.88rem',
              }}
            />
          </label>

          {closed.length > 0 && (
            <div
              style={{
                border: '1px solid #a7d5bb',
                background: '#f0f6f2',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: '0.83rem',
                color: '#1f5c3d',
              }}
            >
              <b>Closed {closed.length} line{closed.length === 1 ? '' : 's'}</b>
              <div style={{ marginTop: 4, fontSize: '0.78rem', lineHeight: 1.6 }}>
                {closed.join(' · ')}
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                border: '1px solid #e8b4ab',
                background: '#fbf1ef',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: '0.85rem',
                color: '#8c2f1f',
              }}
            >
              {error}
            </div>
          )}

          {loading && <p style={{ color: '#8b95a1', fontSize: '0.88rem' }}>Loading…</p>}

          {!loading && !error && lines.length === 0 && (
            <div
              style={{
                border: '1px solid #e9edf1',
                borderRadius: 8,
                padding: '24px 16px',
                textAlign: 'center',
                color: '#5c6672',
              }}
            >
              <b style={{ color: '#1a1d21' }}>Nothing left to close</b>
              <div style={{ fontSize: '0.83rem', marginTop: 4 }}>
                No legacy IPR-BOQ lines are waiting. Lines that are purchase-ordered, or whose
                budget was actually drawn, never appear here — those need a different remedy.
              </div>
            </div>
          )}

          {byDoc.map(([docNo, rows]) => (
            <div key={docNo} style={{ border: '1px solid #e9edf1', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  background: '#f7f9fa',
                  borderBottom: '1px solid #e9edf1',
                  padding: '8px 12px',
                }}
              >
                <b style={{ fontSize: '0.9rem' }}>{docNo}</b>
                <span style={{ color: '#8b95a1', fontSize: '0.78rem', marginLeft: 8 }}>
                  {rows[0].project_name} · org {rows[0].ad_org_id} · {rows[0].date_requisition} ·{' '}
                  {rows.length} line{rows.length === 1 ? '' : 's'}
                </span>
              </div>

              {rows.map((line) => {
                const busy = busyId === line.nvt_t_requisitionline_id;
                const err = rowError[line.nvt_t_requisitionline_id];
                return (
                  <div
                    key={line.nvt_t_requisitionline_id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      padding: '9px 12px',
                      borderBottom: '1px solid #f2f5f7',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.87rem', fontWeight: 500 }}>
                        {line.item_name ?? line.skucode ?? `Line ${line.nvt_t_requisitionline_id}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#8b95a1', marginTop: 2 }}>
                        {line.skucode ?? '—'}
                        {line.unit ? ` · ${line.unit}` : ''} · qty {line.qty} · BOQ line{' '}
                        {line.wip_t_bomline_id} (budget {line.bom_qty}, drawn {line.drawn})
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#8b95a1', marginTop: 1 }}>
                        {line.scope_name} › {line.stage_name}
                      </div>
                      {err && (
                        <div style={{ fontSize: '0.76rem', color: '#8c2f1f', marginTop: 4, lineHeight: 1.5 }}>
                          {err}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleClose(line)}
                      disabled={busy || busyId !== null}
                      style={btnPrimary}
                    >
                      {busy ? 'Closing…' : 'Close line'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: '#8a6a3f',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '7px 14px',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnGhost: React.CSSProperties = {
  background: '#fff',
  color: '#5c6672',
  border: '1px solid #d0dbe3',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: '0.8rem',
  cursor: 'pointer',
};
