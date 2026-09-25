import { apiRequest } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * Interment orders that were NOT booked through the online portal.
 *
 * ══ THE DEFINITION ═════════════════════════════════════════════════════════
 * An order counts as OFFLINE when it exists in SAERP but has no row in
 * wbs_i_interment_applications — no portal application was ever filed for it.
 *
 * That test spans two databases and no endpoint joins them, so this module
 * assembles it from three existing read-only endpoints:
 *
 *   GET /interment/boq-comparison    SAERP orders that have a WIP project
 *   GET /interment/orders/upcoming   SAERP orders with date_interment >= today
 *   GET /interment/applications      portal applications, carrying io_number
 *
 * Orders from the first two, minus every io_number seen in the third.
 *
 * ══ WHY NOT THE `created` COLUMN ═══════════════════════════════════════════
 * mp_t_interment_order.created is NULL for ERP-desktop rows and
 * 'Online Interment Application' / 'WEB CV PACKAGE' for PHP-written ones, so it
 * looks like the obvious discriminator. It answers a narrower question — which
 * SOFTWARE wrote the row — and no controller exposes it anyway. The portal-row
 * test is the one asked for here, and it also catches orders written by the
 * headless LIO driver, which stamps itself like the portal but files no
 * application.
 *
 * Do NOT use boq-comparison's own `source` field or its `source=erp` filter.
 * That filter is `p.created != 'Online Interment Application'` against a column
 * the ERP leaves NULL, and `NULL != 'x'` is NULL, never TRUE — measured:
 * source=erp -> 0 rows, source=online -> 57, unfiltered -> 1,335.
 *
 * ══ COVERAGE, HONESTLY ═════════════════════════════════════════════════════
 * boq-comparison INNER JOINs order -> project -> category, so an order with no
 * active WIP project is invisible to it: 942 of 1,796 orders on the replica.
 * /orders/upcoming has no project join and recovers the future-dated ones, but
 * nothing recovers a past-dated order that never got a project. Measured reach
 * of the two combined: 852 of 1,796 orders. The page states this.
 *
 * Everything here is READ-ONLY; all three endpoints are SELECTs.
 */

/** How each order×project row arrives from boq-comparison. */
export type IntermentOrderRow = {
  io_id: number;
  io_number: string;
  interment_date: string | null;
  project_id: number;
  project_name: string | null;
  project_status: string | null;
  project_doc_no: string | null;
  project_created_at: string | null;
  source: 'erp' | 'online';
  online_ref: string | null;
  online_log_id: number | null;
  online_status: string | null;
  online_generated_at: string | null;
  online_error: string | null;
  match: 'erp_only' | 'both' | 'online_match' | 'online_only' | 'partial';
};

/** One row of GET /interment/orders/upcoming (a bare array, not paginated). */
export type UpcomingOrderRow = {
  mp_t_interment_order_id: number;
  bpar_i_person_id: number | null;
  informant: string | null;
  contact_no: string | null;
  documentno: string;
  date_interment: string | null;
  datetime_interment: string | null;
  datetime_mass: string | null;
};

type Paginated<T> = {
  success?: boolean;
  data: T[];
  meta?: { total: number; per_page: number; current_page: number; last_page: number };
};

/** Both paginated endpoints cap per_page at 100 in their controllers. */
const MAX_PER_PAGE = 100;

/** Safety stop, well clear of the ~14 pages live data needs. */
const MAX_PAGES = 40;

function authInit(): RequestInit {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/** SAERP and the portal spell document numbers inconsistently; compare on this. */
export function normalizeDocNo(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

async function fetchAllPages<T>(path: string): Promise<{ rows: T[]; truncated: boolean }> {
  const page1 = await apiRequest<Paginated<T>>(
    `${path}${path.includes('?') ? '&' : '?'}per_page=${MAX_PER_PAGE}`,
    authInit(),
  );

  const lastPage = Math.max(1, page1.meta?.last_page ?? 1);
  const capped = Math.min(lastPage, MAX_PAGES);

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, capped - 1) }, (_, i) =>
      apiRequest<Paginated<T>>(
        `${path}${path.includes('?') ? '&' : '?'}per_page=${MAX_PER_PAGE}&page=${i + 2}`,
        authInit(),
      ).then((r) => r.data ?? []),
    ),
  );

  return { rows: [...(page1.data ?? []), ...rest.flat()], truncated: lastPage > MAX_PAGES };
}

/**
 * Every io_number that has a portal application — the set an order must be
 * ABSENT from to count as offline.
 *
 * Rows with a null io_number are dropped: an application that never reached
 * SAERP cannot mark any order as online.
 */
export async function fetchPortalIoNumbers(): Promise<{ set: Set<string>; count: number; truncated: boolean }> {
  const { rows, truncated } = await fetchAllPages<{ io_number: string | null }>('/interment/applications');

  const set = new Set<string>();
  for (const r of rows) {
    const key = normalizeDocNo(r.io_number);
    if (key) set.add(key);
  }

  return { set, count: rows.length, truncated };
}

/** Order×project rows for every order that has a WIP project. */
export async function fetchProjectLinkedOrders(): Promise<{ rows: IntermentOrderRow[]; truncated: boolean }> {
  // `source` is never sent — that filter is broken (see the header note).
  return fetchAllPages<IntermentOrderRow>('/interment/boq-comparison');
}

/** Future-dated orders, including those with no project at all. */
export async function fetchUpcomingOrders(): Promise<UpcomingOrderRow[]> {
  // This endpoint answers with a bare array, not a paginated envelope.
  const rows = await apiRequest<UpcomingOrderRow[]>('/interment/orders/upcoming', authInit());
  return Array.isArray(rows) ? rows : [];
}

/** One interment order, assembled from whichever endpoints could see it. */
export type AssembledOrder = {
  io_number: string;
  interment_date: string | null;
  /** Family contact, available only for upcoming orders. */
  informant: string | null;
  contact_no: string | null;
  /** Empty when the order has no WIP project — itself worth noticing. */
  projects: IntermentOrderRow[];
  /** TRUE = booked through the portal. FALSE = offline, what this page is for. */
  hasPortalRow: boolean;
  /** Any project in a state worth opening (Double BOQ, or a log that failed). */
  flagged: boolean;
  /** Which endpoints saw this order — drives the coverage column. */
  seenIn: { project: boolean; upcoming: boolean };
};

export type OfflineView = {
  orders: AssembledOrder[];
  offline: AssembledOrder[];
  portal: AssembledOrder[];
  portalRowCount: number;
  truncated: boolean;
};

/**
 * Pull all three sources and assemble the view.
 *
 * The three fetches are independent, so they go out together; the assembly is
 * pure and happens once they land.
 */
export async function loadOfflineView(): Promise<OfflineView> {
  const [projectLinked, upcoming, portal] = await Promise.all([
    fetchProjectLinkedOrders(),
    fetchUpcomingOrders(),
    fetchPortalIoNumbers(),
  ]);

  const byDoc = new Map<string, AssembledOrder>();

  const ensure = (docNo: string, intermentDate: string | null): AssembledOrder => {
    const key = normalizeDocNo(docNo);
    let entry = byDoc.get(key);

    if (!entry) {
      entry = {
        io_number: docNo,
        interment_date: intermentDate,
        informant: null,
        contact_no: null,
        projects: [],
        hasPortalRow: portal.set.has(key),
        flagged: false,
        seenIn: { project: false, upcoming: false },
      };
      byDoc.set(key, entry);
    }

    return entry;
  };

  // 264 orders carry more than one project, so rows are collapsed per order.
  for (const row of projectLinked.rows) {
    const entry = ensure(row.io_number, row.interment_date);
    entry.projects.push(row);
    entry.seenIn.project = true;
    if (row.match === 'both' || row.match === 'partial') entry.flagged = true;
  }

  for (const row of upcoming) {
    const entry = ensure(row.documentno, row.date_interment);
    entry.seenIn.upcoming = true;
    entry.informant ??= row.informant;
    entry.contact_no ??= row.contact_no;
    entry.interment_date ??= row.date_interment;
  }

  const orders = [...byDoc.values()];

  return {
    orders,
    offline: orders.filter((o) => !o.hasPortalRow),
    portal: orders.filter((o) => o.hasPortalRow),
    portalRowCount: portal.count,
    truncated: projectLinked.truncated || portal.truncated,
  };
}

/* ══ ORDER DETAIL ═════════════════════════════════════════════════════════
 * Everything known about ONE interment order, from three by-document
 * endpoints. All read-only, all fetched lazily when a row is opened — none of
 * this is pulled for the list.
 *
 *   GET /intermentsReviewLink/{doc}          the order itself + its occupants
 *   GET /interment/lower-layer/order/{doc}   lot address, layer, what lies below
 *   GET /upload-photos/by-document/{doc}     uploaded portraits + FB consent
 *
 * Each is allowed to fail on its own. The review-link query inner-joins package
 * and variation and restricts to vessel 2/3, so it legitimately returns 404 for
 * some orders (measured: 7 of 8 sampled resolved). A detail panel that blanked
 * out because one source was missing would be worse than one that shows what it
 * has and names what it could not get.
 */

/** One occupant row of GET /intermentsReviewLink/{doc}. */
export type OrderOccupantRow = {
  bpar_i_person_id: number | null;
  /** Lot owner. */
  name1: string | null;
  documentno: string;
  date_interment: string | null;
  time_starting: string | null;
  date_mass_starting_time: string | null;
  occupant: string | null;
  contact_no: string | null;
  interment_package: string | null;
  variation: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
};

export type LotInfo = {
  ownership_id: number | null;
  lot_id: number | null;
  area_no: number | null;
  block_no: number | null;
  lot_no: number | null;
  lot_type_id: number | null;
  lot_type: string | null;
};

export type LowerLayerOccupant = {
  occupancy_id: number;
  name: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  age_at_death: number | null;
  cause_of_death: string | null;
  religion: string | null;
  vessel: string | null;
  item_type: string | null;
};

export type LowerLayerData = {
  lot: LotInfo | null;
  target: { space_id: number | null; space_name: string | null; resolved_from: string | null } | null;
  has_lower_layer: boolean;
  bottom_layer: {
    space_id: number | null;
    space_name: string | null;
    order: {
      interment_order_id: number;
      document_no: string;
      docstatus: string | null;
      date_interment: string | null;
      time_starting: string | null;
      with_mass: boolean;
      mass_time: string | null;
      mass_location: string | null;
      package_id: number | null;
      package_name: string | null;
      amount_paid: string | null;
    } | null;
    years_since_interment: number | null;
    occupant_count: number | null;
    occupants: LowerLayerOccupant[];
  } | null;
};

/** One uploaded portrait. `allow_facebook_post` is the family's publication consent. */
export type OrderPhotoRow = {
  id?: number;
  document_no?: string;
  occupant?: string | null;
  gender?: string | null;
  uploader_name?: string | null;
  photo?: string | null;
  is_valid?: boolean | number | null;
  allow_facebook_post?: boolean | number | null;
  created_at?: string | null;
};

export type OrderDetail = {
  io_number: string;
  occupants: OrderOccupantRow[];
  lowerLayer: LowerLayerData | null;
  photos: OrderPhotoRow[];
  /** Human-readable reason per source that returned nothing. */
  missing: string[];
};

/** Resolve one source, converting any failure into a named gap rather than a throw. */
async function soft<T>(label: string, run: () => Promise<T>, missing: string[]): Promise<T | null> {
  try {
    return await run();
  } catch {
    missing.push(label);
    return null;
  }
}

export async function fetchOrderDetail(ioNumber: string): Promise<OrderDetail> {
  const doc = encodeURIComponent(ioNumber.trim());
  const missing: string[] = [];

  const [occupants, lower, photos] = await Promise.all([
    soft('order + occupants', () => apiRequest<OrderOccupantRow[]>(`/intermentsReviewLink/${doc}`, authInit()), missing),
    soft('lot / lower layer', () => apiRequest<{ success: boolean; data: LowerLayerData }>(`/interment/lower-layer/order/${doc}`, authInit()), missing),
    soft('uploaded photos', () => apiRequest<OrderPhotoRow[]>(`/upload-photos/by-document/${doc}`, authInit()), missing),
  ]);

  return {
    io_number: ioNumber,
    occupants: Array.isArray(occupants) ? occupants : [],
    lowerLayer: lower?.data ?? null,
    photos: Array.isArray(photos) ? photos : [],
    missing,
  };
}
