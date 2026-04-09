import { apiRequest } from '@/lib/api';
import type { Review, ReviewContext } from '@/types/api';

export function getReviewContext(documentNo: string) {
  return apiRequest<ReviewContext[]>(`/intermentsReviewLink/${documentNo}`);
}

export function submitReview(formData: FormData) {
  return apiRequest<unknown>('/review', {
    method: 'POST',
    body: formData
  });
}

export function getAllReviews() {
  return apiRequest<Review[]>('/allReviews');
}
