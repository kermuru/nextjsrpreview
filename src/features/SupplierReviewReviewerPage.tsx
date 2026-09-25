'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  getReviewer,
  searchEmployees,
  sendForDocument,
  setEnabled,
  setReviewer,
  type EmployeeHit,
  type ReviewerSetting,
  type SendResult,
} from '@/services/supplier-review-reviewer';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7',
};

const FONT = 'Nunito, sans-serif';

/** Characters needed before a search fires, and how long to wait after typing. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 350;

/**
 * Who receives the photographer review DM.
 *
 * Search for a colleague, press Set. The link that goes out can write a review
 * under the recipient's name, so the choice matters: the DM is only ever opened
 * against the person named here, and their TAPS name is what gets stamped on
 * the review.
 *
 * Two things are deliberately visible rather than hidden. A person who has not
 * linked Discord in the mobile app can still be set, but is shown as
 * unreachable — nothing can be delivered to them until they link. And the
 * automation's own master switch is shown, because a correctly-set reviewer
 * still receives nothing while the feature is off.
 */
export default function SupplierReviewReviewerPage() {
  const [setting, setSetting] = useState<ReviewerSetting | null>(null);
  const [query, setQuery]     = useState('');
  const [hits, setHits]       = useState<EmployeeHit[] | null>(null);
  const [searching, setSearch]= useState(false);
  const [busyId, setBusyId]   = useState<number | null>(null);
  const [togglingAuto, setToggling] = useState(false);
  const [docNo, setDocNo]     = useState('');
  const [sending, setSending] = useState<'preview' | 'send' | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [ok, setOk]           = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);

  const load = useCallback(() => {
    getReviewer()
      .then(setSetting)
      .catch((e) => setErr(isApiError(e) ? e.message : 'Could not load the current reviewer.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounced search. A stale response can outrun a newer one, so each run
  // marks itself cancelled on cleanup rather than writing late results.
  useEffect(() => {
    const q = query.trim();

    if (q.length < MIN_QUERY) {
      setHits(null);
      setSearch(false);
      return;
    }

    let cancelled = false;
    setSearch(true);

    const timer = setTimeout(() => {
      searchEmployees(q)
        .then((rows) => { if (!cancelled) setHits(rows); })
        .catch((e) => {
          if (!cancelled) {
            setHits([]);
            setErr(isApiError(e) ? e.message : 'Search failed.');
          }
        })
        .finally(() => { if (!cancelled) setSearch(false); });
    }, DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  async function toggleAutomation(next: boolean) {
    if (togglingAuto || !setting) return;

    // Only the consequential direction asks. Turning it OFF is always safe —
    // it stops delivery and nothing else.
    if (next) {
      const who = setting.reviewer_name ?? 'the configured reviewer';
      const proceed = window.confirm(
        'Turn the photographer review automation ON?\n\n'
        + `• Every day at 4:00 PM, ${who} is DM'd a link for each photographer job interred the day before\n`
        + '• Each link can submit one review under their name and never expires\n'
        + '• Delivery failures are reported to the interment SMS-failure Discord channel\n\n'
        + 'Turn it on?',
      );
      if (!proceed) return;
    }

    setToggling(true);
    setOk(null);
    setErr(null);

    try {
      const res = await setEnabled(next);
      setSetting(res.data);
      setOk(res.message);
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'Could not change the automation.');
    } finally {
      setToggling(false);
    }
  }

  async function manualSend(dryRun: boolean) {
    const doc = docNo.trim();
    if (!doc || sending || !setting) return;

    if (!dryRun) {
      const who = setting.reviewer_name ?? 'the reviewer';
      const proceed = window.confirm(
        `Send the photographer review link for ${doc} now?\n\n`
        + `• ${who} gets a Discord DM immediately\n`
        + '• The link can submit one review under their name and never expires\n\n'
        + 'Send it?',
      );
      if (!proceed) return;
    }

    setSending(dryRun ? 'preview' : 'send');
    setOk(null);
    setErr(null);
    setSendResult(null);

    try {
      const res = await sendForDocument(doc, dryRun);
      setSendResult(res.data);
      setOk(res.message);
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'The manual send failed.');
    } finally {
      setSending(null);
    }
  }

  async function choose(hit: EmployeeHit) {
    if (busyId !== null) return;

    if (!hit.discord_linked) {
      const proceed = window.confirm(
        `${hit.name} has not linked Discord in the mobile app.\n\n`
        + 'You can still set them, but no review link can be delivered until they link. '
        + 'Each run will report the problem instead of sending.\n\nSet them anyway?',
      );
      if (!proceed) return;
    }

    setBusyId(hit.s_bpartner_employee_id);
    setOk(null);
    setErr(null);

    try {
      const res = await setReviewer(hit.s_bpartner_employee_id);
      setSetting(res.data);
      setOk(res.message);
      setQuery('');
      setHits(null);
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'Could not save the reviewer.');
    } finally {
      setBusyId(null);
    }
  }

  const current = setting;
  const currentId = current?.s_bpartner_employee_id ?? null;

  return (
    <div style={{ fontFamily: FONT, padding: 24, maxWidth: 780, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/" style={{ fontSize: 12, color: C.muted, textDecoration: 'none' }}>‹ Home</Link>
        <h1 style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 800, color: C.active }}>
          Photographer Review — Recipient
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
          Who gets the Discord DM to rate the photographer, the day after an interment.
        </p>
      </div>

      {err && <Banner tone="err">{err}</Banner>}
      {ok && <Banner tone="ok">{ok}</Banner>}

      {!current ? (
        <p style={{ fontSize: 13, color: C.muted }}>Loading…</p>
      ) : (
        <>
          {/* ── Master switch ─────────────────────────────────────────────── */}
          <section style={{ ...cardStyle, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Automation</div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.textSub }}>
                  {current.feature_enabled
                    ? 'On — the 4:00 PM run sends a review link for each photographer job interred the day before.'
                    : 'Off — the run still reports what it would have sent, but creates no link and delivers nothing.'}
                </p>
                {current.enabled_source === 'config' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: C.muted }}>
                    This is the deployed default — nobody has switched it here yet.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => toggleAutomation(!current.feature_enabled)}
                disabled={togglingAuto}
                aria-pressed={current.feature_enabled}
                style={{
                  padding: '9px 20px', borderRadius: 999, border: 'none',
                  background: current.feature_enabled ? C.red : C.green,
                  color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: FONT,
                  cursor: togglingAuto ? 'not-allowed' : 'pointer',
                  opacity: togglingAuto ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {togglingAuto
                  ? 'Saving…'
                  : current.feature_enabled ? 'Disable automation' : 'Enable automation'}
              </button>
            </div>
          </section>

          {/* ── Current recipient ─────────────────────────────────────────── */}
          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontWeight: 700 }}>
              Currently receiving
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: C.text }}>
                {current.reviewer_name ?? 'Nobody set'}
              </span>
              {current.discord.linked
                ? <Chip tone="ok">Discord linked{current.discord.username ? ` · ${current.discord.username}` : ''}</Chip>
                : <Chip tone="err">Not reachable on Discord</Chip>}
            </div>

            <p style={{ margin: '0 0 4px', fontSize: 12.5, color: C.textSub }}>
              {current.source === 'setting'
                ? 'Chosen on this screen.'
                : 'Falling back to the configured default — nobody has been chosen here yet.'}
              {current.updated_by ? ` Last set by ${current.updated_by}.` : ''}
            </p>

            {!current.discord.linked && (
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.red }}>
                No review link can be delivered until this person opens the mobile app and links
                their Discord account. Each run reports the problem instead of sending.
              </p>
            )}

          </section>

          {/* ── Search and set ────────────────────────────────────────────── */}
          <section style={{ ...cardStyle, marginTop: 14 }}>
            <label htmlFor="employee-search" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.textSub, marginBottom: 6 }}>
              Change recipient
            </label>
            <input
              id="employee-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a name or employee number…"
              autoComplete="off"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14,
                fontFamily: FONT, color: C.text, outline: 'none',
              }}
            />

            {query.trim().length > 0 && query.trim().length < MIN_QUERY && (
              <p style={hintStyle}>Keep typing — at least {MIN_QUERY} characters.</p>
            )}

            {searching && <p style={hintStyle}>Searching…</p>}

            {hits && hits.length === 0 && !searching && (
              <p style={hintStyle}>No active employee matches that.</p>
            )}

            {hits && hits.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {hits.map((hit, i) => {
                  const isCurrent = hit.s_bpartner_employee_id === currentId;

                  return (
                    <li
                      key={hit.s_bpartner_employee_id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                        background: isCurrent ? C.bg : '#fff',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{hit.name}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          {hit.employee_no ?? '—'}
                          {hit.discord_linked
                            ? ` · Discord${hit.discord_username ? `: ${hit.discord_username}` : ' linked'}`
                            : ' · no Discord linked'}
                        </div>
                      </div>

                      {isCurrent ? (
                        <Chip tone="ok">Current</Chip>
                      ) : (
                        <button
                          type="button"
                          onClick={() => choose(hit)}
                          disabled={busyId !== null}
                          style={{
                            padding: '7px 16px', borderRadius: 7, border: 'none',
                            background: hit.discord_linked ? C.primary : C.amber,
                            color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
                            cursor: busyId !== null ? 'not-allowed' : 'pointer',
                            opacity: busyId !== null ? 0.6 : 1,
                          }}
                        >
                          {busyId === hit.s_bpartner_employee_id ? 'Setting…' : 'Set'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p style={{ ...hintStyle, marginTop: 14 }}>
              Links already sent keep the reviewer they were created with. A change here applies
              from the next run onward.
            </p>
          </section>

          {/* ── Manual send for one order ─────────────────────────────────── */}
          <section style={{ ...cardStyle, marginTop: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Send for one order</div>
            <p style={{ margin: '4px 0 12px', fontSize: 12.5, color: C.textSub }}>
              For an order the 4:00 PM run has already gone past. Everything else is the same —
              the order still needs an accepted photographer, a live interment order whose date has
              passed, and no link sent for it already.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={docNo}
                onChange={(e) => setDocNo(e.target.value.toUpperCase())}
                placeholder="NLIO00948"
                autoComplete="off"
                style={{
                  flex: 1, minWidth: 180, boxSizing: 'border-box', padding: '10px 12px',
                  border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14,
                  fontFamily: FONT, color: C.text, outline: 'none',
                }}
              />

              <button
                type="button"
                onClick={() => manualSend(true)}
                disabled={!docNo.trim() || sending !== null}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 700,
                  fontFamily: FONT,
                  cursor: !docNo.trim() || sending ? 'not-allowed' : 'pointer',
                  opacity: !docNo.trim() || sending ? 0.6 : 1,
                }}
              >
                {sending === 'preview' ? 'Checking…' : 'Preview'}
              </button>

              <button
                type="button"
                onClick={() => manualSend(false)}
                disabled={!docNo.trim() || sending !== null || !current.feature_enabled}
                title={current.feature_enabled ? undefined : 'Turn the automation on first.'}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: C.primary, color: '#fff', fontSize: 13, fontWeight: 800,
                  fontFamily: FONT,
                  cursor: !docNo.trim() || sending || !current.feature_enabled ? 'not-allowed' : 'pointer',
                  opacity: !docNo.trim() || sending || !current.feature_enabled ? 0.5 : 1,
                }}
              >
                {sending === 'send' ? 'Sending…' : 'Send link'}
              </button>
            </div>

            {!current.feature_enabled && (
              <p style={{ margin: '10px 0 0', fontSize: 12.5, color: C.amber }}>
                Sending is unavailable while the automation is off — that switch means nothing goes
                out, by any route. Preview still works.
              </p>
            )}

            {sendResult && sendResult.rows.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {sendResult.rows.map((row, i) => (
                  <li
                    key={row.assignment_id}
                    style={{
                      padding: '10px 12px', fontSize: 12.5, color: C.textSub,
                      borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: C.text }}>
                      {row.document_no} · {row.service ?? '—'}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      interment {row.date_interment ?? '—'} — {row.status ?? '—'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────────── */

function Banner({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  const ok = tone === 'ok';
  return (
    <div
      style={{
        marginBottom: 14, padding: '10px 12px', borderRadius: 8, fontSize: 13,
        background: ok ? C.greenBg : C.redBg,
        color: ok ? C.green : C.red,
        border: `1px solid ${ok ? C.green : C.red}22`,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  const ok = tone === 'ok';
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
        background: ok ? C.greenBg : C.redBg,
        color: ok ? C.green : C.red,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const cardStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: 16,
  background: '#fff',
};

const hintStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12.5,
  color: C.muted,
};
