'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isApiError, formatDate } from '@/lib/api';
import { logout, getUserName, login, setToken, setUser } from '@/lib/auth';
import { getAllReviews, type ReviewRow } from '@/services/supplier-review-monitor';

/** Only this person may open the review board. Compared case- and spacing-insensitively. */
const ALLOWED_REVIEWER = 'KERVIN FUGATA';

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Display name from a freshly-returned login payload. Mirrors lib/auth's
 * getUserName(), but reads the response directly — at this point nothing has
 * been written to localStorage yet, because we only persist a session that
 * passes the name check below.
 */
function nameFromPayload(user: Record<string, unknown> | undefined): string {
  if (!user) return '';
  const s = (k: string) => (typeof user[k] === 'string' ? (user[k] as string).trim() : '');
  const full = [s('firstname'), s('lastname')].filter(Boolean).join(' ').trim();
  return full || s('name1') || s('name') || s('fullname') || s('username');
}

function Spinner() {
  return (
    <span
      style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--muted)', borderRadius: '50%', animation: 'srm-spin 0.7s linear infinite' }}
    />
  );
}

function Stars({ n }: { n: number }) {
  const safe = Math.max(0, Math.min(5, n));
  return (
    <span style={{ color: '#B18343', fontSize: '0.9rem', letterSpacing: 1 }} title={`${safe} of 5`}>
      {'★'.repeat(safe)}
      <span style={{ color: 'var(--border)' }}>{'☆'.repeat(5 - safe)}</span>
    </span>
  );
}

/**
 * Login gate for this page. Credentials are checked by the backend as usual,
 * and then the returned identity must match ALLOWED_REVIEWER — a valid login
 * belonging to anyone else is refused here and its token is never stored, so
 * signing in as another user does not grant access to the board.
 */
function ReviewLogin({ signedInAs, onSuccess }: { signedInAs: string; onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setBusy(true); setError('');
    try {
      const res = await login(username.trim(), password);

      if (!res.token) {
        setError(res.message ?? 'Login failed.');
        return;
      }

      // Credentials were valid — but this page is for one person only.
      if (normalise(nameFromPayload(res.user)) !== ALLOWED_REVIEWER) {
        setError(`This page is restricted to ${ALLOWED_REVIEWER}.`);
        setPassword('');
        return;   // token deliberately not stored
      }

      setToken(res.token);
      setUser(res.user ?? null);
      onSuccess();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 380 }}>
        <div className="page-card">
          <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>🔒</div>
          <h1 style={{ margin: '0 0 2px', fontSize: '1.15rem', color: 'var(--accent)' }}>Supplier Reviews</h1>
          <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            Restricted to <b>{ALLOWED_REVIEWER}</b>.
            {signedInAs && normalise(signedInAs) !== ALLOWED_REVIEWER
              ? <> You are currently signed in as <b>{signedInAs}</b>.</>
              : null}
          </p>

          <form onSubmit={submit}>
            <label style={labelStyle}>Username</label>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              style={loginInput}
              autoComplete="username"
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              style={loginInput}
              autoComplete="current-password"
            />
            {error && <div style={errorStyle}>{error}</div>}
            <button
              type="submit"
              disabled={busy}
              style={{ ...primaryBtn, width: '100%', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}
            >
              {busy && <Spinner />}{busy ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes srm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type RatingFilter = 0 | 1 | 2 | 3 | 4 | 5;

export default function SupplierReviewMonitorPage() {
  const [who, setWho] = useState<string | null>(null);   // null = still reading localStorage
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const [rating, setRating] = useState<RatingFilter>(0);
  const [search, setSearch] = useState('');

  useEffect(() => { setWho(getUserName()); }, []);

  const allowed = who !== null && normalise(who) === ALLOWED_REVIEWER;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setProgress({ done: 0, total: 0 });
    try {
      const data = await getAllReviews((done, total) => setProgress({ done, total }));
      setRows(data);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Failed to load reviews.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (rating && r.rating !== rating) return false;
      if (!q) return true;
      return (
        (r.document_no ?? '').toLowerCase().includes(q) ||
        (r.supplier_name ?? '').toLowerCase().includes(q) ||
        (r.reviewed_by ?? '').toLowerCase().includes(q) ||
        (r.comment ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, rating, search]);

  const avg = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  }, [rows]);

  /** Rating histogram + the suppliers dragging the average down. */
  const stats = useMemo(() => {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const bySupplier = new Map<string, { total: number; count: number }>();

    for (const r of rows) {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating] += 1;
      const key = r.supplier_name?.trim() || '—';
      const acc = bySupplier.get(key) ?? { total: 0, count: 0 };
      acc.total += r.rating;
      acc.count += 1;
      bySupplier.set(key, acc);
    }

    // Needs at least 2 reviews to be worth flagging.
    const worst = [...bySupplier.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([name, v]) => ({ name, avg: v.total / v.count, count: v.count }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);

    return { dist, worst, lowCount: rows.filter((r) => r.rating <= 2).length };
  }, [rows]);

  if (who === null) return null;              // avoid a flash before we know who is signed in
  if (!allowed) return <ReviewLogin signedInAs={who} onSuccess={() => setWho(getUserName())} />;

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 940 }}>
        <div className="page-card">

          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 2px', fontSize: '1.15rem', color: 'var(--accent)' }}>Supplier Reviews</h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                {rows.length} review{rows.length === 1 ? '' : 's'}
                {avg !== null && <> · {avg.toFixed(2)} average</>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => load()} disabled={loading} style={ghostBtn}>{loading ? 'Loading…' : 'Refresh'}</button>
              <button onClick={() => logout()} style={ghostBtn}>Log out</button>
            </div>
          </div>

          {/* ── Summary: distribution + watchlist ── */}
          {!loading && rows.length > 0 && (
            <div style={{ display: 'flex', gap: 12, margin: '14px 0 4px', flexWrap: 'wrap' }}>
              <div style={{ ...panel, flex: '1 1 260px' }}>
                <div style={panelTitle}>Rating spread</div>
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = stats.dist[n] ?? 0;
                  const pctOf = rows.length ? (c / rows.length) * 100 : 0;
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', width: 20 }}>{n}★</span>
                      <div style={{ flex: 1, height: 7, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pctOf}%`, height: '100%', background: n <= 2 ? '#b91c1c' : n === 3 ? '#B18343' : '#166534' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', width: 26, textAlign: 'right' }}>{c}</span>
                    </div>
                  );
                })}
                {stats.lowCount > 0 && (
                  <div style={{ marginTop: 9, fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>
                    {stats.lowCount} review{stats.lowCount === 1 ? '' : 's'} at 2★ or below
                  </div>
                )}
              </div>

              {stats.worst.length > 0 && (
                <div style={{ ...panel, flex: '1 1 260px' }}>
                  <div style={panelTitle}>Lowest rated · 2+ reviews</div>
                  {stats.worst.map((s) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ flex: 1, fontSize: '0.76rem', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{s.count}×</span>
                      <span style={{ ...badge, background: s.avg <= 2.5 ? '#fee2e2' : '#e7e5e4', color: s.avg <= 2.5 ? '#b91c1c' : '#44403c' }}>
                        {s.avg.toFixed(1)}★
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Filters ── */}
          <div style={{ display: 'flex', gap: 8, margin: '14px 0 12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {([0, 5, 4, 3, 2, 1] as RatingFilter[]).map((r) => (
              <button key={r} onClick={() => setRating(r)} style={chip(rating === r)}>
                {r === 0 ? 'All ratings' : `${r}★`}
              </button>
            ))}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search NLIO, supplier, reviewer, comment…"
              style={{ ...inputStyle, flex: '1 1 240px', minWidth: 200 }}
            />
            {(search || rating) && (
              <button onClick={() => { setSearch(''); setRating(0); }} style={linkBtn}>Clear</button>
            )}
          </div>

          {/* ── Progress / states ── */}
          {loading && progress.total > 0 && (
            <div style={{ margin: '0 0 12px' }}>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 5 }}>
                Reading NLIO {progress.done} of {progress.total}…
              </div>
            </div>
          )}

          {error && <div style={errorStyle}>{error}</div>}
          {loading && progress.total === 0 && <div style={emptyStyle}><Spinner /> Loading…</div>}
          {!loading && !error && rows.length === 0 && <div style={emptyStyle}>No reviews have been submitted yet.</div>}
          {!loading && !error && rows.length > 0 && shown.length === 0 && <div style={emptyStyle}>No reviews match this filter.</div>}

          {/* ── Rows ── */}
          {!loading && shown.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map((r) => (
                <div key={r.id} style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Stars n={r.rating} />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent)' }}>{r.document_no}</span>
                    {r.item_name && <span style={{ ...badge, background: '#e0f2fe', color: '#075985' }}>{r.item_name}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {formatDate(r.created_at ?? undefined) || '—'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: '0.76rem', color: 'var(--muted)' }}>
                    <span><b style={{ color: 'var(--accent)' }}>Supplier:</b> {r.supplier_name || '—'}</span>
                    <span><b style={{ color: 'var(--accent)' }}>Reviewed by:</b> {r.reviewed_by || '—'}</span>
                  </div>

                  {r.comment ? (
                    <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: 'var(--accent)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {r.comment}
                    </p>
                  ) : (
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                      No comment left.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && shown.length > 0 && shown.length !== rows.length && (
            <p style={{ margin: '12px 0 0', fontSize: '0.74rem', color: 'var(--muted)' }}>
              Showing {shown.length} of {rows.length}.
            </p>
          )}
        </div>
      </div>
      <style>{`@keyframes srm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const badge: React.CSSProperties = { borderRadius: 6, padding: '3px 9px', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' };
const panel: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', background: '#fff' };
const panelTitle: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 2 };
const errorStyle: React.CSSProperties = { marginTop: 12, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 11px', fontSize: '0.8rem' };
const emptyStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '26px 8px', color: 'var(--muted)', fontSize: '0.88rem' };
const rowStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' };
const ghostBtn: React.CSSProperties = { background: '#fff', color: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' };
const linkBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.78rem', padding: 0 };
const inputStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: '0.8rem', background: '#fff', color: 'var(--accent)' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 5 };
const loginInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: '0.88rem', background: '#fff' };
const primaryBtn: React.CSSProperties = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };
const chip = (active: boolean): React.CSSProperties => ({ background: active ? 'var(--accent)' : '#fff', color: active ? '#fff' : 'var(--muted)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 999, padding: '6px 14px', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' });
