import { apiRequest } from '@/lib/api';

/**
 * Auto BOQ stage custodian setting.
 *
 * Auto BOQ used to hardcode the custodian in PHP (JAMES EARL MENDOZA). It is now
 * a stored setting; the code constant is only the fallback when nothing is set,
 * which is what `is_default` reports.
 *
 * Changes apply to NEWLY generated BOQs only — stages already written to SAERP
 * keep whichever custodian they were created with.
 */

export interface CustodianState {
  /** Chosen person id, or null when running on the built-in default. */
  configured_person_id: number | null;
  /** What Auto BOQ will actually write (configured, else default). */
  resolved_person_id: number;
  is_default: boolean;
  default_person_id: number;
  custodian_name: string | null;
  s_bpartner_id: number | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface CustodianCandidate {
  bpar_i_person_id: number;
  name: string;
  /** SAERP usercode — its presence is what makes a person selectable. */
  usercode: string;
  s_bpartner_id: number | null;
  /** Scope stages already naming this person as custodian. Helps identify the real record. */
  stage_count: number;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const base = '/autoboq-setting';

export const getCustodian = () =>
  apiRequest<Envelope<CustodianState>>(`${base}/custodian`).then(r => r.data);

export const getCustodianCandidates = (search = '', limit = 50) => {
  const p = new URLSearchParams({ limit: String(limit) });
  if (search) p.set('search', search);
  return apiRequest<Envelope<CustodianCandidate[]>>(`${base}/custodian-candidates?${p}`).then(r => r.data);
};

export const setCustodian = (personId: number, updatedBy?: string) =>
  apiRequest<Envelope<CustodianState>>(`${base}/custodian`, {
    method: 'PUT',
    body: JSON.stringify({ bpar_i_person_id: personId, updated_by: updatedBy }),
  });

export const resetCustodian = (updatedBy?: string) =>
  apiRequest<Envelope<CustodianState>>(`${base}/custodian`, {
    method: 'DELETE',
    body: JSON.stringify({ updated_by: updatedBy }),
  });
