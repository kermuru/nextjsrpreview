'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Admin Portal menu.
 *
 * Every page in src/app that a person can open on purpose is listed here —
 * deep-link routes that need a document number in the URL are not, because
 * there is nothing useful to open them with from a menu.
 *
 * Adding a tool: append one entry to FEATURES. Nothing else needs touching —
 * the category chips, counts and search index are all derived from this list.
 */

type CategoryId = 'interment' | 'project' | 'supplier' | 'media';

interface Feature {
  title: string;
  href: string;
  description: string;
  category: CategoryId;
  /** Extra words people might type when hunting for this tool. */
  keywords?: string[];
}

const CATEGORIES: { id: CategoryId; label: string; blurb: string }[] = [
  { id: 'interment', label: 'Interments',        blurb: 'Orders, photos and the people on the day' },
  { id: 'project',   label: 'Projects & budget', blurb: 'Project status, BOQ, IPR and payouts' },
  { id: 'supplier',  label: 'Suppliers',         blurb: 'Assignments, Discord mapping and reviews' },
  { id: 'media',     label: 'Images & posting',  blurb: 'Photo libraries, editors and autoposts' },
];

const FEATURES: Feature[] = [
  // ── Interments ────────────────────────────────────────────────────────────
  {
    title: 'Interment Orders',
    href: '/interments',
    description: 'Browse interment orders and open a single order for its full detail.',
    category: 'interment',
    keywords: ['nlio', 'a place to remember', 'service order', 'records'],
  },
  {
    title: 'Offline Interment Orders',
    href: '/offline-interment-orders',
    description: 'Orders raised without a portal application, for encoding and follow-up.',
    category: 'interment',
    keywords: ['no portal application', 'manual', 'walk-in'],
  },
  {
    title: 'Interment Item & Cost',
    href: '/interment-item-cost',
    description: 'Register add-on items and their prices against an order, maker then checker.',
    category: 'interment',
    keywords: ['add-on', 'pricing', 'charges', 'maker checker'],
  },
  {
    title: 'Interment Driver Runner',
    href: '/interment-lio-driver',
    description: 'Run the LIO driver for an interment order and see what the executor returned.',
    category: 'interment',
    keywords: ['lio', 'executor', 'driver', 'agent'],
  },
  {
    title: 'Lapida Uploads',
    href: '/lapidaDashboard',
    description: 'Lapida photos sent in by families, with the original each one came from.',
    category: 'interment',
    keywords: ['lapida', 'family photo', 'engraving', 'dashboard'],
  },
  {
    title: 'Slideshow Monitor',
    href: '/interment-slideshow-monitor',
    description: 'Watch the memorial slideshow automation and its running order.',
    category: 'interment',
    keywords: ['monitor', 'slides', 'memorial', 'automation'],
  },
  {
    title: 'Photo Validation Monitor',
    href: '/photo-validation-monitor',
    description: 'What the AI photo check decided on each uploaded portrait, and why.',
    category: 'interment',
    keywords: ['monitor', 'ai', 'one person', 'portrait', 'validation'],
  },
  {
    title: 'Marshal Thread Monitor',
    href: '/marshal-thread-monitor',
    description: 'Keep marshal Discord threads alive until the interment day.',
    category: 'interment',
    keywords: ['monitor', 'discord', 'thread', 'marshal'],
  },

  // ── Projects & budget ─────────────────────────────────────────────────────
  {
    title: 'Commence Project',
    href: '/project-commence',
    description: 'Move a project from BUDGETING to COMMENCED through the executor driver.',
    category: 'project',
    keywords: ['commence', 'status', 'budgeting', 'driver', 'wip'],
  },
  {
    title: 'Project Auto Closure',
    href: '/project-closure',
    description: 'Preview which projects are ready to close and what closing them would post.',
    category: 'project',
    keywords: ['close', 'closure', 'dry run', 'wip'],
  },
  {
    title: 'Stage Consumption Type',
    href: '/project-stage-consumption',
    description: 'Set GR’d project stages to CONSUME, one by one or on a schedule.',
    category: 'project',
    keywords: ['consume', 'stage', 'gr', 'auto-schedule'],
  },
  {
    title: 'Stage Consumption History',
    href: '/project-stage-consumption/history',
    description: 'Every scheduled consumption sweep — what it applied and what it refused.',
    category: 'project',
    keywords: ['monitor', 'history', 'runs', 'sweep', 'auto'],
  },
  {
    title: 'Processing Monitor',
    href: '/budget-monitor',
    description: 'Processed budget requests (IPR-IRB, ARB-IPR, EXB-ADV), tagged Java vs ours.',
    category: 'project',
    keywords: ['monitor', 'budget', 'irb', 'arb', 'exb'],
  },
  {
    title: 'Auto BOQ Custodian',
    href: '/autoboq-custodian',
    description: 'Choose who Auto BOQ names as stage custodian on newly generated BOQs.',
    category: 'project',
    keywords: ['boq', 'custodian', 'auto'],
  },
  {
    title: 'Close IPR-BOQ Lines',
    href: '/ipr-line-close',
    description: 'Retire requisition lines the old IPR route left behind without drawing the budget.',
    category: 'project',
    keywords: ['ipr', 'boq', 'lines', 'cleanup'],
  },
  {
    title: 'Auto IPR',
    href: '/auto-ipr',
    description: 'Reorder-level replenishment for interment orders, with a one-open-order guard.',
    category: 'project',
    keywords: ['ipr', 'reorder', 'replenishment', 'auto'],
  },
  {
    title: 'IPR → GR Delay Agent',
    href: '/ipr-delay-agent',
    description: 'Toggle the delay agent, set who gets the DM, and run it by hand to test.',
    category: 'project',
    keywords: ['monitor', 'delay', 'gr', 'discord', 'agent'],
  },
  {
    title: 'LMC Payout History',
    href: '/lmc-payout-history',
    description: 'Service payouts (emcee, singer, lapida). Cancel a PR payout to free its budget.',
    category: 'project',
    keywords: ['lmc', 'payout', 'cancel', 'emcee', 'singer'],
  },
  {
    title: 'LMC Payee Discord',
    href: '/project-lmc/payee-discord',
    description: 'Find a payee and link the Discord account their payout notices go to.',
    category: 'project',
    keywords: ['lmc', 'discord', 'payee', 'notification'],
  },
  {
    title: 'Project LMC Payout Monitor',
    href: '/project-lmc/payout-monitor',
    description: 'Recent project payouts and whether each contractor was actually told — spots payouts that posted with no service order.',
    category: 'project',
    keywords: ['lmc', 'payout', 'monitor', 'service order', 'missing', 'contractor', 'notified'],
  },
  {
    title: 'Project LMC SO Acceptance',
    href: '/project-lmc/so-acceptance',
    description: 'Service orders sent to contractors after a payout, and who accepted or declined each one.',
    category: 'project',
    keywords: ['lmc', 'service order', 'acceptance', 'accepted', 'declined', 'discord', 'contractor'],
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  {
    title: 'Supplier IO Portal',
    href: '/supplierio',
    description: 'The supplier hub — items, assignments and NLIO setup in one place.',
    category: 'supplier',
    keywords: ['portal', 'hub', 'supplier'],
  },
  {
    title: 'Supplier Items',
    href: '/supplierio/items',
    description: 'The catalogue of items suppliers can be assigned to.',
    category: 'supplier',
    keywords: ['items', 'catalogue', 'products'],
  },
  {
    title: 'Supplier Item Assignment',
    href: '/supplierio/item-assignment',
    description: 'Decide which supplier covers which item.',
    category: 'supplier',
    keywords: ['assignment', 'items', 'mapping'],
  },
  {
    title: 'NLIO Supplier Assignment',
    href: '/supplierio/nlio-assignment',
    description: 'Assign suppliers to the services on an interment order.',
    category: 'supplier',
    keywords: ['nlio', 'assignment', 'service order'],
  },
  {
    title: 'NLIO Service Orders',
    href: '/supplierio/nlio-dashboard',
    description: 'Service orders by status, with what each supplier still owes.',
    category: 'supplier',
    keywords: ['nlio', 'dashboard', 'service orders'],
  },
  {
    title: 'Discord User Mapping',
    href: '/supplierio/discord',
    description: 'Map suppliers and admins to the Discord accounts that receive their DMs.',
    category: 'supplier',
    keywords: ['discord', 'user id', 'mapping', 'dm'],
  },
  {
    title: 'Marshal Discord Users',
    href: '/supplierio/marshals',
    description: 'The marshals on Discord and who each one maps to.',
    category: 'supplier',
    keywords: ['marshal', 'discord', 'mapping'],
  },
  {
    title: 'Supplier Reviews',
    href: '/supplier-review-monitor',
    description: 'Reviews left for suppliers, as they come in.',
    category: 'supplier',
    keywords: ['monitor', 'review', 'rating', 'feedback'],
  },
  {
    title: 'All Reviews',
    href: '/allReviews',
    description: 'Every client review submitted, Facebook and Google alike.',
    category: 'supplier',
    keywords: ['review', 'facebook', 'google', 'client', 'feedback'],
  },
  {
    title: 'Reviewed Email List',
    href: '/isReviewedEmail',
    description: 'Which review invitation emails have already been answered.',
    category: 'supplier',
    keywords: ['email', 'review', 'sent', 'invitation'],
  },

  // ── Images & posting ──────────────────────────────────────────────────────
  {
    title: 'Asset Image Library',
    href: '/asset-images',
    description: 'Bulk-upload asset images, view high or low definition, download the original.',
    category: 'media',
    keywords: ['asset', 'image', 'upload', 'library', 'photo'],
  },
  {
    title: 'Barong Image Editor',
    href: '/barong-editor',
    description: 'Re-dress an uploaded portrait in a barong before it goes on the lapida.',
    category: 'media',
    keywords: ['barong', 'editor', 'portrait', 'ai', 'attire'],
  },
  {
    title: 'Barong Run Monitor',
    href: '/barong-editor/monitor',
    description: 'Every barong edit run, and which ones failed.',
    category: 'media',
    keywords: ['monitor', 'barong', 'runs', 'queue'],
  },
  {
    title: 'Barong Upload Settings',
    href: '/barong-editor/uploads',
    description: 'Control which uploads the barong editor picks up.',
    category: 'media',
    keywords: ['barong', 'settings', 'uploads', 'new only'],
  },
  {
    title: 'Hiring Autopost Monitor',
    href: '/hiring-autopost-monitor',
    description: 'The weekly partner hiring advert — what was posted, and when.',
    category: 'media',
    keywords: ['monitor', 'facebook', 'hiring', 'autopost', 'advert'],
  },

  // ── Data scripts — DELIBERATELY NOT LISTED ────────────────────────────────
  // The /script/* pages (nlio-docno-correction, nlio-project-close,
  // nlio-project-dates, nlio-project-org, preownership-set-paid) still exist and
  // still work; they are kept off this menu on purpose so they are not something
  // anyone can stumble into. Reach them by typing the URL when you actually need
  // one. Do not re-add them here without asking — delisting was the point.
];

const PIN_KEY    = 'rpv.menu.pins';
const RECENT_KEY = 'rpv.menu.recent';
const RECENT_MAX = 5;

/** localStorage is per-browser and can throw (private window, blocked storage). */
function readStore(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeStore(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* a menu preference is not worth breaking the page over */
  }
}

const S = {
  muted:  { color: 'var(--muted)' } as React.CSSProperties,
  chip: (active: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary)' : 'rgba(255,255,255,0.9)',
    color: active ? '#fff' : 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }),
  sectionTitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,
};

export default function AdminMenuPage() {
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [pins, setPins]         = useState<string[]>([]);
  const [recent, setRecent]     = useState<string[]>([]);
  const [cursor, setCursor]     = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Preferences live in the browser, so they can only be read after mount.
  useEffect(() => {
    setPins(readStore(PIN_KEY));
    setRecent(readStore(RECENT_KEY));
  }, []);

  // "/" jumps to the search box from anywhere on the page; Escape clears it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typingElsewhere = e.target instanceof HTMLElement
        && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (e.key === '/' && !typingElsewhere) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);

    return FEATURES.filter(f => {
      if (category !== 'all' && f.category !== category) return false;
      if (terms.length === 0) return true;
      const hay = [f.title, f.description, f.href, ...(f.keywords ?? [])].join(' ').toLowerCase();
      return terms.every(t => hay.includes(t));
    });
  }, [query, category]);

  useEffect(() => { setCursor(0); }, [query, category]);

  const searching = query.trim() !== '' || category !== 'all';

  const pinned = useMemo(
    () => pins.map(h => FEATURES.find(f => f.href === h)).filter((f): f is Feature => !!f),
    [pins],
  );
  const recentList = useMemo(
    () => recent
      .filter(h => !pins.includes(h))
      .map(h => FEATURES.find(f => f.href === h))
      .filter((f): f is Feature => !!f),
    [recent, pins],
  );

  const togglePin = useCallback((href: string) => {
    setPins(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      writeStore(PIN_KEY, next);
      return next;
    });
  }, []);

  const remember = useCallback((href: string) => {
    setRecent(prev => {
      const next = [href, ...prev.filter(h => h !== href)].slice(0, RECENT_MAX);
      writeStore(RECENT_KEY, next);
      return next;
    });
  }, []);

  // Enter opens the highlighted result; arrows move the highlight.
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setQuery(''); return; }
    if (matches.length === 0) return;

    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => (c + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => (c - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter') {
      const target = matches[cursor] ?? matches[0];
      if (target) { remember(target.href); window.location.href = target.href; }
    }
  }

  function Card({ feature, highlighted = false }: { feature: Feature; highlighted?: boolean }) {
    const isPinned = pins.includes(feature.href);
    const cat = CATEGORIES.find(c => c.id === feature.category);

    return (
      <div style={{ position: 'relative' }}>
        <Link
          href={feature.href}
          onClick={() => remember(feature.href)}
          className={`menu-card${highlighted ? ' is-cursor' : ''}`}
        >
          <div>
            <h2 className="menu-card-title">{feature.title}</h2>
            <p className="menu-card-desc">{feature.description}</p>
          </div>

          <div className="menu-card-foot">
            <span className="menu-card-cat">{cat?.label}</span>
            <span className="menu-card-open" aria-hidden="true">Open →</span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => togglePin(feature.href)}
          className={`menu-pin${isPinned ? ' is-pinned' : ''}`}
          aria-label={isPinned ? `Unpin ${feature.title}` : `Pin ${feature.title}`}
          title={isPinned ? 'Unpin from the top' : 'Pin to the top'}
        >
          {isPinned ? '★' : '☆'}
        </button>
      </div>
    );
  }

  function Section({ title, items, fromIndex }: { title: string; items: Feature[]; fromIndex?: number }) {
    if (items.length === 0) return null;
    return (
      <div className="stack" style={{ gap: 12 }}>
        <h3 style={S.sectionTitle}>{title}</h3>
        <div className="admin-menu-grid">
          {items.map((f, i) => (
            <Card
              key={f.href}
              feature={f}
              highlighted={fromIndex !== undefined && fromIndex + i === cursor}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="hero-logo">
          <img src="/logo.png" alt="Renaissance Park logo" />
        </div>

        <div className="page-card wide stack">

          <div className="stack centered" style={{ gap: 4 }}>
            <h1 style={{ margin: 0 }}>Admin Portal</h1>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              {FEATURES.length} tools. Start typing to find one.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search tools — try &quot;discord&quot;, &quot;monitor&quot;, &quot;ipr&quot;…"
              aria-label="Search tools"
              style={{
                width: '100%', padding: '13px 92px 13px 16px',
                fontSize: 15, borderRadius: 12,
                border: '1px solid var(--border)', background: '#fff',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontFamily: 'inherit',
              }}
            />
            <span style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: 'var(--muted)', pointerEvents: 'none',
            }}>
              {query ? `${matches.length} found` : 'press /'}
            </span>
          </div>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setCategory('all')} style={S.chip(category === 'all')}>
              All {FEATURES.length}
            </button>
            {CATEGORIES.map(c => {
              const n = FEATURES.filter(f => f.category === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(category === c.id ? 'all' : c.id)}
                  title={c.blurb}
                  style={S.chip(category === c.id)}
                >
                  {c.label} {n}
                </button>
              );
            })}
          </div>

          {/* Pinned + recent, only when nothing is filtering the view */}
          {!searching && (
            <>
              <Section title="Pinned" items={pinned} />
              <Section title="Recently opened" items={recentList} />
            </>
          )}

          {/* Results */}
          {searching ? (
            matches.length > 0 ? (
              <Section
                title={category === 'all'
                  ? `${matches.length} result${matches.length === 1 ? '' : 's'}`
                  : CATEGORIES.find(c => c.id === category)?.label ?? 'Results'}
                items={matches}
                fromIndex={0}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Nothing matches &ldquo;{query}&rdquo;</p>
                <p className="muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>
                  Try a shorter word, or clear the filters.
                </p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => { setQuery(''); setCategory('all'); searchRef.current?.focus(); }}
                >
                  Clear search
                </button>
              </div>
            )
          ) : (
            CATEGORIES.map(c => (
              <Section
                key={c.id}
                title={c.label}
                items={FEATURES.filter(f => f.category === c.id)}
              />
            ))
          )}

          <p className="muted" style={{ margin: 0, fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
            Press <strong>/</strong> to search · <strong>↑ ↓</strong> to move · <strong>Enter</strong> to open ·
            the <strong>☆</strong> on a card pins it to the top of this page for you.
          </p>

        </div>
      </div>
    </div>
  );
}
