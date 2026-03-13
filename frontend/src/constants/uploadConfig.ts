export const UPLOAD_CONFIG = {
  /** 최대 업로드 행 수 */
  MAX_ROWS: 500,
  /** 허용 파일 확장자 */
  ACCEPT_EXTENSIONS: ['.xlsx', '.xls', '.csv'],
  /** 파일 크기 제한 (5MB) */
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  /** 엑셀 필수 컬럼 */
  REQUIRED_COLUMNS: ['menu_nm', 'menu_url', 'menu_depth', 'menu_order'] as const,
  /** 엑셀 전체 컬럼 순서 */
  ALL_COLUMNS: [
    'menu_nm', 'menu_url', 'parent_menu_url',
    'menu_depth', 'menu_order', 'icon_class',
    'use_yn', 'allow_roles',
  ] as const,
} as const;

export const UPLOAD_STATUS_LABELS = {
  SUCCESS: '성공',
  FAIL:    '실패',
  PARTIAL: '부분 성공',
} as const;
