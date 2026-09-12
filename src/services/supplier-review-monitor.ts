import { apiRequest } from '@/lib/api';
import { getToken } from '@/lib/auth';

/** A review row as SupplierReviewController returns it. */
export type SupplierReview = {
  id: number;
  assignment_id: number;
  document_no: string;
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
  rating: number;
  comment: string | null;
  reviewed_by: string;
  created_at: string | null;
  updated_at: string | null;
};

/** A service-order line from /supplierio/nlio/service-orders. */
export type ServiceOrder = {
  id: number;
  document_no: string;
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
  supplier_name: string | null;
  item_name: string | null;
  date_interment: string | null;
  supplier_response: string | null;
  created_at: string;
};

/** A review joined to the supplier/item names from its service order. */
export type ReviewRow = SupplierReview & {
  supplier_name: string | null;
  item_name: string | null;
  date_interment: string | null;
};

function authInit(): RequestInit {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/** Run `work` over `items`, at most `size` in flight at a time. */
async function pooled<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await work(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * Every supplier review, newest first.
 *
 * There is no "all reviews" endpoint — getByNlio is the only unscoped read that
 * does not require a reviewer name — so this reads the service-order list for
 * the NLIO numbers, then fetches each NLIO's reviews through a small pool.
 * Supplier and item names are joined in from the service orders, which avoids
 * a second round of lookups.
 *
 * `onProgress` reports NLIOs completed / total so the UI can show a bar.
 */
export async function getAllReviews(
  onProgress?: (done: number, total: number) => void,
): Promise<ReviewRow[]> {
  const orders = await apiRequest<ServiceOrder[]>('/supplierio/nlio/service-orders', authInit());

  const byAssignment = new Map<number, ServiceOrder>();
  for (const o of orders) byAssignment.set(o.id, o);

  const documentNos = [...new Set(orders.map((o) => o.document_no).filter(Boolean))];

  let done = 0;
  onProgress?.(0, documentNos.length);

  const perNlio = await pooled(documentNos, 6, async (documentNo) => {
    try {
      const res = await apiRequest<{ data: SupplierReview[] }>(
        `/supplierio/reviews/nlio/${encodeURIComponent(documentNo)}`,
        authInit(),
      );
      return res.data ?? [];
    } catch {
      // One bad NLIO shouldn't sink the whole board.
      return [] as SupplierReview[];
    } finally {
      done += 1;
      onProgress?.(done, documentNos.length);
    }
  });

  const rows: ReviewRow[] = [];
  for (const chunk of perNlio) {
    for (const r of chunk) {
      const order = byAssignment.get(r.assignment_id);
      rows.push({
        ...r,
        supplier_name: order?.supplier_name ?? null,
        item_name: order?.item_name ?? null,
        date_interment: order?.date_interment ?? null,
      });
    }
  }

  rows.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  return rows;
}
