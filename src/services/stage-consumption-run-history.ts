import { apiRequest } from '@/lib/api';

/**
 * Auto-run monitoring for the stage:auto-set-consumption-type sweep.
 *
 * Read-only. The backend rebuilds each run from the log lines the scheduled
 * command already writes, so nothing here triggers a run or changes a stage.
 */

export type RunStatus =
  | 'success'     // every stage applied
  | 'partial'     // some applied, some rejected
  | 'failed'      // nothing applied
  | 'idle'        // ran, found nothing to do
  | 'skipped'     // auto-schedule was off
  | 'aborted'     // misconfigured — exited before touching anything
  | 'incomplete'; // started but never logged a summary

export type RunEventKind = 'applied' | 'rejected' | 'unreachable';

export interface RunEvent {
  at: string;
  level: string;
  message: string;
  kind: RunEventKind;
  stage_id: number | null;
  label: string | null;
  project_no: string | null;
  stage_name: string | null;
  http_status: number | null;
  error: string | null;
}

export interface RunRow {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  eligible: number | null;
  total: number;
  success: number;
  fail: number;
  partial_window: boolean;
  applied_count: number;
  rejected_count: number;
  event_count: number;
  duration_seconds: number | null;
  status: RunStatus;
  note?: string;
  events?: RunEvent[];
}

export interface RunDetail extends RunRow {
  events: RunEvent[];
}

export interface HistoryMeta {
  log_readable: boolean;
  log_path: string;
  timezone: string;
  window_from: string | null;
  truncated: boolean;
}

export interface PagedRuns {
  success: boolean;
  data: RunRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  meta: HistoryMeta;
}

export interface RunSummary {
  auto_enabled: boolean;
  last_run: {
    run_id: string;
    started_at: string;
    finished_at: string | null;
    status: RunStatus;
    total: number;
    success: number;
    fail: number;
    duration_seconds: number | null;
  } | null;
  next_run_at: string | null;
  today: { runs: number; applied: number; failed: number };
  last_7_days: { runs: number; applied: number; failed: number };
  last_failure: {
    at: string;
    stage_id: number | null;
    label: string | null;
    error: string;
  } | null;
  top_errors: { error: string; count: number }[];
}

const base = '/stage-consumption-type';

export const getRunHistory = (params?: Record<string, string>) =>
  apiRequest<PagedRuns>(`${base}/run-history${params ? '?' + new URLSearchParams(params) : ''}`);

export const getRun = (runId: string) =>
  apiRequest<{ success: boolean; data: RunDetail }>(`${base}/run-history/${runId}`).then(r => r.data);

export const getRunSummary = () =>
  apiRequest<{ success: boolean; data: RunSummary; meta: HistoryMeta }>(`${base}/run-summary`);
