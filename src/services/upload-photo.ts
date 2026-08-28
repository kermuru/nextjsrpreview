import { storageUrl, apiRequest } from '@/lib/api';
import type { ReviewContext, UploadInterredPhotoContext } from '@/types/api';

export function uploadLapidaPhoto(formData: FormData) {
  return apiRequest<unknown>('/upload-photos', {
    method: 'POST',
    body: formData
  });
}

export function updateLapidaPhoto(id: number, formData: FormData) {
  return apiRequest<unknown>(`/upload-photos/${id}`, {
    method: 'POST',
    body: formData
  });
}

export function getLapidaPhotosByDocument(documentNo: string) {
  return apiRequest<UploadInterredPhotoContext[]>(`/upload-photos/by-document/${documentNo}`);
}

export function validateLapidaPhoto(formData: FormData) {
  return apiRequest<unknown>('/upload-photos/validate-photo', {
    method: 'POST',
    body: formData
  });
}

export function getUploadPhotoContext(documentNo: string) {
  return apiRequest<ReviewContext[]>(`/intermentsUploadInterredPhotoLink_ForPost/${documentNo}`);
}

export function getAllLapidaUploads() {
  return apiRequest<UploadInterredPhotoContext[]>('/lapidaDashboard');
}

/**
 * Absolute URL for a stored interment-photo path.
 *
 * `/lapidaDashboard` resolves `photo` server-side but leaves `original_photo` as
 * a raw path, and stored values come in three shapes across existing rows
 * (`interment_photos/x.jpg`, `/storage/interment_photos/x.png`, and some full
 * URLs). Normalising here avoids a backend change just to display the original.
 */
export function intermentPhotoUrl(stored?: string | null): string | null {
  if (!stored) return null;
  if (stored.includes('http')) return stored;

  const name = stored.split('/').pop();
  return name ? storageUrl(`interment_photos/${name}`) : null;
}
