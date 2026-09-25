import { apiRequest } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * Read-only monitors for project LMC payouts and their service orders.
 *
 * Both endpoints sit behind auth:sanctum, so every call carries the admin bearer
 * token — unlike the older /supplierio/* services, which send nothing because
 * those routes ask for nothing.
 */

/**
 * Where a payout's service order stands.
 *
 *  missing      — the payout posted and NO service order row was ever created, so
 *                 the contractor was never told. This is the state worth watching:
 *                 the payout is committed in SAERP and nothing there records the gap.
 *  undelivered  — an SO row exists but Discord never confirmed delivery.
 *  pending      — delivered, no answer yet.
 *  accepted / declined — the contractor answered.
 */
export type SoState = 'missing' | 'undelivered' | 'pending' | 'accepted' | 'declined';

export type PayoutMonitorRow = {
  payout_id: number;
  documentno: string | null;
  docstatus: string | null;
  ad_org_id: number;
  date_trans: string | null;
  coverage_from: string | null;
  coverage_to: string | null;
  amt_total_payout: string | null;
  bpar_i_person_id: number | null;
  payee_name: string | null;
  scope_id: number | null;
  scope_name: string | null;
  project_name: string | null;
  so_id: number | null;
  so_state: SoState;
  so_notified_at: string | null;
  so_response: 'accepted' | 'declined' | null;
  so_responded_at: string | null;
  so_discord_user_id: string | null;
};

/** One service order, as the acceptance monitor lists it. */
export type SoMonitorRow = {
  id: number;
  wip_t_lmc_payout_id: number;
  payout_documentno: string;
  ad_org_id: number;
  project_name: string | null;
  scope_name: string | null;
  service_description: string | null;
  service_amount: string;
  bpar_i_person_id: number;
  payee_name: string | null;
  discord_user_id: string | null;
  issued_by: string | null;
  notified_at: string | null;
  discord_thread_id: string | null;
  supplier_response: 'accepted' | 'declined' | null;
  discord_responder_id: string | null;
  decline_reason: string | null;
  responded_at: string | null;
  created_at: string | null;
};

function authInit(): RequestInit {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/** Recent payouts, each annotated with its service-order state. */
export function getPayoutMonitor(params: {
  payout_org_id?: number;
  limit?: number;
  since?: string;
  so_state?: SoState;
} = {}) {
  const qs = new URLSearchParams();
  if (params.payout_org_id) qs.set('payout_org_id', String(params.payout_org_id));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.since) qs.set('since', params.since);
  if (params.so_state) qs.set('so_state', params.so_state);

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{ success: boolean; count: number; data: PayoutMonitorRow[] }>(
    `/v1/project-lmc-payout/monitor${suffix}`,
    authInit(),
  );
}

/** Recent service orders and where each stands. */
export function getSoMonitor(params: {
  status?: 'pending' | 'accepted' | 'declined' | 'undelivered';
  limit?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{ success: boolean; count: number; data: SoMonitorRow[] }>(
    `/v1/project-lmc-so/monitor${suffix}`,
    authInit(),
  );
}

export const peso = (v: string | number | null | undefined): string =>
  `₱${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
