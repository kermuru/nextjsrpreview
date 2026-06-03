'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { getServiceOrders } from '@/services/nlio-supplier-assignments';
import type { ServiceOrderRecord } from '@/services/nlio-supplier-assignments';

type Tab = 'latest' | 'per_supplier' | 'per_nlio';

const C = {
  primary:     '#8b6b44',
  primaryDark: '#6b4f30',
  active:      '#0a352d',
  activeDark:  '#072520',
  border:      '#e5e7eb',
  borderMid:   '#d1d5db',
  bg:          '#f9fafb',
  bgCard:      '#ffffff',
  text:        '#111827',
  textSub:     '#374151',
  muted:       '#6b7280',
  green:       '#16a34a',
  greenBg:     '#dcfce7',
  red:         '#dc2626',
  redBg:       '#fee2e2',
  amber:       '#d97706',
  amberBg:     '#fef3c7',
  grayBg:      '#f3f4f6',
};

function StatusPill({ response, notified }: { response: string | null; notified: string | null }) {
  if (response === 'accepted') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 700 }}>
        ✅ Accepted
      </span>
    );
  }
  if (response === 'declined') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: C.redBg, color: C.red, fontSize: 11, fontWeight: 700 }}>
        ❌ Declined
      </span>
    );
  }
  if (notified) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: C.amberBg, color: C.amber, fontSize: 11, fontWeight: 700 }}>
        🔔 Notified
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: C.grayBg, color: C.muted, fontSize: 11, fontWeight: 600 }}>
      · Pending
    </span>
  );
}

const PAGE_SIZE = 15;

function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const slice      = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { setPage(1); }, [items.length]);

  return { page: safePage, setPage, totalPages, slice };
}

function Pagination({ page, totalPages, setPage, total, pageSize }: {
  page: number; totalPages: number; setPage: (p: number) => void; total: number; pageSize: number;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3)           pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btn = (content: React.ReactNode, active: boolean, disabled: boolean, onClick: () => void, key: string | number) => (
    <button
      key={key}
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32,
        height: 32,
        padding: '0 8px',
        borderRadius: 6,
        border: 'none',
        background: active ? C.active : 'transparent',
        color: active ? '#fff' : disabled ? '#c0c0c0' : C.textSub,
        fontFamily: 'Nunito, sans-serif',
        fontSize: 13,
        fontWeight: active ? 800 : 600,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.12s',
      }}
    >
      {content}
    </button>
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      background: C.bg,
      borderTop: `1px solid ${C.border}`,
      fontFamily: 'Nunito, sans-serif',
      gap: 8,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 12, color: C.muted }}>
        Showing <strong style={{ color: C.text }}>{from}–{to}</strong> of <strong style={{ color: C.text }}>{total}</strong>
      </span>
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {btn('‹', false, page === 1,          () => setPage(page - 1), 'prev')}
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: C.muted, fontSize: 13 }}>…</span>
            : btn(p, p === page, false, () => setPage(p as number), p)
        )}
        {btn('›', false, page === totalPages, () => setPage(page + 1), 'next')}
      </div>
    </div>
  );
}

function formatDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(amount: number | null) {
  if (amount == null) return <span style={{ color: '#9ca3af' }}>—</span>;
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>₱{Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>;
}

function SoTable({ rows, paginate = false }: { rows: ServiceOrderRecord[]; paginate?: boolean }) {
  const { page, setPage, totalPages, slice } = usePagination(rows);
  const display = paginate ? slice : rows;
  const TH: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: C.muted,
    background: C.bg,
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  };

  const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '11px 14px',
    ...extra,
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Nunito, sans-serif', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={TH}>IO No.</th>
            <th style={TH}>Interment Date</th>
            <th style={TH}>Supplier</th>
            <th style={TH}>Service</th>
            <th style={TH}>Amount</th>
            <th style={TH}>Status</th>
            <th style={TH}>Assigned</th>
          </tr>
        </thead>
        <tbody>
          {display.map((r, i) => (
            <tr
              key={r.id}
              style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background 0.12s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
            >
              <td style={TD({ fontWeight: 800, color: C.active, letterSpacing: '0.02em' })}>{r.document_no}</td>
              <td style={TD({ color: C.textSub })}>{formatDate(r.date_interment)}</td>
              <td style={TD({ color: C.text, fontWeight: 600 })}>{r.supplier_name ?? `BP#${r.s_bpartner_id}`}</td>
              <td style={TD({ color: C.textSub, textTransform: 'capitalize' })}>{r.item_name ?? '—'}</td>
              <td style={TD()}>{formatAmount(r.service_amount)}</td>
              <td style={TD()}><StatusPill response={r.supplier_response} notified={r.notified_at} /></td>
              <td style={TD({ color: C.muted, fontSize: 12 })}>{formatDate(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {paginate && (
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={rows.length} pageSize={PAGE_SIZE} />
      )}
    </div>
  );
}

function GroupSection({ title, subtitle, rows, defaultOpen = false }: {
  title: string; subtitle?: string; rows: ServiceOrderRecord[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accepted = rows.filter((r) => r.supplier_response === 'accepted').length;
  const declined = rows.filter((r) => r.supplier_response === 'declined').length;
  const notified = rows.filter((r) => r.notified_at && !r.supplier_response).length;
  const pending  = rows.filter((r) => !r.notified_at && !r.supplier_response).length;

  return (
    <div style={{ borderRadius: 10, marginBottom: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '13px 18px',
          background: open ? '#f0f9f6' : C.bg,
          border: 'none',
          borderBottom: open ? `1px solid ${C.border}` : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'Nunito, sans-serif',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text, flex: 1 }}>
          {title}
          {subtitle && <span style={{ fontWeight: 500, color: C.muted, marginLeft: 8, fontSize: 12 }}>{subtitle}</span>}
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          {accepted > 0 && <span style={{ padding: '2px 8px', borderRadius: 999, background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 700 }}>✅ {accepted}</span>}
          {declined > 0 && <span style={{ padding: '2px 8px', borderRadius: 999, background: C.redBg,   color: C.red,   fontSize: 11, fontWeight: 700 }}>❌ {declined}</span>}
          {notified > 0 && <span style={{ padding: '2px 8px', borderRadius: 999, background: C.amberBg, color: C.amber, fontSize: 11, fontWeight: 700 }}>🔔 {notified}</span>}
          {pending  > 0 && <span style={{ padding: '2px 8px', borderRadius: 999, background: C.grayBg,  color: C.muted, fontSize: 11, fontWeight: 600 }}>· {pending}</span>}
        </span>
        <span style={{ fontSize: 10, color: C.muted, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <SoTable rows={rows} />}
    </div>
  );
}

function SummaryCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{
      flex: '1 1 130px',
      background: bg,
      borderRadius: 12,
      padding: '16px 18px',
      fontFamily: 'Nunito, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  );
}

const GROUP_PAGE_SIZE = 10;

function GroupedView({ groups, emptyState, renderGroup }: {
  groups: [string, ServiceOrderRecord[]][];
  emptyState: React.ReactNode;
  renderGroup: (key: string, rows: ServiceOrderRecord[]) => React.ReactNode;
}) {
  const { page, setPage, totalPages, slice } = usePagination(groups, GROUP_PAGE_SIZE);

  if (groups.length === 0) return <>{emptyState}</>;

  return (
    <div>
      {slice.map(([key, rows]) => renderGroup(key, rows))}
      <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginTop: 4 }}>
        <Pagination page={page} totalPages={totalPages} setPage={setPage} total={groups.length} pageSize={GROUP_PAGE_SIZE} />
      </div>
    </div>
  );
}

export default function NlioServiceOrderDashboardPage() {
  const [orders, setOrders]   = useState<ServiceOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<Tab>('latest');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    getServiceOrders()
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (r) => r.document_no?.toLowerCase().includes(q) ||
             r.supplier_name?.toLowerCase().includes(q) ||
             r.item_name?.toLowerCase().includes(q),
    );
  }, [orders, search]);

  const bySupplier = useMemo(() => {
    const map = new Map<string, ServiceOrderRecord[]>();
    for (const r of filtered) {
      const key = r.supplier_name ?? `BP#${r.s_bpartner_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const byNlio = useMemo(() => {
    const map = new Map<string, ServiceOrderRecord[]>();
    for (const r of filtered) {
      if (!map.has(r.document_no)) map.set(r.document_no, []);
      map.get(r.document_no)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const accepted = orders.filter((r) => r.supplier_response === 'accepted').length;
  const declined = orders.filter((r) => r.supplier_response === 'declined').length;
  const notified = orders.filter((r) => r.notified_at && !r.supplier_response).length;
  const pending  = orders.filter((r) => !r.notified_at && !r.supplier_response).length;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'latest',       label: 'Latest SO'    },
    { key: 'per_supplier', label: 'Per Supplier' },
    { key: 'per_nlio',     label: 'Per NLIO'     },
  ];

  const emptyState = (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>No service orders found</div>
      {search && <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your search</div>}
    </div>
  );

  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">

          {/* Back link */}
          <Link
            href="/supplierio"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: C.primary,
              color: 'white',
              padding: '7px 14px',
              borderRadius: 6,
              textDecoration: 'none',
              width: 'fit-content',
              fontFamily: 'Nunito, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            ← Menu
          </Link>

          {/* Header */}
          <div style={{ paddingBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, fontFamily: 'Nunito, sans-serif' }}>
              Service Order Dashboard
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
              All NLIO supplier assignments · notification and response tracking
            </p>
          </div>

          {/* Summary cards */}
          {!loading && !error && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <SummaryCard label="Total SOs"           value={orders.length} color={C.primary}  bg="#fdf8f3" />
              <SummaryCard label="Accepted"            value={accepted}      color={C.green}    bg={C.greenBg} />
              <SummaryCard label="Declined"            value={declined}      color={C.red}      bg={C.redBg} />
              <SummaryCard label="Notified / Awaiting" value={notified}      color={C.amber}    bg={C.amberBg} />
              <SummaryCard label="Pending"             value={pending}       color={C.muted}    bg={C.grayBg} />
            </div>
          )}

          {/* Tabs + search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              gap: 4,
              background: C.bg,
              borderRadius: 8,
              padding: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            }}>
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: 13,
                    fontWeight: tab === key ? 800 : 600,
                    background: tab === key ? C.active : 'transparent',
                    color: tab === key ? '#fff' : C.muted,
                    transition: 'all 0.15s',
                    letterSpacing: '0.01em',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search IO, supplier, service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                marginLeft: 'auto',
                padding: '8px 14px',
                fontSize: 13,
                border: 'none',
                borderRadius: 8,
                minWidth: 240,
                background: '#fff',
                fontFamily: 'Nunito, sans-serif',
                outline: 'none',
                color: C.text,
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
              }}
              onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${C.active}40`)}
              onBlur={(e)  => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.10)')}
            />
          </div>

          {/* Results count */}
          {!loading && !error && search && (
            <div style={{ fontSize: 12, color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
              Showing <strong style={{ color: C.text }}>{filtered.length}</strong> of {orders.length} service orders
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted, fontFamily: 'Nunito, sans-serif' }}>
              <div style={{ fontSize: 13 }}>Loading service orders…</div>
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: C.red, fontFamily: 'Nunito, sans-serif', fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {tab === 'latest' && (
                <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  {filtered.length === 0 ? emptyState : <SoTable rows={filtered} paginate />}
                </div>
              )}

              {tab === 'per_supplier' && (
                <GroupedView groups={bySupplier} emptyState={emptyState} renderGroup={(name, rows) => (
                  <GroupSection key={name} title={name} subtitle={`${rows.length} SO${rows.length !== 1 ? 's' : ''}`} rows={rows} />
                )} />
              )}

              {tab === 'per_nlio' && (
                <GroupedView groups={byNlio} emptyState={emptyState} renderGroup={(docNo, rows) => (
                  <GroupSection
                    key={docNo}
                    title={docNo}
                    subtitle={rows[0]?.date_interment ? formatDate(rows[0].date_interment) : ''}
                    rows={rows}
                    defaultOpen={byNlio.length === 1}
                  />
                )} />
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
