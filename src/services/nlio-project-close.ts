import { apiRequest } from '@/lib/api';

export interface ProjectCloseRow {
  wip_i_project_id: number;
  project_name: string;
  project_status: string;
  ad_org_id: number;
  is_active: number | null;
  documentno: string | null;
  io_active: number | null;
  deceased: string | null;
  applicant: string | null;
  status: 'NEEDS CLOSE' | 'ALREADY CLOSED';
}

export interface VerifyResult {
  ok: boolean;
  rows: ProjectCloseRow[];
  needs_close: number;
  hint: string;
}

export interface ClosedRow {
  wip_i_project_id: number;
  project_name: string;
  was_status: string;
  now_status: string;
}

export interface CorrectResult {
  ok: boolean;
  fixed: number;
  data: ClosedRow[];
}

export function verifyProjectClose(token: string): Promise<VerifyResult> {
  return apiRequest<VerifyResult>('/script/nlio-project-close/verify', {
    headers: { 'X-Script-Token': token },
  });
}

export function correctProjectClose(token: string): Promise<CorrectResult> {
  return apiRequest<CorrectResult>('/script/nlio-project-close/correct', {
    method: 'POST',
    headers: { 'X-Script-Token': token, 'Content-Type': 'application/json' },
  });
}
