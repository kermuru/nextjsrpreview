import { apiRequest } from '@/lib/api';
import type { ReviewContext } from '@/types/api';

export function getInterment(documentNo: string) {
  return apiRequest<ReviewContext[]>(`/intermentsReviewLink/${documentNo}`);
}
