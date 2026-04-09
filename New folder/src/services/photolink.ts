// import { apiRequest } from '@/lib/api';
// import type { PhotoLinkRecord } from '@/types/api';

// export function storeLinks(documentNo: string, links: { link: string; photographer_name: string }[]) {
//   return apiRequest<PhotoLinkRecord[]>('/storage', {
//     method: 'POST',
//     body: JSON.stringify({ document_no: documentNo, links })
//   });
// }

// export function getLinks(documentNo: string) {
//   return apiRequest<PhotoLinkRecord[]>(`/storage/view-links/${documentNo}`);
// }

// export function updateLink(id: number, payload: { link: string; photographer_name: string }) {
//   return apiRequest<PhotoLinkRecord>(`/storage/${id}`, {
//     method: 'PUT',
//     body: JSON.stringify(payload)
//   });
// }

// export function getAllLinks() {
//   return apiRequest<PhotoLinkRecord[]>('/storage/view-links');
// }

// export function validateDocument(documentNo: string) {
//   return apiRequest<unknown>(`/storage/savelink/${documentNo}`);
// }


import { apiRequest } from '@/lib/api';
import type { PhotoLinkRecord } from '@/types/api';

export function storeLinks(documentNo: string, links: { link: string; photographer_name: string }[]) {
  return apiRequest<PhotoLinkRecord[]>('/storage', {
    method: 'POST',
    body: JSON.stringify({
      document_no: documentNo,
      links
    })
  });
}

export function getLinks(documentNo: string) {
  return apiRequest<PhotoLinkRecord[]>(`/storage/view-links/${documentNo}`);
}

export function updateLink(id: number, payload: { link: string; photographer_name: string }) {
  return apiRequest<PhotoLinkRecord>(`/storage/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function getAllLinks() {
  return apiRequest<PhotoLinkRecord[]>(`/storage/view-links`);
}

export function validateDocument(documentNo: string) {
  return apiRequest(`/storage/savelink/${documentNo}`);
}