import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { withAuth } from '../../../../lib/authMiddleware';
import { withRole } from '../../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../../lib/errorCodes';
import type { MenuExcelRow, UploadPreviewRow } from '../../../../lib/types';

const REQUIRED_FIELDS = ['menu_nm', 'menu_url', 'menu_depth', 'menu_order'] as const;
const MAX_ROWS = 500;

function validateRow(row: MenuExcelRow, rowNo: number): UploadPreviewRow {
  const errors: string[] = [];

  REQUIRED_FIELDS.forEach((f) => {
    if (!row[f] && row[f] !== 0) errors.push(`${f} 필수`);
  });

  if (row.menu_depth && ![1, 2].includes(Number(row.menu_depth))) {
    errors.push('menu_depth는 1 또는 2');
  }
  if (row.menu_url && !/^\//.test(row.menu_url)) {
    errors.push('menu_url은 /로 시작');
  }
  if (row.use_yn && !['Y', 'N'].includes(row.use_yn.toUpperCase())) {
    errors.push('use_yn은 Y 또는 N');
  }

  return {
    ...row,
    rowNo,
    status: errors.length > 0 ? 'error' : 'valid',
    errors,
  };
}

/**
 * POST /api/menus/upload/preview
 * Body: { fileName: string; rows: MenuExcelRow[] }
 * 서버 측 유효성 검증만 수행, DB 기록 없음
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const { fileName, rows } = req.body as { fileName: string; rows: MenuExcelRow[] };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json(errorResponse('MISSING_FIELD', 'rows 데이터가 없습니다.'));
  }
  if (rows.length > MAX_ROWS) {
    return res.status(400).json(errorResponse('UPLOAD_LIMIT', `최대 ${MAX_ROWS}행까지 업로드 가능합니다.`));
  }

  // URL 중복 검사 (업로드 데이터 내부)
  const urlSet = new Set<string>();
  const previewRows: UploadPreviewRow[] = rows.map((row, i) => {
    const validated = validateRow(row, i + 2);  // 엑셀 헤더=1행, 데이터=2행~
    if (row.menu_url) {
      if (urlSet.has(row.menu_url)) {
        validated.errors.push('업로드 파일 내 menu_url 중복');
        validated.status = 'error';
      }
      urlSet.add(row.menu_url);
    }
    return validated;
  });

  const summary = {
    total:   previewRows.length,
    valid:   previewRows.filter((r) => r.status === 'valid').length,
    error:   previewRows.filter((r) => r.status === 'error').length,
    skip:    previewRows.filter((r) => r.status === 'skip').length,
  };

  return res.status(200).json(successResponse({ fileName, summary, rows: previewRows }));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
