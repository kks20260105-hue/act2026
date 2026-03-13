import * as XLSX from 'xlsx';
import { UPLOAD_CONFIG } from '../constants/uploadConfig';
import type { ExcelRow } from '../types/upload';

/** 엑셀/CSV 파일 파싱 → ExcelRow 배열 반환 */
export function parseExcelFile(file: File): Promise<ExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const raw      = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw:    false,
        });

        const rows: ExcelRow[] = raw.map((r) => ({
          menu_nm:         String(r['menu_nm']         ?? r['메뉴명']         ?? ''),
          menu_url:        String(r['menu_url']        ?? r['메뉴URL']        ?? ''),
          parent_menu_url: String(r['parent_menu_url'] ?? r['상위메뉴URL']    ?? '') || undefined,
          menu_depth:      Number(r['menu_depth']      ?? r['메뉴깊이']       ?? 0),
          menu_order:      Number(r['menu_order']      ?? r['메뉴순서']       ?? 0),
          icon_class:      String(r['icon_class']      ?? r['아이콘']         ?? '') || undefined,
          use_yn:          String(r['use_yn']          ?? r['사용여부']       ?? 'Y').toUpperCase(),
          allow_roles:     String(r['allow_roles']     ?? r['허용Role']       ?? '') || undefined,
        }));

        resolve(rows);
      } catch (err) {
        reject(new Error(`파일 파싱 오류: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

/** 파일 유효성 검사 */
export function validateUploadFile(file: File): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!UPLOAD_CONFIG.ACCEPT_EXTENSIONS.includes(ext as any)) {
    return `허용 파일 형식: ${UPLOAD_CONFIG.ACCEPT_EXTENSIONS.join(', ')}`;
  }
  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES) {
    return `파일 크기가 5MB를 초과합니다.`;
  }
  return null;
}
