import { apiRequest } from '@/lib/api';
import { getToken } from '@/lib/auth';

// Backend: routes/api.php  /v1/supplier-review-request/*
// (SupplierReviewRequestSettingController) — auth:sanctum + staff.
const base = '/v1/supplier-review-request';

export interface ReviewerDiscordState {
  /** Whether this employee has linked Discord in the mobile app. */
  linked: boolean;
  /** Their Discord display name, when linked. The snowflake is never sent. */
  username: string | null;
}

export interface ReviewerSetting {
  /** 'setting' once someone has been chosen here; 'config' while the default stands. */
  source: 'setting' | 'config';
  s_bpartner_employee_id: number | null;
  reviewer_name: string | null;
  updated_by: string | null;
  updated_at: string | null;
  discord: ReviewerDiscordState;
  /** Whether the automation is currently on. */
  feature_enabled: boolean;
  /** 'setting' when switched here; 'config' while the deployed default stands. */
  enabled_source: 'setting' | 'config';
}

export interface EmployeeHit {
  s_bpartner_employee_id: number;
  employee_no: string | null;
  name: string;
  discord_linked: boolean;
  discord_username: string | null;
}

/** One assignment's outcome from a manual send. */
export interface SendRow {
  assignment_id: number;
  document_no: string;
  service: string | null;
  date_interment: string | null;
  status: string | null;
  /** Present only on a link that was actually delivered. */
  url: string | null;
}

export interface SendResult {
  due: number;
  sent: number;
  failed: number;
  skipped: number;
  rows: SendRow[];
}

function authInit(): RequestInit {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/** Who currently receives the photographer review DM. */
export const getReviewer = () =>
  apiRequest<{ success: boolean; data: ReviewerSetting }>(`${base}/settings`, authInit())
    .then((r) => r.data);

/** Employee search for the picker. Needs at least 2 characters. */
export const searchEmployees = (q: string) =>
  apiRequest<{ success: boolean; data: EmployeeHit[] }>(
    `${base}/employees?q=${encodeURIComponent(q)}`,
    authInit(),
  ).then((r) => r.data);

/**
 * Name the reviewer. Only the employee id is sent — the backend derives the
 * name from TAPS, so the attribution written onto reviews can never be set
 * from here.
 */
export const setReviewer = (employeeId: number) =>
  apiRequest<{ success: boolean; data: ReviewerSetting; message: string }>(`${base}/settings`, {
    ...authInit(),
    method: 'PUT',
    body: JSON.stringify({ s_bpartner_employee_id: employeeId }),
  });

/**
 * Switch the whole automation on or off.
 *
 * Off is a real stop, not a filter: the nightly run still reports what it would
 * have sent, but mints no link and delivers nothing.
 */
export const setEnabled = (enabled: boolean) =>
  apiRequest<{ success: boolean; data: ReviewerSetting; message: string }>(`${base}/settings`, {
    ...authInit(),
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });

/**
 * Send the review link for one interment order, now.
 *
 * Same path as the nightly run minus the date window, so an order that pass has
 * already gone by can still be sent. `dryRun` previews without minting or
 * sending. A live send requires the automation to be on.
 */
export const sendForDocument = (documentNo: string, dryRun: boolean) =>
  apiRequest<{ success: boolean; data: SendResult; message: string }>(`${base}/send`, {
    ...authInit(),
    method: 'POST',
    body: JSON.stringify({ document_no: documentNo, dry_run: dryRun }),
  });
