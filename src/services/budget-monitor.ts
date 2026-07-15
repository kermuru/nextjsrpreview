import { apiRequest } from '@/lib/api';

export type ProcessedDoc = {
  documentno: string;
  type: 'irb' | 'arb' | 'exb';
  docstatus: string;
  processed_at: string | null;
  mkr: number | null;
  ckr: number | null;
  source: 'our-system' | 'java';
};

/** Recently processed IPR-IRB / ARB-IPR / EXB-ADV docs, tagged java vs our-system (maker==checker). */
export function getProcessMonitor(limit = 80) {
  return apiRequest<{ success: boolean; data: ProcessedDoc[] }>(
    `/budget-toipr/budget-requests/process-monitor?limit=${limit}`,
  );
}
