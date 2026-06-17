import { apiRequest } from '@/lib/api';
import type { MarshalDiscordUser } from '@/types/api';

export function getMarshalUsers() {
  return apiRequest<MarshalDiscordUser[]>('/interment/marshals');
}

export function createMarshalUser(payload: { discord_user_id: string; name: string }) {
  return apiRequest<MarshalDiscordUser>('/interment/marshals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteMarshalUser(id: number) {
  return apiRequest<{ message: string }>(`/interment/marshals/${id}`, {
    method: 'DELETE',
  });
}

export function toggleMarshalUser(id: number) {
  return apiRequest<MarshalDiscordUser>(`/interment/marshals/${id}/toggle`, {
    method: 'PATCH',
  });
}
