import { apiRequest } from '@/lib/api';
import type {
  NlioAssignmentRecord,
  NlioRecord,
  SupplierByItemRecord,
} from '@/types/api';

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
}) {
  return apiRequest<{ message: string; assignment: NlioAssignmentRecord }>('/supplierio/nlio/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteNlioAssignment(id: number) {
  return apiRequest<{ message: string }>(`/supplierio/nlio/assignments/${id}`, {
    method: 'DELETE',
  });
}
