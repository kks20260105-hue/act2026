/** 공통 DB 테이블 타입 */

export interface TbRole {
  role_id:    string;
  role_cd:    string;
  role_nm:    string;
  role_desc:  string | null;
  role_color: string | null;
  sort_order: number;
  use_yn:     'Y' | 'N';
  is_system:  boolean;
  created_at: string;
  updated_at: string | null;
}

export interface TbMenu {
  menu_id:        string;
  menu_nm:        string;
  menu_url:       string;
  parent_menu_id: string | null;
  menu_depth:     1 | 2;
  menu_order:     number;
  icon_class:     string | null;
  use_yn:         'Y' | 'N';
  created_at:     string;
  updated_at:     string | null;
}

export interface TbMenuRole {
  id:         string;
  menu_id:    string;
  role_id:    string;
  read_yn:    'Y' | 'N';
  write_yn:   'Y' | 'N';
  created_at: string;
}

export interface TbUserRole {
  user_role_id: string;
  user_id:      string;
  role_id:      string;
  start_dt:     string;
  end_dt:       string | null;
  use_yn:       'Y' | 'N';
  granted_by:   string | null;
  created_at:   string;
  updated_at:   string | null;
}

export interface TbMenuUploadLog {
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

export interface TbMenuUploadError {
  error_id:   string;
  log_id:     string;
  row_no:     number;
  column_nm:  string | null;
  error_cd:   string | null;
  error_msg:  string;
  raw_data:   Record<string, unknown>;
  created_at: string;
}

/** 엑셀 업로드 Row (클라이언트→서버 전송) */
export interface MenuExcelRow {
  menu_nm:        string;
  menu_url:       string;
  parent_menu_url?: string;  // 상위 메뉴 URL로 parent 참조
  menu_depth:     number;
  menu_order:     number;
  icon_class?:    string;
  use_yn?:        string;
  allow_roles?:   string;    // 콤마 구분 role_cd 목록
}

/** 업로드 프리뷰 응답 */
export interface UploadPreviewRow extends MenuExcelRow {
  rowNo:    number;
  status:   'valid' | 'error' | 'skip';
  errors:   string[];
}
