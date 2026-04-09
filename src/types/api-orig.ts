export interface ReviewContext {
  name1?: string;
  occupant?: string;
  documentno: string;
  date_interment?: string;
}

export interface Review {
  id: number;
  document_no: string;
  reviewer_name: string;
  contact_number: string;
  selected_public_question: string;
  selected_private_question: string;
  private_feedback?: string;
  private_faq_answer?: string;
  others?: string;
  public_others?: string;
  privateOthers?: string;
  fb_screenshot?: string;
  google_screenshot?: string;
  submitted_at?: string;
  is_valid?: number;
}

export interface UploadInterredPhotoContext {
  id?: number;
  document_no?: string;
  occupant?: string;
  gender?: string;
  uploader_name?: string;
  photo?: string;
  is_valid?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PhotoLinkRecord {
  id?: number;
  document_no?: string;
  link: string;
  photographer_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReviewedEmailRecord {
  document_no: string;
  email_add: string;
  occupant: string;
}

export interface SlideshowRecord {
  id?: number;
  document_no?: string;
  uploader_name?: string;
  email_add?: string;
  photo?: string[];
}
