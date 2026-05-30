import { apiRequest } from '@/lib/api';

export interface DocnoVerifyRow {
  mp_t_interment_order_id: number;
  documentno: string;
  docstatus: string;
  is_active: number | null;
  deceased: string | null;
  doc_t_reference_number_id: number;
  documentno_dr: string;
  documentno_pr: string;
}

export interface DocnoVerifyResult {
  ok: boolean;
  already_fixed: boolean;
  current: DocnoVerifyRow;
  proposed: {
    'mp_t_interment_order.documentno': string;
    'doc_t_reference_number.documentno_pr': string;
  } | null;
  hint: string;
}

export interface DocnoCorrectResult {
  ok: boolean;
  before: {
    mp_t_interment_order_id: number;
    documentno: string;
    is_active: number | null;
  };
  after: {
    mp_t_interment_order_id: number;
    documentno: string;
    documentno_dr: string;
    documentno_pr: string;
  };
}

export function verifyDocnoCorrection(token: string): Promise<DocnoVerifyResult> {
  return apiRequest<DocnoVerifyResult>('/script/nlio-docno-correction/verify', {
    headers: { 'X-Script-Token': token },
  });
}

export function applyDocnoCorrection(token: string): Promise<DocnoCorrectResult> {
  return apiRequest<DocnoCorrectResult>('/script/nlio-docno-correction/correct', {
    method: 'POST',
    headers: { 'X-Script-Token': token, 'Content-Type': 'application/json' },
  });
}
