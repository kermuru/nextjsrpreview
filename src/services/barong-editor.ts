import { apiRequest, apiUrl } from '@/lib/api';

/**
 * Barong Image Editor — sheet-driven batch photo re-dressing.
 *
 * Backend: App\Domain\BarongEditor in core-system (migrated from the standalone
 * barong-image-editor PHP app, itself a port of the n8n "My workflow 20").
 * Per eligible row of a public Google Sheet: download `photolink` → OpenAI
 * /v1/images/edits with the Barong prompt → store the resulting PNG.
 *
 * Two ways to drain the queue, both exposed here:
 *   processNext  synchronous, ONE photo per call — the page loops so each job can
 *                be watched flipping pending → processing → done/failed. The call
 *                blocks for the 1–3 minutes the edit actually takes.
 *   dispatchPending  hands every pending job to the backend queue worker and
 *                returns at once; the page just keeps polling getStatus().
 */

export type BarongStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface BarongJob {
  id: number;
  name: string | null;
  /** Raw sex value captured from the sheet. */
  sex: string | null;
  /** What that resolved to: barong | filipiniana. */
  garment: string | null;
  photolink: string;
  status: BarongStatus;
  /** Set once the source photo is stored — the "before" thumbnail. */
  input_path: string | null;
  /** Set once the edit lands — the "after" thumbnail. */
  output_path: string | null;
  /** True when the canvas was grown and missing body generated, rather than re-dressed in place. */
  extended: boolean;
  /** Detected crop: upper_chest | lower_chest | full_torso. */
  framing: string | null;
  /** The arms left the frame and had to be reconstructed. */
  arms_cut: boolean;
  /** Head height as a fraction of the source photo; sets the body scale. */
  head_fraction: number | null;
  duration_ms: number | null;
  attempts: number;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BarongCounts {
  pending: number;
  processing: number;
  done: number;
  failed: number;
}

/** Backend-side settings, echoed so the page states the live filter/engine. */
export interface BarongConfig {
  model: string;
  mask_mode: string;
  detect_mode: string;
  /** Garment used when the sheet's sex cell is blank or unrecognised. */
  garment_default: string;
  /** down = arms repositioned straight down and cropped at the wrists. */
  arms_pose: string;
  filter: { action: string; status_not: string };
}

export interface BarongStatusResponse {
  ok: boolean;
  counts: BarongCounts;
  jobs: BarongJob[];
  config: BarongConfig;
}

export interface SyncResult {
  ok: boolean;
  created: number;
  skipped: number;
  eligible: number;
}

export interface ProcessResult {
  ok: boolean;
  /** false = nothing was pending, the queue is drained. */
  processed: boolean;
  job: BarongJob | null;
}

const base = '/v1/barong-editor';

export const getStatus = () => apiRequest<BarongStatusResponse>(`${base}/status`);

/** Pull the sheet and queue a job per eligible row (deduped by photolink). */
export const syncSheet = () => apiRequest<SyncResult>(`${base}/sync`, { method: 'POST' });

/** Run the next pending job to completion. Slow by design — one paid edit. */
export const processNext = () => apiRequest<ProcessResult>(`${base}/process-next`, { method: 'POST' });

/** Queue every pending job on the backend worker instead of looping here. */
export const dispatchPending = () =>
  apiRequest<{ ok: boolean; dispatched: number }>(`${base}/dispatch`, { method: 'POST' });

/** Requeue failed + stuck-in-processing jobs. */
export const retryStuck = () =>
  apiRequest<{ ok: boolean; requeued: number }>(`${base}/retry`, { method: 'POST' });

/**
 * Requeue jobs that already ran, for a fresh edit (e.g. after the prompt or the
 * mask mode changed). Without an id this re-pays for every settled job.
 */
export const reprocess = (id?: number) =>
  apiRequest<{ ok: boolean; requeued: number }>(`${base}/reprocess${id ? `/${id}` : ''}`, { method: 'POST' });

/**
 * URL of a job's before/after image. `stamp` (the job's updated_at) busts the
 * browser cache so a reprocessed photo shows its new output, not the old one.
 */
export const jobImageUrl = (id: number, type: 'input' | 'output', stamp?: string | null) => {
  const p = new URLSearchParams({ type });
  if (stamp) p.set('t', String(Date.parse(stamp) || ''));
  return apiUrl(`${base}/jobs/${id}/image?${p}`);
};

/* ── On-upload behaviour (dashboard toggle) ───────────────────────────────────
 * Controls what happens to a portrait the family uploads through the portal.
 *
 *   on  — the upload is re-dressed; the DRESSED photo is what the lapida engraver
 *         and the video livestreaming supplier receive, and what goes to Drive.
 *   off — the raw upload is what suppliers receive, archived to Drive as-is.
 *
 * Suppliers read the photo live from the upload row when their service order is
 * built, so switching this changes what they get from the next order onward.
 */

export interface BarongSetting {
  /** ON = re-dress on upload. Each upload becomes a paid image generation. */
  dress_on_upload: boolean;
  /** Archive the supplier-facing photo (dressed or raw) to Google Drive. */
  archive_to_drive: boolean;
  updated_by: string | null;
  updated_at: string | null;
  /** Plain-language consequence of the current state, from the backend. */
  effect: string;
}

export const getBarongSetting = () =>
  apiRequest<{ ok: boolean; data: BarongSetting }>(`${base}/setting`).then((r) => r.data);

export const updateBarongSetting = (
  changes: Partial<Pick<BarongSetting, 'dress_on_upload' | 'archive_to_drive'>>,
  updatedBy?: string,
) =>
  apiRequest<{ ok: boolean; data: BarongSetting; message: string }>(`${base}/setting`, {
    method: 'PUT',
    body: JSON.stringify({ ...changes, updated_by: updatedBy }),
  });

/* ── Portal uploads ───────────────────────────────────────────────────────────
 * Dressing a family's uploaded portrait by hand. `dressed` is derived from
 * whether an original was set aside, so there is one fact in one place.
 */

export interface BarongUpload {
  id: number;
  document_no: string;
  occupant: string | null;
  gender: string | null;
  uploader_name: string | null;
  dressed: boolean;
  /** What suppliers receive. */
  photo_url: string | null;
  /** The family's upload, once set aside. */
  original_url: string | null;
  barong_edit_id: number | null;
  gdrive_link: string | null;
  /** Drive archiving is optional — a failure never loses the edit. */
  drive_error: string | null;
  created_at: string | null;
}

/** Photos uploaded against one interment document. */
export const getUploads = (documentNo: string) =>
  apiRequest<{ ok: boolean; document_no: string; photos: BarongUpload[] }>(
    `${base}/uploads/${encodeURIComponent(documentNo)}`,
  );

/** Dress one portrait. Slow by design — one paid edit, 1–3 minutes. */
export const dressUpload = (id: number, force = false) =>
  apiRequest<{ ok: boolean; photo: BarongUpload }>(`${base}/uploads/${id}/dress`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });

/** Put the family's original back. Generates nothing, costs nothing. */
export const revertUpload = (id: number) =>
  apiRequest<{ ok: boolean; photo: BarongUpload }>(`${base}/uploads/${id}/revert`, {
    method: 'POST',
  });

