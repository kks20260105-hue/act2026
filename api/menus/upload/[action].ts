import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';
import type { MenuExcelRow, UploadPreviewRow } from '../../../lib/types';

/**
 * GET  /api/menus/upload/template  → CSV 템플릿 다운로드
 * POST /api/menus/upload/preview   → 미리보기(검증)
 * POST /api/menus/upload/confirm   → 실제 DB 반영
 */

// ─── preview: 유효성 검증 ────────────────────────────────────────
const REQUIRED_FIELDS = ['menu_nm', 'menu_url', 'menu_depth', 'menu_order'] as const;
const MAX_ROWS = 500;

function validateRow(row: MenuExcelRow, rowNo: number): UploadPreviewRow {
  const errors: string[] = [];
  REQUIRED_FIELDS.forEach((f) => {
    if (!row[f] && row[f] !== 0) errors.push(`${f} 필수`);
  });
  if (row.menu_depth && ![1, 2].includes(Number(row.menu_depth))) errors.push('menu_depth는 1 또는 2');
  if (row.menu_url && !/^\//.test(row.menu_url)) errors.push('menu_url은 /로 시작');
  if (row.use_yn && !['Y', 'N'].includes(row.use_yn.toUpperCase())) errors.push('use_yn은 Y 또는 N');
  return { ...row, rowNo, status: errors.length > 0 ? 'error' : 'valid', errors };
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query as { action: string };

  // ═══════════════════════════════════════════
  // GET /api/menus/upload/template
  // ═══════════════════════════════════════════
  if (action === 'template') {
    if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

    const csvHeader  = 'menu_nm,menu_url,parent_menu_url,menu_depth,menu_order,icon_class,use_yn,allow_roles';
    const csvExample = [
      '홈,/,,1,1,home,Y,USER',
      '업무,/work,,1,2,briefcase,Y,USER',
      '공지사항,/work/notice,/work,2,1,notification,Y,"USER,MANAGER"',
      '관리,/admin,,1,9,setting,Y,"ADMIN,SUPER_ADMIN"',
      '메뉴관리,/admin/menus,/admin,2,1,menu,Y,"ADMIN,SUPER_ADMIN"',
    ].join('\n');

    const BOM = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=menu_upload_template.csv');
    return res.status(200).send(BOM + csvHeader + '\n' + csvExample);
  }

  // ═══════════════════════════════════════════
  // POST /api/menus/upload/preview
  // ═══════════════════════════════════════════
  if (action === 'preview') {
    if (req.method !== 'POST') return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));

    const { fileName, rows } = req.body as { fileName: string; rows: MenuExcelRow[] };
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json(errorResponse('MISSING_FIELD', 'rows 데이터가 없습니다.'));
    }
    if (rows.length > MAX_ROWS) {
      return res.status(400).json(errorResponse('UPLOAD_LIMIT', `최대 ${MAX_ROWS}건까지 업로드 가능합니다.`));
    }

    const urlSet = new Set<string>();
    const previewRows: UploadPreviewRow[] = rows.map((row, i) => {
      const validated = validateRow(row, i + 2);
      if (row.menu_url) {
        if (urlSet.has(row.menu_url)) {
          validated.errors.push('파일내 동일한 menu_url 중복');
          validated.status = 'error';
        }
        urlSet.add(row.menu_url);
      }
      return validated;
    });

    const summary = {
      total: previewRows.length,
      valid: previewRows.filter((r) => r.status === 'valid').length,
      error: previewRows.filter((r) => r.status === 'error').length,
      skip:  previewRows.filter((r) => r.status === 'skip').length,
    };

    return res.status(200).json(successResponse({ fileName, summary, rows: previewRows }));
  }

  // ═══════════════════════════════════════════
  // POST /api/menus/upload/confirm
  // ═══════════════════════════════════════════
  if (action === 'confirm') {
    if (req.method !== 'POST') return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));

    const user = (req as any).user;
    const { fileName, rows } = req.body as { fileName: string; rows: MenuExcelRow[] };
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json(errorResponse('MISSING_FIELD', '업로드할 rows가 없습니다.'));
    }

    let successCnt = 0;
    let failCnt    = 0;
    const errors: { rowNo: number; error_msg: string }[] = [];

    const parentUrls = [...new Set(rows.filter((r) => r.parent_menu_url).map((r) => r.parent_menu_url!))];
    const urlToIdMap: Record<string, string> = {};

    if (parentUrls.length > 0) {
      const { data: parentMenus } = await supabaseAdmin.from('tb_menu').select('menu_id, menu_url').in('menu_url', parentUrls);
      (parentMenus ?? []).forEach((m: any) => { urlToIdMap[m.menu_url] = m.menu_id; });
    }

    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i];
      const rowNo = i + 2;
      const parent_menu_id = row.parent_menu_url ? (urlToIdMap[row.parent_menu_url] ?? null) : null;

      const { data: menuData, error: menuErr } = await supabaseAdmin
        .from('tb_menu')
        .upsert({
          menu_nm:        row.menu_nm,
          menu_url:       row.menu_url,
          parent_menu_id,
          menu_depth:     Number(row.menu_depth),
          menu_order:     Number(row.menu_order),
          icon_class:     row.icon_class ?? null,
          use_yn:         (row.use_yn ?? 'Y').toUpperCase(),
        }, { onConflict: 'menu_url' })
        .select('menu_id')
        .single();

      if (menuErr || !menuData) {
        failCnt++;
        errors.push({ rowNo, error_msg: menuErr?.message ?? '알 수 없는 오류' });
        continue;
      }

      if (row.allow_roles && menuData.menu_id) {
        const roleCds = row.allow_roles.split(',').map((s) => s.trim()).filter(Boolean);
        const { data: roleRows } = await supabaseAdmin.from('tb_role').select('role_id').in('role_cd', roleCds);
        if (roleRows && roleRows.length > 0) {
          await supabaseAdmin.from('tb_menu_role').upsert(
            roleRows.map((r: any) => ({ menu_id: menuData.menu_id, role_id: r.role_id, read_yn: 'Y', write_yn: 'N' })),
            { onConflict: 'menu_id,role_id', ignoreDuplicates: true }
          );
        }
      }

      successCnt++;
      urlToIdMap[row.menu_url] = menuData.menu_id;
    }

    const status = failCnt === 0 ? 'SUCCESS' : successCnt > 0 ? 'PARTIAL' : 'FAIL';
    const { data: logData } = await supabaseAdmin.from('tb_menu_upload_log').insert({
      file_nm: fileName, upload_type: 'MENU', total_cnt: rows.length,
      success_cnt: successCnt, fail_cnt: failCnt, skip_cnt: 0,
      status, upload_user_id: user.id,
    }).select('log_id').single();

    if (logData && errors.length > 0) {
      await supabaseAdmin.from('tb_menu_upload_error').insert(
        errors.map((e) => ({ log_id: logData.log_id, row_no: e.rowNo, error_msg: e.error_msg, raw_data: rows[e.rowNo - 2] ?? {} }))
      );
    }

    return res.status(200).json(successResponse({ logId: logData?.log_id ?? null, status, total: rows.length, successCnt, failCnt, errors }, `${successCnt}건 처리 완료`));
  }

  return res.status(404).json(errorResponse('NOT_FOUND', `알 수 없는 액션: ${action}`));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
