import { apiRequest } from '@/lib/api';

export interface ClosureSummary {
  auto_closed: number;
  manual_closed: number;
  commenced: number;
  blocked_logged: number;
}

export interface AutoClosedProject {
  wip_i_project_id: number;
  project_name: string;
  project_type: string;
  ad_org_id: number;
  category_name: string;
  documentno: string;
  amt_closure: number | null;
  date_closure: string | null;
  acct_no: string | null;
  acct_title: string | null;
}

export interface ManualClosedProject {
  wip_i_project_id: number;
  project_name: string;
  project_type: string;
  ad_org_id: number;
  category_name: string;
  documentno: string;
  amt_closure: number | null;
  date_closure: string | null;
  closed_by: string | null;
}

export interface FailedRule {
  label: string;
  details: string[];
}

export interface CommencedProject {
  project_id: number;
  project_name: string;
  project_type: string;
  category_name: string;
  ad_org_id: number;
  eligible: boolean;
  failed_rules: FailedRule[];
  failed_count: number;
}

export interface ClosureLog {
  id: number;
  run_id: string;
  run_at: string;
  triggered_by: string;
  saerp_project_id: number | null;
  project_name: string | null;
  project_type: string | null;
  project_category: string | null;
  ad_org_id: number | null;
  result: 'closed' | 'blocked' | 'skipped' | 'error';
  closure_documentno: string | null;
  amt_closure: number | null;
  failed_rules: FailedRule[] | null;
  error_message: string | null;
  created_at: string;
}

export interface RunSummary {
  run_id: string;
  triggered_by: string;
  run_at: string;
  closed: number;
  blocked: number;
  skipped: number;
  errors: number;
  total_checked: number;
}

export interface FilterOptions {
  orgs: { ad_org_id: number; org_name: string }[];
  project_types: string[];
}

const base = '/project-closure/dashboard';

export const getClosureSummary = (params?: Record<string, string>) =>
  apiRequest<ClosureSummary>(`${base}/summary${params ? '?' + new URLSearchParams(params) : ''}`);

export interface PagedResponse<T> {
  data: T[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export const getAutoClosedProjects = (params?: Record<string, string>) =>
  apiRequest<PagedResponse<AutoClosedProject>>(`${base}/auto-closed${params ? '?' + new URLSearchParams(params) : ''}`);

export const getManualClosedProjects = (params?: Record<string, string>) =>
  apiRequest<PagedResponse<ManualClosedProject>>(`${base}/manual-closed${params ? '?' + new URLSearchParams(params) : ''}`);

export const getCommencedProjects = (params?: Record<string, string>) =>
  apiRequest<{ data: CommencedProject[]; total: number; per_page: number; current_page: number; last_page: number }>(
    `${base}/commenced${params ? '?' + new URLSearchParams(params) : ''}`
  );

export const getClosureLogs = (params?: Record<string, string>) =>
  apiRequest<{ data: ClosureLog[]; total: number; last_page: number }>(`${base}/logs${params ? '?' + new URLSearchParams(params) : ''}`);

export const getRunSummary = () =>
  apiRequest<RunSummary[]>(`${base}/run-summary`);

export const getClosureFilters = () =>
  apiRequest<FilterOptions>(`${base}/filters`);

export interface TriggerResult {
  run_id: string;
  triggered_by: string;
  run_at: string;
  date_closure: string;
  total_checked: number;
  closed: number;
  blocked: number;
  errors: number;
}

export interface PendingCheckerItem {
  closure_id: number;
  documentno: string;
  docstatus: string;
  amt_closure: number | null;
  date_closure: string | null;
  date_created: string | null;
  wip_i_project_id: number;
  project_name: string;
  project_type: string;
  ad_org_id: number;
  category_name: string;
  debit_acct_no: string | null;
  debit_acct_title: string | null;
  credit_acct_no: string | null;
  credit_acct_title: string | null;
}

export interface ClosureReportSection {
  description?: string;
  budget?: number | null;
  actual?: number | null;
  variance?: number | null;
}

export interface ClosureReport {
  closure_id: number;
  documentno: string;
  docstatus: string;
  amt_closure: number | null;
  date_closure: string | null;
  project_id: number;
  project: Record<string, unknown> | null;
  material_consumption: { budget: number; actual: number; variance: number } | null;
  lmc_consumption: { budget: number; actual: number; variance: number } | null;
  unconsumed_bom: Array<{ sku_description: string; qty_totalbom: number; qty_totalconsumed: number; qty_remaining: number }>;
  unconsumed_lmc: Array<{ description: string; lmc_type: string; budget: number; paid: number; remaining: number }>;
  unconsumed_acct_pair: Array<{ acct_no: string; acct_title: string; budget: number; paid: number; remaining: number }>;
}

export const getPendingChecker = () =>
  apiRequest<PendingCheckerItem[]>(`${base}/pending-checker`);

export const getClosureReport = (closureId: number) =>
  apiRequest<ClosureReport>(`${base}/closure-report/${closureId}`);

export const processClosureDR = (closureId: number) =>
  apiRequest<{ documentno_pr: string; docstatus: string; amt_closure: number; processed_at: string }>(
    `/project-closure/${closureId}/process`,
    { method: 'POST' }
  );

export const triggerAutoClose = (dateClosure: string, options?: { projectId?: number; batch?: number }) =>
  apiRequest<TriggerResult>(`${base}/trigger`, {
    method: 'POST',
    body: JSON.stringify({
      triggered_by: 'manual_trigger',
      date_closure: dateClosure,
      ...(options?.projectId ? { project_id: options.projectId } : {}),
      ...(options?.batch     ? { batch: options.batch }           : {}),
    }),
  });
