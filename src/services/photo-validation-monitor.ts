import { apiRequest } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * Read side of the interment photo-validation monitor.
 *
 * Backs GET /upload-photos/validation-runs in core-system, which logs every
 * attempt against the in-house validator. POST /upload-photos/validate-photo —
 * the URL both uploaders already call — now routes to that validator, so this
 * board covers all live traffic. The n8n webhook it replaced recorded nothing,
 * so there is no history here from before the cutover.
 */

export type ValidationOutcome = 'pass' | 'fail' | 'error';

/** One row of wbs_i_photo_validation_runs. Carries no image — only facts about one. */
export type PhotoValidationRun = {
  id: number;
  document_no: string | null;
  occupant_name: string | null;
  outcome: ValidationOutcome;
  is_valid: boolean;
  output: string | null;
  model: string | null;
  duration_ms: number | null;
  http_status: number | null;
  error_message: string | null;
  image_bytes: number | null;
  image_mime: string | null;
  image_hash: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Which validator POST /upload-photos/validate-photo currently reaches, read
 * live from the backend's route table.
 *
 * 'n8n' means the route was rolled back to the legacy webhook — which records
 * nothing, so the board will stop gaining rows while that is true.
 */
export type EngineInfo = {
  engine: 'in-house' | 'n8n' | 'unknown';
  handler: string | null;
  recording: boolean;
  uploader_path: string | null;
};

export type ValidationRunsResponse = {
  window_days: number;
  model: string;
  engine: EngineInfo;
  counts: { pass: number; fail: number; error: number; total: number };
  /** Percent of DECIDED runs that passed — null when nothing was decided yet. */
  pass_rate: number | null;
  avg_duration_ms: number | null;
  runs: PhotoValidationRun[];
};

function authInit(): RequestInit {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export async function getValidationRuns(
  params: { days?: number; outcome?: ValidationOutcome | 'all'; limit?: number } = {},
): Promise<ValidationRunsResponse> {
  const query = new URLSearchParams();

  if (params.days) query.set('days', String(params.days));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.outcome && params.outcome !== 'all') query.set('outcome', params.outcome);

  const qs = query.toString();

  return apiRequest<ValidationRunsResponse>(
    `/upload-photos/validation-runs${qs ? `?${qs}` : ''}`,
    authInit(),
  );
}
