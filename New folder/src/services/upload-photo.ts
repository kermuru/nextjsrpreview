import { apiRequest } from '@/lib/api';
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
