import { apiRequest } from '@/lib/api';

export type MarshalThreadStatus = 'keeping_alive' | 'done' | 'unknown';

export type MarshalThreadRow = {
  documentno: string;
  occupant: string | null;
  date_interment: string | null;
  days_to_go: number | null;
  status: MarshalThreadStatus;
  thread_id: string;
  notified_at: string | null;
  last_refreshed: string | null;
};

export type MarshalThreadMonitorResponse = {
  success: boolean;
  data: MarshalThreadRow[];
  summary: { keeping_alive: number; done: number; total: number };
};

/**
 * Status board for the backend "interment:refresh-marshal-threads" job — every
 * marshal Discord thread being kept alive, its interment date, days remaining,
 * and when it was last refreshed.
 */
export function getMarshalThreadMonitor() {
  return apiRequest<MarshalThreadMonitorResponse>('/interment/marshal-threads/monitor');
}
