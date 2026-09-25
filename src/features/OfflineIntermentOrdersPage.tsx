'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isApiError } from '@/lib/api';
import { fetchOrderDetail, loadOfflineView } from '@/services/interment-offline-orders';
import type {
  AssembledOrder,
  IntermentOrderRow,
  OfflineView,
  OrderDetail,
} from '@/services/interment-offline-orders';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7', blue: '#2563eb', blueBg: '#dbeafe',
};

const FONT = 'Nunito, sans-serif';

/** A refresh is ~15 requests across three endpoints, and orders arrive hourly at most. */
const POLL_MS = 300_000;

const PAGE_SIZE = 40;

type Tab = 'offline' | 'portal' | 'all';

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'offline', label: 'Offline',       hint: 'In SAERP with no portal application row — booked outside the online form. What this page is for.' },
  { key: 'portal',  label: 'Portal-booked', hint: 'Has a row in wbs_i_interment_applications.' },
  { key: 'all',     label: 'All',           hint: 'Every order either endpoint could see.' },
];

/**
 * Monitor for interment orders that were NOT booked through the online portal.
 *
 * OFFLINE = present in SAERP, absent from wbs_i_interment_applications. That
 * test spans two databases and no endpoint joins them, so the page assembles it
 * from three read-only endpoints (orders with a project, upcoming orders, portal
 * applications) and does the anti-join here. See the service for why the
 * backend's own `source=erp` filter cannot be used for this.
 *
 * READS ONLY — every control is a filter; nothing here writes.
 */
export default function OfflineIntermentOrdersPage() {
  const [view, setView] = useState<OfflineView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(true);

  const [tab, setTab] = useState<Tab>('offline');
  const [query, setQuery] = useState('');
  const [noProjectOnly, setNoProjectOnly] = useState(false);
  const [page, setPage] = useState(1);

  // ── Detail drawer ────────────────────────────────────────────────────
  // Opened per order and fetched lazily: three more by-document calls that the
  // list itself has no use for.
  const [openOrder, setOpenOrder] = useState<AssembledOrder | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  useEffect(() => {
    if (!openOrder) { setDetail(null); setDetailErr(null); return; }

    let cancelled = false;
    setDetailBusy(true);
    setDetail(null);
    setDetailErr(null);

    fetchOrderDetail(openOrder.io_number)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailErr(isApiError(e) ? e.message : 'Could not load this order.'); })
      .finally(() => { if (!cancelled) setDetailBusy(false); });

    return () => { cancelled = true; };
  }, [openOrder]);

  // Esc closes the drawer — it covers the table, so there must be a way out
  // that does not require finding the button.
  useEffect(() => {
    if (!openOrder) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenOrder(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openOrder]);

  const load = useCallback(() => {
    setBusy(true);
    loadOfflineView()
      .then((v) => { setView(v); setErr(null); })
      .catch((e) => setErr(isApiError(e) ? e.message : 'Could not load interment orders.'))
      .finally(() => { setLoaded(true); setBusy(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [live, load]);

  const pool = useMemo<AssembledOrder[]>(() => {
    if (!view) return [];
    return tab === 'offline' ? view.offline : tab === 'portal' ? view.portal : view.orders;
  }, [view, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return pool.filter((o) => {
      if (noProjectOnly && o.projects.length > 0) return false;
      if (!q) return true;
      if (o.io_number.toLowerCase().includes(q)) return true;
      if ((o.informant ?? '').toLowerCase().includes(q)) return true;
      return o.projects.some((p) =>
        [p.project_name, p.project_doc_no, p.project_status].some((v) => (v ?? '').toLowerCase().includes(q)),
      );
    });
  }, [pool, query, noProjectOnly]);

  useEffect(() => { setPage(1); }, [tab, query, noProjectOnly]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, lastPage);
  const visible = useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe],
  );

  const noProjectCount = useMemo(() => pool.filter((o) => o.projects.length === 0).length, [pool]);
  const flaggedCount = useMemo(() => filtered.filter((o) => o.flagged).length, [filtered]);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <h1 style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 800, color: C.active }}>
          Offline interment orders — monitor
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>
          Orders that exist in SAERP but have <strong>no portal application</strong> — booked outside the
          online form. One row per order. Read-only.
        </p>

        {err && (
          <div style={{ background: C.redBg, color: C.red, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            {err}
          </div>
        )}

        {view?.truncated && (
          <div style={{ background: C.amberBg, color: C.amber, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
            Partial load — a source grew past this page&apos;s fetch cap, so the counts below are a
            subset. Raise <code>MAX_PAGES</code> in the service.
          </div>
        )}

        {view && <CoverageBanner view={view} />}

        {/* ── Totals ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Tile label="offline orders" value={view ? String(view.offline.length) : '—'} accent={C.primary}
                hint="In SAERP with no portal application row. The population this page monitors." />
          <Tile label="portal-booked" value={view ? String(view.portal.length) : '—'}
                hint="Orders matched to a row in wbs_i_interment_applications by io_number." />
          <Tile label="in view" value={loaded ? String(filtered.length) : '—'}
                hint="Orders matching the current tab, search and filters." />
          <Tile label="flagged in view" value={loaded ? String(flaggedCount) : '—'}
                accent={flaggedCount > 0 ? C.amber : undefined}
                hint="Orders whose BOQ cross-reference is Double BOQ or a log that never generated. Whole-filter count, not page-scoped." />
        </div>

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NLIO, informant, project…"
            style={{
              flex: '1 1 260px', padding: '8px 10px', fontSize: 13, font: 'inherit',
              border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
            }}
          />

          <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                title={t.hint}
                style={{
                  cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 700,
                  padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${tab === t.key ? C.active : C.border}`,
                  background: tab === t.key ? C.active : '#fff',
                  color: tab === t.key ? '#fff' : C.textSub,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label
            title="Orders with no active WIP project — visible here only because they are upcoming. Worth a look: an interment with no project has no BOQ."
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.textSub }}
          >
            <input type="checkbox" checked={noProjectOnly} onChange={(e) => setNoProjectOnly(e.target.checked)} />
            No project ({noProjectCount})
          </label>

          <button
            onClick={load}
            disabled={busy}
            style={{
              cursor: busy ? 'default' : 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 700,
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: '#fff', color: C.textSub, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Loading…' : 'Refresh'}
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.textSub }}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Live
          </label>
        </div>

        {/* ── Orders ────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflowX: 'auto' }}>
          {!loaded ? (
            <div style={{ padding: 20, fontSize: 13, color: C.muted }}>Loading all three sources…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: C.muted }}>
              {query || noProjectOnly ? 'No orders match these filters.' : 'No orders in this tab.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, textAlign: 'left' }}>
                  {['NLIO', 'Interment', 'Informant', 'Project(s)', 'Status', 'Booking', 'BOQ cross-reference'].map((h) => (
                    <th key={h} style={{ padding: '9px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <Row
                    key={o.io_number}
                    order={o}
                    onOpen={() => setOpenOrder(o)}
                    active={openOrder?.io_number === o.io_number}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pager ─────────────────────────────────────────────────────── */}
        {loaded && filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <PagerButton disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>← Prev</PagerButton>
            <span style={{ fontSize: 12.5, color: C.textSub }}>Page {pageSafe} of {lastPage}</span>
            <PagerButton disabled={pageSafe >= lastPage} onClick={() => setPage(pageSafe + 1)}>Next →</PagerButton>
            <span style={{ fontSize: 12, color: C.muted }}>
              {filtered.length} order{filtered.length === 1 ? '' : 's'} in this filter
            </span>
          </div>
        )}

        <p style={{ marginTop: 14, fontSize: 11.5, color: C.muted, lineHeight: 1.55 }}>
          <strong>Offline means no portal row.</strong> An order is offline here when SAERP has it and
          <code style={{ margin: '0 4px' }}>wbs_i_interment_applications</code> does not, matched on
          <code style={{ margin: '0 4px' }}>io_number</code>. That is a stronger test than the
          <code style={{ margin: '0 4px' }}>created</code> column, which only says which software wrote
          the row — and it also catches orders written by the headless LIO driver, which stamps itself
          like the portal but files no application.
          <br />
          <strong>Not every order is reachable.</strong> The project endpoint inner-joins order →
          project → category, so a past-dated order that never got a project is invisible to it, and the
          upcoming endpoint only recovers future-dated ones. Combined reach on the replica was 852 of
          1,796 orders. Nothing on this page can see the rest; closing that needs a backend endpoint
          that lists orders without requiring a project.
          <br />
          <strong>A missing portal row is not proof of an office booking</strong> — only that no online
          application was filed. Staff filling the web form for a walk-in client still creates one.
        </p>
      </div>

      {openOrder && (
        <DetailDrawer
          order={openOrder}
          detail={detail}
          busy={detailBusy}
          err={detailErr}
          onClose={() => setOpenOrder(null)}
        />
      )}
    </div>
  );
}

/* ── detail drawer ───────────────────────────────────────────────────────── */

/**
 * Everything known about one order, from three by-document endpoints.
 *
 * Sources are fetched independently and any of them may come back empty — the
 * review-link query inner-joins package and variation and restricts to vessel
 * 2/3, so a 404 there is normal for some orders. Whatever arrived is shown, and
 * what did not is named at the bottom rather than silently omitted.
 */
function DetailDrawer({
  order, detail, busy, err, onClose,
}: {
  order: AssembledOrder;
  detail: OrderDetail | null;
  busy: boolean;
  err: string | null;
  onClose: () => void;
}) {
  const head = detail?.occupants[0];
  const lot = detail?.lowerLayer?.lot;
  const below = detail?.lowerLayer?.bottom_layer;

  const lotAddress = lot
    ? `Area ${lot.area_no ?? '?'} · Block ${lot.block_no ?? '?'} · Lot ${lot.lot_no ?? '?'}`
    : null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 40 }}
      />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 96vw)', zIndex: 41,
        background: '#fff', borderLeft: `1px solid ${C.border}`, boxShadow: '-8px 0 24px #00000018',
        overflowY: 'auto', padding: 18, fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: C.active }}>{order.io_number}</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
              {shortDate(order.interment_date)}
              {head?.time_starting ? ` · ${clockOf(head.time_starting)}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 11px',
              borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 4px' }}>
          <Badge
            text={order.hasPortalRow ? 'Portal-booked' : 'Offline'}
            tone={order.hasPortalRow ? 'info' : 'neutral'}
          />
          {order.projects.length === 0 && <Badge text="No project" tone="warn" />}
          {order.flagged && <Badge text="Flagged" tone="warn" />}
          {detail?.lowerLayer?.target?.space_name && (
            <Badge text={detail.lowerLayer.target.space_name} tone="info" />
          )}
        </div>

        {busy && <p style={{ fontSize: 13, color: C.muted }}>Loading details…</p>}
        {err && (
          <div style={{ background: C.redBg, color: C.red, padding: '9px 11px', borderRadius: 8, fontSize: 12.5, margin: '10px 0' }}>
            {err}
          </div>
        )}

        {detail && (
          <>
            <Section title="Order">
              <Field label="Package" value={head?.interment_package} />
              <Field label="Variation" value={head?.variation} />
              <Field label="Interment" value={`${shortDate(head?.date_interment ?? order.interment_date)}${head?.time_starting ? ` at ${clockOf(head.time_starting)}` : ''}`} />
              <Field label="Mass" value={head?.date_mass_starting_time ? clockOf(head.date_mass_starting_time) : null} />
              <Field label="Lot" value={lotAddress} />
              <Field label="Lot type" value={lot?.lot_type} />
              <Field label="Lot owner" value={head?.name1} />
              <Field label="Informant" value={head?.contact_no ? `${order.informant ?? ''} ${head.contact_no}`.trim() : order.informant} />
            </Section>

            <Section title={`Occupant${detail.occupants.length === 1 ? '' : 's'} (${detail.occupants.length})`}>
              {detail.occupants.length === 0 ? (
                <Empty>No occupant rows returned for this order.</Empty>
              ) : (
                detail.occupants.map((o, i) => (
                  <div key={`${o.occupant}-${i}`} style={{ padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontWeight: 700 }}>{o.occupant || '—'}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {o.date_of_birth ? `b. ${shortDate(o.date_of_birth)}` : 'b. —'}
                      {' · '}
                      {o.date_of_death ? `d. ${shortDate(o.date_of_death)}` : 'd. —'}
                    </div>
                  </div>
                ))
              )}
            </Section>

            <Section title={`Project${order.projects.length === 1 ? '' : 's'} (${order.projects.length})`}>
              {order.projects.length === 0 ? (
                <Empty>
                  No active WIP project — this order has no BOQ. That is the state worth acting on.
                </Empty>
              ) : (
                order.projects.map((p) => (
                  <div key={p.project_id} style={{ padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontWeight: 700 }}>{p.project_name || `Project ${p.project_id}`}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {p.project_doc_no ?? '—'} · {p.project_status ?? '—'} · created {shortDate(p.project_created_at)}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Badge text={MATCH_LABEL[p.match].text} tone={MATCH_LABEL[p.match].tone} />
                      {p.online_ref && (
                        <span style={{ fontSize: 11.5, color: C.muted, marginLeft: 6 }}>
                          log {p.online_ref}{p.online_status ? ` · ${p.online_status}` : ''}
                        </span>
                      )}
                    </div>
                    {p.online_error && (
                      <div style={{ fontSize: 11.5, color: C.red, marginTop: 3 }}>{p.online_error}</div>
                    )}
                  </div>
                ))
              )}
            </Section>

            {below && (
              <Section title="Interred below (bottom layer)">
                <Field label="Order" value={below.order?.document_no} />
                <Field label="Interred" value={shortDate(below.order?.date_interment ?? null)} />
                <Field label="Years since" value={below.years_since_interment != null ? String(below.years_since_interment) : null} />
                <Field label="Package" value={below.order?.package_name} />
                {below.occupants.map((o) => (
                  <div key={o.occupancy_id} style={{ padding: '6px 0', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5 }}>{o.name || '—'}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>
                      {o.date_of_death ? `d. ${shortDate(o.date_of_death)}` : 'd. —'}
                      {o.age_at_death != null ? ` · age ${o.age_at_death}` : ''}
                      {o.vessel ? ` · ${o.vessel}` : ''}
                    </div>
                  </div>
                ))}
              </Section>
            )}

            <Section title={`Uploaded photos (${detail.photos.length})`}>
              {detail.photos.length === 0 ? (
                <Empty>No portraits uploaded for this order.</Empty>
              ) : (
                detail.photos.map((p, i) => (
                  <div key={p.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.photo && <img src={p.photo} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}` }} />}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{p.occupant || '—'}</div>
                      <div style={{ fontSize: 11.5, color: C.muted }}>
                        {p.gender || '—'}
                        {truthy(p.allow_facebook_post) ? ' · FB consent' : ' · no FB consent'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Section>

            {detail.missing.length > 0 && (
              <p style={{ fontSize: 11.5, color: C.muted, marginTop: 14, lineHeight: 1.5 }}>
                Could not load: {detail.missing.join(', ')}. Shown above is what the other sources
                returned — not a statement that this order lacks those details.
              </p>
            )}
          </>
        )}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: C.muted, fontWeight: 800, margin: '0 0 6px' }}>
        {title}
      </h2>
      <div style={{ fontSize: 13 }}>{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '3px 0' }}>
      <div style={{ minWidth: 104, color: C.muted, fontSize: 12.5 }}>{label}</div>
      <div style={{ flex: 1, color: value ? C.text : C.muted }}>{value || '—'}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: C.muted, padding: '4px 0' }}>{children}</div>;
}

/** The flag arrives as 1/'1'/true depending on the caller. */
function truthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  return ['1', 'true', 'yes'].includes(String(v ?? '').trim().toLowerCase());
}

/** Time out of a SQL datetime, left in the string's own clock. */
function clockOf(value: string | null): string {
  if (!value) return '';
  const t = value.split(' ')[1];
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  if (Number.isNaN(hour)) return t;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${suffix}`;
}

/* ── pieces ──────────────────────────────────────────────────────────────── */

/**
 * States what the figures cover and how they were assembled.
 *
 * Earns its space because the honest failure mode of this page is looking
 * complete when it is not.
 */
function CoverageBanner({ view }: { view: OfflineView }) {
  const withProject = view.orders.filter((o) => o.seenIn.project).length;
  const upcomingOnly = view.orders.length - withProject;

  return (
    <div style={{
      background: C.blueBg, color: C.textSub, border: `1px solid ${C.blue}22`,
      padding: '10px 12px', borderRadius: 8, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5,
    }}>
      <strong>{view.orders.length}</strong> orders assembled — {withProject} seen through the
      project endpoint{upcomingOnly > 0 ? <>, {upcomingOnly} recovered from upcoming (no project)</> : null} —
      anti-joined against <strong>{view.portalRowCount}</strong> portal applications.
      Orders that are neither upcoming nor project-linked cannot be seen from the frontend at all.
    </div>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: string }) {
  return (
    <div title={hint} style={{
      flex: '1 1 150px', background: '#fff', border: `1px solid ${accent ?? C.border}`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: C.muted, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? C.text }}>{value}</div>
    </div>
  );
}

function PagerButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      cursor: disabled ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 700,
      padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
      background: '#fff', color: disabled ? C.muted : C.textSub, opacity: disabled ? 0.55 : 1,
    }}>
      {children}
    </button>
  );
}

function Badge({ text, tone, hint }: { text: string; tone: 'ok' | 'warn' | 'info' | 'neutral'; hint?: string }) {
  const palette = {
    ok:      { bg: C.greenBg, fg: C.green },
    warn:    { bg: C.amberBg, fg: C.amber },
    info:    { bg: C.blueBg,  fg: C.blue  },
    neutral: { bg: C.bg,      fg: C.textSub },
  }[tone];

  return (
    <span title={hint} style={{
      display: 'inline-block', background: palette.bg, color: palette.fg,
      padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

/** Dates arrive as plain SQL strings; render them without inventing a timezone. */
function shortDate(value: string | null): string {
  if (!value) return '—';
  const datePart = value.split(' ')[0] ?? value;
  const d = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const MATCH_LABEL: Record<IntermentOrderRow['match'], { text: string; tone: 'ok' | 'warn' | 'info' }> = {
  erp_only:     { text: 'No online BOQ', tone: 'ok' },
  both:         { text: 'Double BOQ',    tone: 'warn' },
  partial:      { text: 'Log not generated', tone: 'info' },
  online_match: { text: 'Online BOQ OK', tone: 'ok' },
  online_only:  { text: 'No BOQ log',    tone: 'info' },
};

function Row({ order, onOpen, active }: { order: AssembledOrder; onOpen: () => void; active: boolean }) {
  const lead: IntermentOrderRow | undefined = order.projects[0];
  const extra = Math.max(0, order.projects.length - 1);
  const m = lead ? MATCH_LABEL[lead.match] : null;

  return (
    <tr
      onClick={onOpen}
      title="Open order details"
      style={{
        borderBottom: `1px solid ${C.border}`,
        cursor: 'pointer',
        background: active ? C.blueBg : order.flagged ? C.amberBg : undefined,
      }}
    >
      <td style={{ padding: '9px 10px', fontWeight: 700, whiteSpace: 'nowrap', color: C.blue, textDecoration: 'underline' }}>
        {order.io_number}
      </td>

      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{shortDate(order.interment_date)}</td>

      <td style={{ padding: '9px 10px', maxWidth: 200 }}>
        <div>{order.informant || <span style={{ color: C.muted }}>—</span>}</div>
        {order.contact_no && <div style={{ fontSize: 11.5, color: C.muted }}>{order.contact_no}</div>}
      </td>

      <td style={{ padding: '9px 10px', maxWidth: 300 }}>
        {lead ? (
          <>
            <div style={{ color: C.text }}>{lead.project_name || '—'}</div>
            {lead.project_doc_no && <div style={{ fontSize: 11.5, color: C.muted }}>{lead.project_doc_no}</div>}
            {extra > 0 && (
              <div
                style={{ fontSize: 11.5, color: C.amber, marginTop: 2, fontWeight: 700 }}
                title={order.projects.slice(1).map((p) => `${p.project_doc_no ?? p.project_id} · ${p.project_status ?? '—'}`).join('\n')}
              >
                +{extra} more project{extra === 1 ? '' : 's'}
              </div>
            )}
          </>
        ) : (
          <Badge text="No project" tone="warn" hint="This order has no active WIP project, so it has no BOQ. Visible here only because it is upcoming." />
        )}
      </td>

      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
        {lead
          ? <Badge text={lead.project_status || '—'} tone={lead.project_status === 'CLOSED' ? 'ok' : lead.project_status === 'COMMENCED' ? 'info' : 'neutral'} />
          : <span style={{ color: C.muted }}>—</span>}
      </td>

      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
        <Badge
          text={order.hasPortalRow ? 'Portal' : 'Offline'}
          tone={order.hasPortalRow ? 'info' : 'neutral'}
          hint={order.hasPortalRow
            ? 'An online application exists for this order in wbs_i_interment_applications.'
            : 'No portal application row — booked outside the online form.'}
        />
      </td>

      <td style={{ padding: '9px 10px' }}>
        {m ? <Badge text={m.text} tone={m.tone} /> : <span style={{ color: C.muted }}>—</span>}
        {lead?.online_ref && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
            log {lead.online_ref}{lead.online_status ? ` · ${lead.online_status}` : ''}
          </div>
        )}
        {lead?.online_error && (
          <div style={{ fontSize: 11.5, color: C.red, marginTop: 3, maxWidth: 300 }}>{lead.online_error}</div>
        )}
      </td>
    </tr>
  );
}
