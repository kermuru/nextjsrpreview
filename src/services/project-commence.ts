import { apiRequest } from '@/lib/api';

/**
 * Project Commence — BUDGETING -> COMMENCED through the executor's
 * PROJECT-COMMENCE driver.
 *
 * /candidates is read-only. apply and applyBulk change an ERP project's status
 * unless dry_run is set, in which case the backend returns the payload it would
 * have sent and calls nothing.
 */

export interface CommenceCandidate {
  wip_i_project_id: number;
  documentno: string;
  project_name: string;
  project_status: string;
  project_type: string | null;
  purpose: string | null;
  ad_org_id: number;
  date_created: string | null;
  pending_logs: number;
  last_non_halt_status: string | null;
  tenant_ok: boolean;
  previously_commenced: boolean;
  eligible: boolean;
  blocked_reason: string | null;
}

export interface PagedCandidates {
  success: boolean;
  data: CommenceCandidate[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  allowed_orgs: number[];
}

/** What the driver reports back for a successful run. */
export interface DriverResponse {
  status?: string;
  module?: string;
  action?: string;
  wipIProjectLogsId?: number;
  dr?: {
    wipIProjectLogsId?: number;
    logsAction?: string;
    logsStatus?: string;
    requestedStatus?: string;
    documentNo?: string;
  };
  pr?: {
    wipIProjectId?: number;
    documentNo?: string;
    projectName?: string;
    projectStatus?: string;
  };
  stage?: string;
  error?: string;
}

export interface ApplyResult {
  success: boolean;
  dry_run: boolean;
  project: Partial<CommenceCandidate> & { wip_i_project_id: number };
  error: string | null;
  stage?: string | null;
  payload?: { usercode: number; orgCode: number; wipIProjectId: number };
  endpoint?: string;
  driverResponse?: DriverResponse;
}

export interface BulkResultRow {
  project_id: number;
  documentno: string | null;
  success: boolean;
  error: string | null;
  projectStatus: string | null;
}

export interface BulkResult {
  success: boolean;
  dry_run: boolean;
  total: number;
  success_count: number;
  fail_count: number;
  results: BulkResultRow[];
}

const base = '/project-commence';

export const getCandidates = (params?: Record<string, string>) =>
  apiRequest<PagedCandidates>(`${base}/candidates${params ? '?' + new URLSearchParams(params) : ''}`);

export const commenceProject = (projectId: number, dryRun: boolean) =>
  apiRequest<ApplyResult>(`${base}/apply`, {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, dry_run: dryRun }),
  });

export const commenceBulk = (projectIds: number[], dryRun: boolean) =>
  apiRequest<BulkResult>(`${base}/apply-bulk`, {
    method: 'POST',
    body: JSON.stringify({ project_ids: projectIds, dry_run: dryRun }),
  });
