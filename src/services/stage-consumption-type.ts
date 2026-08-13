import { apiRequest } from '@/lib/api';

export interface EligibleStage {
  wip_i_project_scope_stage_id: number;
  stage_name: string;
  consumption_type: string | null;
  project_name: string;
  project_no: string;
  ad_org_id: number;
  gr_count: number;
  latest_gr_date: string | null;
}

export interface PagedEligibleStages {
  data: EligibleStage[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface ApplyResult {
  stage_id: number;
  success: boolean;
  consumption_type?: string;
  error?: string;
}

export interface AutoStatus {
  enabled: boolean;
}

const base = '/stage-consumption-type';

export const getEligibleStages = (params?: Record<string, string>) =>
  apiRequest<PagedEligibleStages>(`${base}/eligible${params ? '?' + new URLSearchParams(params) : ''}`);

export const applyStage = (stageId: number) =>
  apiRequest<ApplyResult>(`${base}/apply`, {
    method: 'POST',
    body: JSON.stringify({ stage_id: stageId }),
  });

export const applyBulk = (stageIds: number[]) =>
  apiRequest<{ success: boolean; total: number; success_count: number; fail_count: number; results: ApplyResult[] }>(
    `${base}/apply-bulk`,
    { method: 'POST', body: JSON.stringify({ stage_ids: stageIds }) },
  ).then(r => r.results);

export const getAutoStatus = () =>
  apiRequest<AutoStatus>(`${base}/auto-status`);

export const toggleAuto = () =>
  apiRequest<AutoStatus>(`${base}/auto-toggle`, { method: 'POST' });
