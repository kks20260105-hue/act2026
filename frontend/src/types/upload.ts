export interface ExcelRow {
  menu_nm:         string;
  menu_url:        string;
  parent_menu_url?: string;
  menu_depth:      number;
  menu_order:      number;
  icon_class?:     string;
  use_yn?:         string;
  allow_roles?:    string;
}

export interface PreviewRow extends ExcelRow {
  rowNo:   number;
  status:  'valid' | 'error' | 'skip';
  errors:  string[];
}

export interface UploadSummary {
  total:   number;
  valid:   number;
  error:   number;
  skip:    number;
}

export interface UploadPreviewResponse {
  fileName: string;
  summary:  UploadSummary;
  rows:     PreviewRow[];
}

export interface UploadConfirmResponse {
  logId:      string | null;
  status:     'SUCCESS' | 'FAIL' | 'PARTIAL';
  total:      number;
  successCnt: number;
  failCnt:    number;
  errors:     { rowNo: number; error_msg: string }[];
}

export interface UploadLog {
  log_id:         string;
  file_nm:        string;
  upload_type:    string;
  total_cnt:      number;
  success_cnt:    number;
  fail_cnt:       number;
  skip_cnt:       number;
  status:         'SUCCESS' | 'FAIL' | 'PARTIAL';
  upload_user_id: string | null;
  created_at:     string;
}

export interface UploadError {
  error_id:  string;
  log_id:    string;
  row_no:    number;
  column_nm: string | null;
  error_cd:  string | null;
  error_msg: string;
  raw_data:  Record<string, unknown>;
  created_at: string;
}
