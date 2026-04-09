import { apiRequest } from '@/lib/api';
import type {
  BparDiscordUserIO,
  BparDiscordUserIOResponse,
  BparDropdownRecord,
} from '@/types/api';

export function getBparDropdownList() {
  return apiRequest<BparDropdownRecord[]>('/supplierio/discord/bpar-list');
}

export function getDiscordUserByBparId(bparId: number) {
  return apiRequest<BparDiscordUserIO>(`/supplierio/discord/${bparId}`);
}

export function createDiscordUser(payload: {
  bpar_i_person_id: number;
  s_bpartner_id?: number | null;
  discord_user_id: string;
}) {
  return apiRequest<BparDiscordUserIOResponse>('/supplierio/discord', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDiscordUser(
  bparId: number,
  payload: {
    s_bpartner_id?: number | null;
    discord_user_id: string;
  }
) {
  return apiRequest<BparDiscordUserIOResponse>(`/supplierio/discord/${bparId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteDiscordUser(bparId: number) {
  return apiRequest<{ message: string }>(`/supplierio/discord/${bparId}`, {
    method: 'DELETE',
  });
}