import { apiRequest } from '@/lib/api';

export interface ProjectDateRow {
  documentno: string;
  wip_i_project_id: number;
  project_name: string;
  project_status: string;
  boq_created: string;
  proposed_end: string;
  date_start_design: string | null;
  date_end_design: string | null;
  date_start_budgeting: string | null;
  date_end_budgeting: string | null;
  date_start_impl: string | null;
  date_end_impl: string | null;
  status: 'NEEDS FIX' | 'OK';
}

export interface VerifyResult {
  ok: boolean;
  rows: ProjectDateRow[];
  needs_fix: number;
  hint: string;
}

export interface FixedRow {
  documentno: string;
  wip_i_project_id: number;
  project_name: string;
  date_start: string;
  date_end: string;
}

export interface CorrectResult {
  ok: boolean;
  fixed: number;
  data: FixedRow[];
}

export function verifyProjectDates(documentNumbers: string[], token: string): Promise<VerifyResult> {
  const params = new URLSearchParams();
  documentNumbers.forEach(d => params.append('document_numbers[]', d.trim()));
  return apiRequest<VerifyResult>(`/script/nlio-project-dates/verify?${params.toString()}`, {
    headers: { 'X-Script-Token': token },
  });
}

export function correctProjectDates(documentNumbers: string[], token: string): Promise<CorrectResult> {
  return apiRequest<CorrectResult>('/script/nlio-project-dates/correct', {
    method: 'POST',
    headers: { 'X-Script-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_numbers: documentNumbers.map(d => d.trim()) }),
  });
}
