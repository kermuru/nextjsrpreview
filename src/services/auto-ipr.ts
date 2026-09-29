import { apiRequest } from '@/lib/api';

// Backend: routes/api.php  /v1/auto-ipr/*  (AutoIprController)
const base = '/v1/auto-ipr';

export interface AutoIprSetting {
  enabled: boolean;
  org_code: number;
  io_docstatus: 'PR' | 'DR';
  last_run_at: string | null;
}

export type AutoIprTriggerMode = 'reorder_level' | 'interment_ratio';

/**
 * A requisition THIS agent raised for the item that has not yet been both purchased and
 * received. While one exists the agent will not order that item again, whatever the stock
 * position says — so this is the reason a visibly short item can show nothing due.
 *
 * Scoped to our own documents: these SKUs are requisitioned constantly by the BOQ flow and by
 * hand, so blocking on anyone's open requisition would block the agent permanently.
 */
export interface AutoIprBlocker {
  document_no: string | null;
  requisition_id: number;
  /** What we asked for on that document. */
  qty: number;
  /** How much of it became a PO, and how much has physically arrived against that PO. */
  qty_po: number;
  qty_received: number;
  posted_at: string | null;
  reason: string;
}

/**
 * One watched SKU. Two shapes in one type, keyed by trigger_mode:
 *
 *  reorder_level   — stock-based. Watches a locator's balance; the ordering level lives in
 *                    OUR table (the ERP's nvt_i_sku_ordering_level has no locator column).
 *  interment_ratio — the original demand forecast; stock fields are null.
 */
export interface AutoIprRule {
  rule_id: number;
  skucode: string;
  nvt_i_sku_id: number;
  item_name: string | null;
  unit: string | null;
  enabled: boolean;
  trigger_mode: AutoIprTriggerMode;
  /** Quantity this rule will requisition right now. Forced to 0 while `blocked_by` is set. */
  qty_due: number;
  /**
   * What the shortage is worth before the open-order guard is applied. Equal to qty_due when
   * nothing is blocking; when something is, this is what would have been ordered — shown so a
   * block never reads as "nothing wrong here".
   */
  qty_would_be?: number;
  /** Non-null = the agent is holding off because its own earlier order is still outstanding. */
  blocked_by?: AutoIprBlocker | null;
  /** False when the rule has no usable policy for its mode — it can't be enabled. */
  configured: boolean;

  // ── reorder_level ─────────────────────────────────────────────
  locator_id?: number;
  locator_code?: string | null;
  /** Latest stored qtybalance at the watched locator (not a sum of movements). */
  balance?: number | null;
  balance_as_of?: string | null;
  /** Requisitioned but not yet received — stops re-ordering during the 26–37 day lead time. */
  in_flight?: number;
  /** balance + in_flight. This is what's compared to reorder_level. */
  stock_position?: number | null;
  reorder_level?: number | null;
  order_up_to?: number | null;
  below_level?: boolean | null;

  // ── interment_ratio ───────────────────────────────────────────
  qty_per_block: number;
  io_per_block: number;
  last_io_id?: number;
  new_io?: number | null;
  blocks_due?: number | null;
  io_to_next?: number | null;
  carry_remainder?: number;
}

export interface AutoIprStatus {
  setting: AutoIprSetting;
  io_high_id: number;
  rules: AutoIprRule[];
  due: AutoIprRule[];
  total_due: number;
}

export type AutoIprRunStatus = 'posted' | 'nothing_due' | 'skipped' | 'failed';

export interface AutoIprRun {
  id: number;
  ran_at: string;
  trigger: 'schedule' | 'manual';
  dry_run: boolean;
  status: AutoIprRunStatus;
  io_counted: number;
  io_high_id: number;
  org_code: number | null;
  requisition_id: number | null;
  document_no: string | null;
  lines: AutoIprRule[] | null;
  error: string | null;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

/** Live state: settings, every rule's progress, and what is due right now. */
export const getStatus = () => apiRequest<AutoIprStatus>(`${base}/status`);

/** Run ledger, newest first. Includes runs that did nothing. */
export const getRuns = (params: { status?: AutoIprRunStatus; per_page?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.per_page) q.set('per_page', String(params.per_page));
  const qs = q.toString();
  return apiRequest<Paginated<AutoIprRun>>(`${base}/runs${qs ? `?${qs}` : ''}`);
};

/**
 * Arm or disarm the agent. Arming matters: once enabled the scheduled run posts a real
 * requisition to the ERP with no further confirmation.
 */
export const updateSetting = (changes: Partial<Pick<AutoIprSetting, 'enabled' | 'org_code' | 'io_docstatus'>>) =>
  apiRequest<{ ok: boolean; setting: AutoIprSetting }>(`${base}/settings`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });

/**
 * Change a rule's policy or switch it on.
 *
 * The API refuses: enabling a reorder_level rule with no `reorder_level`, enabling a ratio rule
 * with no ratio, and an `order_up_to` below the `reorder_level` (which could only ever order a
 * negative quantity). Each returns 422 naming the field.
 */
export const updateRule = (
  ruleId: number,
  changes: {
    trigger_mode?: AutoIprTriggerMode;
    nvt_i_locator_id?: number;
    reorder_level?: number | null;
    order_up_to?: number | null;
    qty_per_block?: number;
    io_per_block?: number;
    enabled?: boolean;
  },
) =>
  apiRequest<{ ok: boolean; rule: unknown }>(`${base}/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });

/** Trigger a run. post=false is a dry run and never touches the ERP. */
export const runNow = (post: boolean) =>
  apiRequest<{ ok: boolean; run: AutoIprRun }>(`${base}/run`, {
    method: 'POST',
    body: JSON.stringify({ post }),
  });
