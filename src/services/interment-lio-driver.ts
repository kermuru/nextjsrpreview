import { apiRequest } from '@/lib/api';

/**
 * Direct execution of an interment ERP driver.
 *
 * Two calls, deliberately asymmetric:
 *   preview  — validates and returns the exact body that WOULD be sent. It has
 *              no code path to the executor, so it cannot write anything.
 *   runDriver — really fires the driver. Refused unless the backend's
 *              config/interment_lio_driver.php has enabled => true and the
 *              driver is on that file's allow-list.
 */

const BASE = '/v1/interment-lio-driver';

export interface DriverPreview {
  driver: string;
  module: string;
  action: string;
  url: string;
  executor_mode: string;
  dry_run_only: boolean;
  enabled: boolean;
  payload: Record<string, unknown>;
}

export interface DriverRunResult {
  ok: boolean;
  /** false when the executor was in `log` mode — the payload was built, not sent. */
  sent: boolean;
  documentno: string | null;
  error: string | null;
  data: unknown;
}

export async function previewDriver(
  name: string,
  args: Record<string, unknown>,
): Promise<DriverPreview> {
  const res = await apiRequest<{ ok: boolean; data: DriverPreview }>(
    `${BASE}/${encodeURIComponent(name)}/preview`,
    { method: 'POST', body: JSON.stringify({ args }) },
  );
  return res.data;
}

export async function runDriver(
  name: string,
  args: Record<string, unknown>,
  runBy?: string,
): Promise<DriverRunResult> {
  return apiRequest<DriverRunResult>(
    `${BASE}/${encodeURIComponent(name)}/run`,
    { method: 'POST', body: JSON.stringify({ args, run_by: runBy }) },
  );
}
