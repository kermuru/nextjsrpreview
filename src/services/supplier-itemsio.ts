import { apiRequest } from '@/lib/api';
import type { SupplierItemIO, SupplierItemIOResponse } from '@/types/api';

export function getSupplierItems() {
  return apiRequest<SupplierItemIO[]>('/supplierio/items');
}

export function getActiveSupplierItems() {
  return apiRequest<SupplierItemIO[]>('/supplierio/items/active');
}

export function getSupplierItem(id: number) {
  return apiRequest<SupplierItemIO>(`/supplierio/items/${id}`);
}

export function createSupplierItem(payload: {
  item_name: string;
  item_category: string;
  is_active: boolean;
}) {
  return apiRequest<SupplierItemIOResponse>('/supplierio/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSupplierItem(
  id: number,
  payload: {
    item_name: string;
    item_category: string;
    is_active: boolean;
  }
) {
  return apiRequest<SupplierItemIOResponse>(`/supplierio/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteSupplierItem(id: number) {
  return apiRequest<{ message: string }>(`/supplierio/items/${id}`, {
    method: 'DELETE',
  });
}