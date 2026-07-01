import { apiRequest } from '@/lib/api';
import type {
  NlioAssignmentRecord,
  NlioRecord,
  PendingNlioItem,
  SupplierByItemRecord,
} from '@/types/api';

export function getPendingNlios() {
  return apiRequest<PendingNlioItem[]>('/supplierio/nlio/pending');
}

export interface NlioItemStatus {
  id: number;
  item_name: string;
  assigned: boolean;
}

export interface RecentNlioItem extends PendingNlioItem {
  assigned_count: number;
  total_items: number;
  item_status: NlioItemStatus[];
}

export function getRecentNlios(days: 7 | 15 | 30) {
  return apiRequest<RecentNlioItem[]>(`/supplierio/nlio/recent?days=${days}`);
}

export function getNlioByDocumentNo(documentNo: string) {
  return apiRequest<NlioRecord[]>(`/supplierio/nlio/${encodeURIComponent(documentNo)}`);
}

export function getSuppliersByItem(supplierItemId: number | string) {
  return apiRequest<SupplierByItemRecord[]>(`/supplierio/nlio/suppliers/by-item/${supplierItemId}`);
}

export function getAssignmentsByDocumentNo(documentNo: string) {
  return apiRequest<NlioAssignmentRecord[]>(`/supplierio/nlio/assignments/${encodeURIComponent(documentNo)}`);
}

export function createNlioAssignment(payload: {
  document_no: string;
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
  assigned_by?: string;
  service_amount?: number;
  interment_date?: string;
  interment_time?: string;
  mass_time?: string;
}) {
  return apiRequest<{ message: string; assignment: NlioAssignmentRecord }>('/supplierio/nlio/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface BudgetAmountItem {
  supplier_item_id: number;
  item_name: string;
  budget_amount: number | null;
  description: string | null;
}

export function getBudgetByDocumentNo(documentNo: string) {
  return apiRequest<BudgetAmountItem[]>(`/supplierio/nlio/budget/${encodeURIComponent(documentNo)}`);
}

export interface ServiceOrderRecord {
  id: number;
  document_no: string;
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
  assigned_by: string | null;
  service_amount: number | null;
  notified_at: string | null;
  supplier_response: 'accepted' | 'declined' | null;
  responded_at: string | null;
  created_at: string | null;
  item_name: string | null;
  item_category: string | null;
  supplier_name: string | null;
  date_interment: string | null;
}

export function getServiceOrders() {
  return apiRequest<ServiceOrderRecord[]>('/supplierio/nlio/service-orders');
}

export function deleteNlioAssignment(id: number) {
  return apiRequest<{ message: string }>(`/supplierio/nlio/assignments/${id}`, {
    method: 'DELETE',
  });
}

export interface AutoAssignResult {
  ok: boolean;
  message: string;
  output: string;
}

export function triggerAutoAssign(days = 30) {
  return apiRequest<AutoAssignResult>(`/supplierio/nlio/auto-assign?days=${days}`, {
    method: 'POST',
  });
}

export interface AutoAssignSettings {
  enabled: boolean;
  last_run_at: string | null;
  last_run_summary: unknown;
  updated_at: string | null;
}

export function getAutoAssignSettings() {
  return apiRequest<{ success: boolean; data: AutoAssignSettings }>('/supplierio/nlio/auto-assign/settings');
}

export function updateAutoAssignSettings(enabled: boolean) {
  return apiRequest<{ success: boolean; data: AutoAssignSettings; note: string }>('/supplierio/nlio/auto-assign/settings', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export function notifyMarshalsByDocument(
  documentNo: string,
  overrides?: { interment_date?: string; interment_time?: string; mass_time?: string },
) {
  return apiRequest<{ success: boolean; documentno: string; message: string }>(
    '/interment/notify-marshal-document',
    {
      method: 'POST',
      body: JSON.stringify({ documentno: documentNo, ...overrides }),
    },
  );
}
