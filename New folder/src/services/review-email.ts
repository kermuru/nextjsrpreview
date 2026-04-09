import { apiRequest } from '@/lib/api';
import type { ReviewedEmailRecord } from '@/types/api';

export function getReviewEmails() {
  return apiRequest<{ data?: ReviewedEmailRecord[] } | ReviewedEmailRecord[]>('/isReviewedEmail');
}
