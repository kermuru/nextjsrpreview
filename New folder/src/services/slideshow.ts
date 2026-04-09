import { apiRequest } from '@/lib/api';
import type { ReviewContext, SlideshowRecord } from '@/types/api';

export function uploadSlideshow(formData: FormData) {
  return apiRequest<unknown>('/slideshow', {
    method: 'POST',
    body: formData
  });
}

export function getSlideshowByDocument(documentNo: string) {
  return apiRequest<SlideshowRecord>(`/slideshow/${documentNo}`);
}

export function deleteSlideshowPhoto(slideshowId: number, photoUrl: string) {
  return apiRequest<{ photos?: string[] }>(`/slideshow/photo/${slideshowId}`, {
    method: 'DELETE',
    body: JSON.stringify({ photo_url: photoUrl })
  });
}

export function deleteSlideshow(slideshowId: number) {
  return apiRequest<unknown>(`/slideshow/${slideshowId}`, { method: 'DELETE' });
}

export function getSlideshowContext(documentNo: string) {
  return apiRequest<ReviewContext[]>(`/slideshow/${documentNo}`);
}

export function checkSlideshowOrientation(formData: FormData) {
  return apiRequest<unknown>('/slideshow/check_orient', {
    method: 'POST',
    body: formData
  });
}
