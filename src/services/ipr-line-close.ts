import { apiRequest } from '@/lib/api';

/**
 * IPR-BOQ line closing — remediation for lines stranded by the retired legacy
 * post path.
 *
 * These lines sit on PR'd IPR-BOQ documents that were posted without the ERP
 * ever consuming the BOQ budget, so the budget still reads as available and a
 * fresh Generate keeps re-offering the same items. Closing retires the line on
 * the document and deliberately leaves the budget alone, which is correct
 * precisely because nothing was consumed.
 *
 * Only "Category C" lines appear here: legacy-posted, still open, budget never
 * drawn, nothing purchase-ordered. The backend re-derives that on every call —
 * lines that are PO'd, or whose budget really was drawn, are refused with an
 * explanation, because closing either is silently destructive.
 */

export interface ClosableLine {
  nvt_t_requisition_id: number;
  documentno: string;
  ad_org_id: number;
  date_requisition: string | null;
  nvt_t_requisitionline_id: number;
  qty: string;
  qty_po: string;
  skucode: string | null;
  item_name: string | null;
  unit: string | null;
  wip_t_bomline_id: number;
  bom_qty: string;
  /** Always 0 for a closable line — shown so the operator can see why it qualifies. */
  drawn: string;
  scope_name: string | null;
  stage_name: string | null;
  wip_i_project_id: number;
  project_name: string | null;
}

export interface ClosableResponse {
  lines: ClosableLine[];
  count: number;
  documents: number;
}

export interface CloseResult {
  nvt_t_requisitionline_id: number;
  documentno: string;
  wip_t_bomline_id: number;
  qty: string;
  closed: boolean;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const BASE = '/v1/ipr-line-close';

export async function fetchClosableLines(): Promise<ClosableResponse> {
  const res = await apiRequest<Envelope<ClosableResponse>>(`${BASE}/eligible`);
  if (!res?.success) throw new Error(res?.message ?? 'Failed to load closable lines.');
  return res.data;
}

/**
 * `explanation` is required and is written to the line and its closure record —
 * it is the only durable trace of why the line was retired.
 */
export async function closeIprLine(
  lineId: number,
  explanation: string,
  remarks?: string,
): Promise<CloseResult> {
  const res = await apiRequest<Envelope<CloseResult>>(`${BASE}/${lineId}`, {
    method: 'POST',
    body: JSON.stringify({ explanation, ...(remarks ? { remarks } : {}) }),
  });
  if (!res?.success) throw new Error(res?.message ?? 'Failed to close the line.');
  return res.data;
}
