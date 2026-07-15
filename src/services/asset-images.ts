import { apiRequest, apiUrl } from '@/lib/api';
import { resizeImageFile, imageDimensions, renameWithExtForType } from '@/lib/images';
import { getUserName } from '@/lib/auth';

export type AssetImage = {
  id: number;
  title: string | null;
  original_name: string;
  hd_path: string;
  ld_path: string;
  hd_size: number;
  ld_size: number;
  width: number | null;
  height: number | null;
  mime: string | null;
  uploaded_by: string | null;
  hd_url: string | null;
  ld_url: string | null;
  created_at: string;
  updated_at: string;
};

// Rendition targets. HD = high quality for viewing/download; LD = small fast preview.
// Both are produced in the browser (Canvas) so the raw original never leaves the client.
export const HD_MAX_DIMENSION = 2560;
export const HD_QUALITY = 0.9;
export const LD_MAX_DIMENSION = 800;
export const LD_QUALITY = 0.5;

/** Build the two compressed renditions for one source file. */
export async function buildRenditions(file: File): Promise<{ hd: File; ld: File; width: number; height: number }> {
  const { width, height } = await imageDimensions(file);
  // Force JPEG so the quality setting actually compresses (PNG ignores it).
  const hd = await resizeImageFile(file, HD_MAX_DIMENSION, HD_QUALITY, 'image/jpeg');
  const ld = await resizeImageFile(file, LD_MAX_DIMENSION, LD_QUALITY, 'image/jpeg');
  return { hd, ld, width, height };
}

export function listAssetImages() {
  return apiRequest<{ success: boolean; data: AssetImage[] }>(`/v1/asset-images`).then((r) => r.data);
}

/**
 * Compress one source image into HD + LD and upload it.
 * @param onProgress optional 0..100 upload progress for this file.
 */
export async function uploadAssetImage(
  file: File,
  opts: { title?: string; onProgress?: (pct: number) => void } = {}
): Promise<AssetImage> {
  const { hd, ld, width, height } = await buildRenditions(file);

  const form = new FormData();
  form.append('hd', hd, renameWithExtForType(file.name, 'image/jpeg'));
  form.append('ld', ld, renameWithExtForType(file.name, 'image/jpeg'));
  form.append('original_name', file.name);
  form.append('width', String(width));
  form.append('height', String(height));
  if (opts.title) form.append('title', opts.title);
  const uploader = getUserName();
  if (uploader) form.append('uploaded_by', uploader);

  // Use XHR when a progress callback is provided; otherwise the shared apiRequest.
  if (opts.onProgress) {
    return xhrUpload(apiUrl('/v1/asset-images'), form, opts.onProgress);
  }
  const res = await apiRequest<{ success: boolean; data: AssetImage }>(`/v1/asset-images`, {
    method: 'POST',
    body: form,
  });
  return res.data;
}

export function deleteAssetImage(id: number) {
  return apiRequest<{ success: boolean; message: string }>(`/v1/asset-images/${id}`, { method: 'DELETE' });
}

export function bulkDeleteAssetImages(ids: number[]) {
  return apiRequest<{ success: boolean; deleted: number[]; deletedCount: number }>(
    `/v1/asset-images/bulk-delete`,
    { method: 'POST', body: JSON.stringify({ ids }) },
  );
}

/** Endpoint that streams the HD rendition as a download with a friendly filename. */
export function assetImageDownloadUrl(id: number): string {
  return apiUrl(`/v1/asset-images/${id}/download`);
}

function xhrUpload(url: string, form: FormData, onProgress: (pct: number) => void): Promise<AssetImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let payload: { success?: boolean; data?: AssetImage; message?: string } = {};
      try { payload = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload.success && payload.data) resolve(payload.data);
      else reject(new Error(payload.message || `Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}
