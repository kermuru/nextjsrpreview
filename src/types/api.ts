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
  /** The supplier-facing photo. Once dressed, this is the Barong/Filipiniana version. */
  photo?: string;
  is_valid?: number;
  allow_facebook_post?: boolean;
  created_at?: string;
  updated_at?: string;

  /* ── Barong editor ───────────────────────────────────────────────────────
   * Present on every row because /lapidaDashboard returns whole models. A set
   * `original_photo` means this row was dressed: the family's upload was moved
   * aside and `photo` now holds the generated version. Note it is a stored PATH,
   * not a URL — only `photo` is resolved server-side.
   */
  original_photo?: string | null;
  barong_edit_id?: number | null;
  gdrive_file_id?: string | null;
  gdrive_link?: string | null;
  /** Why the Drive archive failed. The edit itself still succeeded. */
  barong_error?: string | null;
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


export interface SupplierAssignableSupplier {
  name1: string;
  bpar_i_person_id: number;
  gl_subacct_id?: number | string;
  s_bpartner_id: number;
  email_add?: string;
  contact_number?: string;
  phone?: string;
}

export interface SupplierAssignableItem {
  id: number;
  item_name: string;
  item_category: string;
  is_active?: number;
}

export interface SupplierAssignableMapping {
  id: number;
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
  item_name?: string;
  item_category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NlioRecord {
  bpar_i_person_id: number;
  name1?: string;
  documentno: string;
  date_interment?: string;
  occupant?: string;
  contact_no?: string;
}

export interface PendingNlioItem {
  bpar_i_person_id: number;
  name1?: string;
  documentno: string;
  date_interment?: string;
  contact_no?: string;
}

export interface SupplierByItemRecord {
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
  name1: string;
  email_add?: string;
  contact_number?: string;
  phone?: string;
}

export interface NlioAssignmentRecord {
  id: number;
  document_no: string;
  bpar_i_person_id: number;
  s_bpartner_id: number;
  supplier_item_id: number;
  assigned_by?: string;
  created_at?: string;
  updated_at?: string;
  item_name?: string;
  item_category?: string;
}


export interface SupplierItemIO {
  id: number;
  item_name: string;
  item_category: string;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierItemIOResponse {
  item: SupplierItemIO;
  message: string;
}

export interface BparDropdownRecord {
  bpar_i_person_id: number;
  s_bpartner_id?: number | null;
  name1?: string | null;
}

export interface BparDiscordUserIO {
  id: number;
  bpar_i_person_id: number;
  s_bpartner_id?: number | null;
  discord_user_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface BparDiscordUserIOResponse {
  record: BparDiscordUserIO;
  message: string;
}

export interface MarshalDiscordUser {
  id: number;
  discord_user_id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}