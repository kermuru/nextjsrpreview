import { apiRequest } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * Project LMC payee -> Discord mapping.
 *
 * SEPARATE FROM discord-usersio.ts on purpose. That one talks to
 * /supplierio/discord (table wbs_i_bpar_discord_usersio), which is shared by the
 * interment notifier and nine other services, cannot hold employees at all
 * (bpar_i_person_id is NOT NULL and active employees have no person row), and is
 * unauthenticated. This talks to /v1/project-lmc-payee-discord, which is its own
 * table and sits behind auth:sanctum.
 *
 * Every call therefore sends the admin bearer token — unlike the supplierio
 * services, which send nothing because those routes ask for nothing.
 */

/** A person or employee who could be mapped, as /candidates returns them. */
export type PayeeCandidate = {
  /** 'person' = bpar_i_person (contractor/supplier); 'employee' = s_bpartner_employee. */
  subject_type: 'person' | 'employee';
  /** bpar_i_person_id or s_bpartner_employee_id, depending on subject_type. */
  subject_id: number;
  s_bpartner_id: number | null;
  display_name: string | null;
  email: string | null;
  contact_number: string | null;
  /** Set when this candidate already has a mapping. */
  mapping_id: number | null;
  discord_user_id: string | null;
  discord_username: string | null;
  is_mapped: boolean;
};

/** A saved mapping row. */
export type PayeeDiscordMapping = {
  id: number;
  bpar_i_person_id: number | null;
  s_bpartner_employee_id: number | null;
  s_bpartner_id: number | null;
  display_name: string | null;
  discord_user_id: string;
  discord_username: string | null;
  notes: string | null;
  is_active: boolean;
  mapped_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const BASE = '/v1/project-lmc-payee-discord';

/** Bearer header, or nothing when signed out (the API then answers 401 honestly). */
function authInit(): RequestInit {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

function withAuth(init: RequestInit = {}): RequestInit {
  const base = authInit();
  return {
    ...init,
    headers: { ...(base.headers || {}), ...(init.headers || {}) },
  };
}

export function listPayeeMappings() {
  return apiRequest<{ success: boolean; data: PayeeDiscordMapping[] }>(BASE, withAuth());
}

/**
 * Search people to map. Search-driven by design: there are 24,207 person records
 * and 927 employees, and the older mapper's attempt to make that manageable with
 * accreditation/type flags is exactly what made real payees unfindable.
 */
export function searchPayeeCandidates(q: string, limit = 50) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiRequest<{ success: boolean; count: number; data: PayeeCandidate[] }>(
    `${BASE}/candidates?${params.toString()}`,
    withAuth(),
  );
}

/**
 * Create or update a mapping. Send exactly one of bpar_i_person_id /
 * s_bpartner_employee_id — the API returns 422 if both or neither are present.
 *
 * `shared_with` comes back naming any other payees already pointing at the same
 * Discord id. Sharing is allowed, but it should never be invisible.
 */
export function savePayeeMapping(payload: {
  bpar_i_person_id?: number | null;
  s_bpartner_employee_id?: number | null;
  s_bpartner_id?: number | null;
  display_name?: string | null;
  discord_user_id: string;
  discord_username?: string | null;
  notes?: string | null;
  mapped_by?: string | null;
}) {
  return apiRequest<{
    success: boolean;
    data: PayeeDiscordMapping;
    shared_with: Array<{ id: number; display_name: string | null }>;
  }>(BASE, withAuth({ method: 'POST', body: JSON.stringify(payload) }));
}

export function deletePayeeMapping(id: number) {
  return apiRequest<{ success: boolean; message: string | null }>(
    `${BASE}/${id}`,
    withAuth({ method: 'DELETE' }),
  );
}
