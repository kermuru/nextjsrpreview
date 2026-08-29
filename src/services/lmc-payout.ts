import { apiRequest } from '@/lib/api';

export interface ServicePayoutHistoryRecord {
  io_documentno: string;
  payout_id: number;
  payout_documentno: string;
  docstatus: string;                 // 'DR' | 'PR'
  source: 'portal' | 'java' | string;
  payee_name: string | null;
  line_descriptions: string | null;
  amt_total_payout_net: number | null;
  date_interment: string | null;
  date_coverage_from: string | null;
  date_coverage_to: string | null;
  date_trans: string | null;
}

export interface CancelPayoutResult {
  ok: boolean;
  message: string;
  data: {
    cancelled_payout_id: number;
    original_documentno: string;
    cancel_documentno: string;
    lines_reversed: number;
    reason: string;
    cancelled_at: string;
  };
}

export const LmcPayoutService = {
  /** GET /interment/lmc-payout/service-history — all interment service payouts. */
  async listServicePayoutHistory(io?: string): Promise<{ ok: boolean; data: ServicePayoutHistoryRecord[] }> {
    const q = io ? `?io=${encodeURIComponent(io)}` : '';
    return apiRequest<{ ok: boolean; data: ServicePayoutHistoryRecord[] }>(`/interment/lmc-payout/service-history${q}`);
  },

  /**
   * POST /interment/lmc-payout/{payoutId}/cancel-pr — cancel a PROCESSED (PR)
   * payout: creates the -CA counter-document and frees the budget line.
   * The backend blocks (HTTP 422) if already cancelled, liquidated, or has returns.
   */
  async cancelPayout(payoutId: number, reason: string): Promise<CancelPayoutResult> {
    return apiRequest<CancelPayoutResult>(`/interment/lmc-payout/${payoutId}/cancel-pr`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};
