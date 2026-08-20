'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getCustodian, getCustodianCandidates, setCustodian, resetCustodian,
} from '@/services/autoboq-custodian';
import type { CustodianState, CustodianCandidate } from '@/services/autoboq-custodian';
import { isApiError } from '@/lib/api';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7',
};

const FONT = 'Nunito, sans-serif';

const TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted,
  background: C.bg, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};
const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 12px', fontSize: 13, color: C.text, ...extra,
});

function fmtWhen(val: string | null) {
  if (!val) return '—';
  const d = new Date(val.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Banner({ tone, children }: { tone: 'ok' | 'err' | 'warn'; children: React.ReactNode }) {
  const map = {
    ok:   { bg: C.greenBg, fg: C.green },
    err:  { bg: C.redBg,   fg: C.red   },
    warn: { bg: C.amberBg, fg: C.amber },
  }[tone];
  return (
    <div style={{ background: map.bg, color: map.fg, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontFamily: FONT, fontWeight: 700 }}>
      {children}
    </div>
  );
}

export default function AutoBoqCustodianPage() {
  const [state, setState]         = useState<CustodianState | null>(null);
  const [cands, setCands]         = useState<CustodianCandidate[]>([]);
  const [search, setSearch]       = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [ok, setOk]               = useState<string | null>(null);
  const [err, setErr]             = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadState = useCallback(() => {
    getCustodian().then(setState).catch(() => setErr('Failed to load the current custodian.'));
  }, []);

  const loadCands = useCallback(() => {
    setLoading(true);
    getCustodianCandidates(debounced)
      .then(setCands)
      .catch(() => setErr('Failed to load candidates.'))
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => { loadState(); }, [loadState]);
  useEffect(() => { loadCands(); }, [loadCands]);

  async function handleSet(c: CustodianCandidate) {
    if (!window.confirm(
      `Set the Auto BOQ stage custodian to ${c.name}?\n\n`
      + 'This applies to newly generated BOQs only. Stages already in SAERP keep their existing custodian.'
    )) return;

    setSaving(c.bpar_i_person_id); setOk(null); setErr(null);
    try {
      const r = await setCustodian(c.bpar_i_person_id);
      setState(r.data);
      setOk(r.message ?? `Custodian set to ${c.name}.`);
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'Failed to set the custodian.');
    } finally {
      setSaving(null);
    }
  }

  async function handleReset() {
    if (!window.confirm('Clear the override and fall back to the built-in default custodian?')) return;
    setResetting(true); setOk(null); setErr(null);
    try {
      const r = await resetCustodian();
      setState(r.data);
      setOk(r.message ?? 'Override cleared.');
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'Failed to clear the override.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ fontFamily: FONT, padding: 24, maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/" style={{ fontSize: 12, color: C.muted, textDecoration: 'none' }}>‹ Home</Link>
        <h1 style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 800, color: C.active }}>Auto BOQ — Stage Custodian</h1>
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
          The person Auto BOQ writes as custodian on every project scope stage it creates.
        </p>
      </div>

      {/* ── current setting ─────────────────────────────────────────── */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '10px 14px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted }}>
          Current
        </div>
        <div style={{ padding: 16 }}>
          {!state ? (
            <span style={{ fontSize: 13, color: C.muted }}>Loading…</span>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: C.text }}>
                  {state.custodian_name ?? `Person ${state.resolved_person_id}`}
                </span>
                <span style={{ fontSize: 12, color: C.muted }}>person #{state.resolved_person_id}</span>
                {state.is_default && (
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.amber, background: C.amberBg, padding: '2px 8px', borderRadius: 999 }}>
                    built-in default
                  </span>
                )}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                {state.is_default
                  ? <>No custodian has been chosen, so Auto BOQ is using the code default (person #{state.default_person_id}).</>
                  : <>Set by <strong style={{ color: C.textSub }}>{state.updated_by ?? 'unknown'}</strong> on {fmtWhen(state.updated_at)}. Default would be person #{state.default_person_id}.</>}
              </div>
              {!state.is_default && (
                <button onClick={handleReset} disabled={resetting}
                  style={{ marginTop: 12, padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, cursor: resetting ? 'default' : 'pointer', fontSize: 12, fontFamily: FONT, fontWeight: 700 }}>
                  {resetting ? 'Clearing…' : 'Revert to default'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {(ok || err) && (
        <div style={{ marginBottom: 16 }}>
          {ok  && <Banner tone="ok">{ok}</Banner>}
          {err && <Banner tone="err">{err}</Banner>}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Banner tone="warn">
          Changing this affects newly generated BOQs only — stages already written to SAERP keep the custodian they were created with.
        </Banner>
      </div>

      {/* ── candidate picker ────────────────────────────────────────── */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted }}>Choose custodian</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name…"
            style={{ flex: 1, minWidth: 200, padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: FONT, outline: 'none' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Name</th>
                <th style={TH}>Person ID</th>
                <th style={TH}>Usercode</th>
                <th style={{ ...TH, textAlign: 'right' }}>Stages</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={TD({ color: C.muted, textAlign: 'center', padding: 24 })}>Loading…</td></tr>
              )}
              {!loading && cands.length === 0 && (
                <tr><td colSpan={5} style={TD({ color: C.muted, textAlign: 'center', padding: 24 })}>
                  {search ? 'No match. Note SAERP spellings vary — try a shorter fragment.' : 'No candidates.'}
                </td></tr>
              )}
              {!loading && cands.map(c => {
                const isCurrent = state?.resolved_person_id === c.bpar_i_person_id;
                return (
                  <tr key={c.bpar_i_person_id} style={{ borderBottom: `1px solid ${C.border}`, background: isCurrent ? C.greenBg : undefined }}>
                    <td style={TD({ fontWeight: isCurrent ? 800 : 600 })}>
                      {c.name}
                      {isCurrent && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: C.green }}>current</span>}
                    </td>
                    <td style={TD({ color: C.muted, fontVariantNumeric: 'tabular-nums' })}>{c.bpar_i_person_id}</td>
                    <td style={TD({ color: C.muted, fontVariantNumeric: 'tabular-nums' })}>{c.usercode}</td>
                    <td style={TD({ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c.stage_count > 0 ? C.text : C.muted })}>{c.stage_count}</td>
                    <td style={TD({ textAlign: 'right' })}>
                      <button
                        onClick={() => handleSet(c)}
                        disabled={isCurrent || saving !== null}
                        style={{
                          padding: '5px 14px', borderRadius: 6, border: 'none',
                          background: isCurrent ? C.bg : C.active,
                          color: isCurrent ? C.muted : '#fff',
                          cursor: isCurrent || saving !== null ? 'default' : 'pointer',
                          fontSize: 12, fontFamily: FONT, fontWeight: 700, whiteSpace: 'nowrap',
                        }}>
                        {saving === c.bpar_i_person_id ? 'Setting…' : isCurrent ? 'In use' : 'Set'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '10px 14px', background: C.bg, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
          Only <strong>active</strong> persons holding a SAERP <strong>usercode</strong> are listed. SAERP keeps several
          records per person (payee, vendor, staff) and only the staff record has a usercode — selecting one of the others
          would set a custodian the ERP does not recognise as a login. The <strong>Stages</strong> count shows how many
          scope stages already name that person, which is the quickest way to spot the record actually in use.
        </div>
      </div>
    </div>
  );
}
