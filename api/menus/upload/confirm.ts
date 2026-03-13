import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';
import type { MenuExcelRow } from '../../../lib/types';

/**
 * POST /api/menus/upload/confirm
 * ?„ë¦¬ë·°ì—???•ì¸??rowsë¥??¤ì œ DB??ë°˜ì˜?©ë‹ˆ?? (UPSERT)
 * Body: { fileName: string; rows: MenuExcelRow[] }
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const user = (req as any).user;
  const { fileName, rows } = req.body as { fileName: string; rows: MenuExcelRow[] };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json(errorResponse('MISSING_FIELD', '?…ë¡œ?œí•  rowsê°€ ?†ìŠµ?ˆë‹¤.'));
  }

  let successCnt = 0;
  let failCnt    = 0;
  const errors: { rowNo: number; error_msg: string }[] = [];

  // parent_menu_url ??parent_menu_id ë³€?˜ì„ ?„í•œ URLë§??¬ì „ ì¡°íšŒ
  const parentUrls = [...new Set(rows.filter((r) => r.parent_menu_url).map((r) => r.parent_menu_url!))];
  const urlToIdMap: Record<string, string> = {};

  if (parentUrls.length > 0) {
    const { data: parentMenus } = await supabaseAdmin
      .from('tb_menu')
      .select('menu_id, menu_url')
      .in('menu_url', parentUrls);

    (parentMenus ?? []).forEach((m: any) => { urlToIdMap[m.menu_url] = m.menu_id; });
  }

  // ?‰ë³„ UPSERT
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;

    const parent_menu_id = row.parent_menu_url ? (urlToIdMap[row.parent_menu_url] ?? null) : null;

    const { data: menuData, error: menuErr } = await supabaseAdmin
      .from('tb_menu')
      .upsert({
        menu_nm:        row.menu_nm,
        menu_url:       row.menu_url,
        parent_menu_id: parent_menu_id,
        menu_depth:     Number(row.menu_depth),
        menu_order:     Number(row.menu_order),
        icon_class:     row.icon_class ?? null,
        use_yn:         (row.use_yn ?? 'Y').toUpperCase(),
      }, { onConflict: 'menu_url' })
      .select('menu_id')
      .single();

    if (menuErr || !menuData) {
      failCnt++;
      errors.push({ rowNo, error_msg: menuErr?.message ?? '?????†ëŠ” ?¤ë¥˜' });
      continue;
    }

    // allow_roles ì²˜ë¦¬
    if (row.allow_roles && menuData.menu_id) {
      const roleCds = row.allow_roles.split(',').map((s) => s.trim()).filter(Boolean);
      const { data: roleRows } = await supabaseAdmin
        .from('tb_role')
        .select('role_id')
        .in('role_cd', roleCds);

      if (roleRows && roleRows.length > 0) {
        await supabaseAdmin.from('tb_menu_role').upsert(
          roleRows.map((r: any) => ({
            menu_id:  menuData.menu_id,
            role_id:  r.role_id,
            read_yn:  'Y',
            write_yn: 'N',
          })),
          { onConflict: 'menu_id,role_id', ignoreDuplicates: true }
        );
      }
    }

    successCnt++;
    // ?ˆë¡œ??URL?’ID ë§¤í•‘ ì¶”ê? (?„ì† ?‰ì˜ parent ì°¸ì¡° ?€??
    urlToIdMap[row.menu_url] = menuData.menu_id;
  }

  // ?…ë¡œ???´ë ¥ ?€??
  const status = failCnt === 0 ? 'SUCCESS' : successCnt > 0 ? 'PARTIAL' : 'FAIL';
  const { data: logData } = await supabaseAdmin.from('tb_menu_upload_log').insert({
    file_nm:        fileName,
    upload_type:    'MENU',
    total_cnt:      rows.length,
    success_cnt:    successCnt,
    fail_cnt:       failCnt,
    skip_cnt:       0,
    status:         status,
    upload_user_id: user.id,
  }).select('log_id').single();

  // ?¤ë¥˜ ?ì„¸ ?€??
  if (logData && errors.length > 0) {
    await supabaseAdmin.from('tb_menu_upload_error').insert(
      errors.map((e) => ({
        log_id:    logData.log_id,
        row_no:    e.rowNo,
        error_msg: e.error_msg,
        raw_data:  rows[e.rowNo - 2] ?? {},
      }))
    );
  }

  return res.status(200).json(successResponse({
    logId:      logData?.log_id ?? null,
    status,
    total:      rows.length,
    successCnt,
    failCnt,
    errors,
  }, `${successCnt}ê±??€???„ë£Œ`));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
