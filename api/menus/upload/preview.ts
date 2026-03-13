import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';
import type { MenuExcelRow, UploadPreviewRow } from '../../../lib/types';

const REQUIRED_FIELDS = ['menu_nm', 'menu_url', 'menu_depth', 'menu_order'] as const;
const MAX_ROWS = 500;

function validateRow(row: MenuExcelRow, rowNo: number): UploadPreviewRow {
  const errors: string[] = [];

  REQUIRED_FIELDS.forEach((f) => {
    if (!row[f] && row[f] !== 0) errors.push(`${f} ?„ìˆ˜`);
  });

  if (row.menu_depth && ![1, 2].includes(Number(row.menu_depth))) {
    errors.push('menu_depth??1 ?ëŠ” 2');
  }
  if (row.menu_url && !/^\//.test(row.menu_url)) {
    errors.push('menu_url?€ /ë¡??œì‘');
  }
  if (row.use_yn && !['Y', 'N'].includes(row.use_yn.toUpperCase())) {
    errors.push('use_yn?€ Y ?ëŠ” N');
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
 * ?œë²„ ì¸?? íš¨??ê²€ì¦ë§Œ ?˜í–‰, DB ê¸°ë¡ ?†ìŒ
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const { fileName, rows } = req.body as { fileName: string; rows: MenuExcelRow[] };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json(errorResponse('MISSING_FIELD', 'rows ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.'));
  }
  if (rows.length > MAX_ROWS) {
    return res.status(400).json(errorResponse('UPLOAD_LIMIT', `ìµœë? ${MAX_ROWS}?‰ê¹Œì§€ ?…ë¡œ??ê°€?¥í•©?ˆë‹¤.`));
  }

  // URL ì¤‘ë³µ ê²€??(?…ë¡œ???°ì´???´ë?)
  const urlSet = new Set<string>();
  const previewRows: UploadPreviewRow[] = rows.map((row, i) => {
    const validated = validateRow(row, i + 2);  // ?‘ì? ?¤ë”=1?? ?°ì´??2??
    if (row.menu_url) {
      if (urlSet.has(row.menu_url)) {
        validated.errors.push('?…ë¡œ???Œì¼ ??menu_url ì¤‘ë³µ');
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
