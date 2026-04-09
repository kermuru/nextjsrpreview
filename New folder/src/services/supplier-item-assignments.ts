import { apiRequest } from '@/lib/api';
import type {
  SupplierAssignableItem,
  SupplierAssignableMapping,
  SupplierAssignableSupplier,
} from '@/types/api';

export function getAssignableSuppliers() {
  return apiRequest<SupplierAssignableSupplier[]>('/supplierio/assignable-suppliers');
}

export function getAssignableItems() {
  return apiRequest<SupplierAssignableItem[]>('/supplierio/assignable-items');
}

export function getSelectedSupplierItems() {
  return apiRequest<SupplierAssignableMapping[]>('/supplierio/selected-items');
}

export function getItemsBySupplier(sBpartnerId: number | string) {
  return apiRequest<SupplierAssignableMapping[]>(`/supplierio/selected-items/supplier/${sBpartnerId}`);
}

export function createSupplierItemAssignment(payload: {
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
}) {
  return apiRequest<{ message: string; record: SupplierAssignableMapping }>('/supplierio/selected-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteSupplierItemAssignment(id: number) {
  return apiRequest<{ message: string }>(`/supplierio/selected-items/${id}`, {
    method: 'DELETE',
  });
}
