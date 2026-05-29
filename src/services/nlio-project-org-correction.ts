import { apiRequest } from '@/lib/api';

export interface ProjectOrgVerifyRow {
  documentno: string;
  io_org: number;
  io_active: number;
  wip_i_project_id: number;
  project_name: string;
  project_org: number;
  iop_active: number;
  status: 'NEEDS FIX' | 'OK' | 'UNEXPECTED';
}

export interface VerifyResult {
  ok: boolean;
  rows: ProjectOrgVerifyRow[];
  needs_fix: number;
  hint: string;
}

export interface ProjectOrgBeforeRow {
  documentno: string;
  wip_i_project_id: number;
  project_name: string;
  project_org: number;
}

export interface ProjectOrgAfterRow {
  wip_i_project_id: number;
  project_name: string;
  project_org: number;
}

export interface CorrectResult {
  ok: boolean;
  fixed: number;
  before: ProjectOrgBeforeRow[];
  after: ProjectOrgAfterRow[];
}

export function verifyProjectOrgs(documentNumbers: string[], token: string): Promise<VerifyResult> {
  const params = new URLSearchParams();
  documentNumbers.forEach(d => params.append('document_numbers[]', d.trim()));
  return apiRequest<VerifyResult>(`/script/nlio-project-org/verify?${params.toString()}`, {
    headers: { 'X-Script-Token': token },
  });
}

export function correctProjectOrgs(documentNumbers: string[], token: string): Promise<CorrectResult> {
  return apiRequest<CorrectResult>('/script/nlio-project-org/correct', {
    method: 'POST',
    headers: { 'X-Script-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_numbers: documentNumbers.map(d => d.trim()) }),
  });
}
