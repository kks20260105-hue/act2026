import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { withAuth } from '../../../../lib/authMiddleware';
import { withRole } from '../../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../../lib/errorCodes';

/**
 * GET /api/menus/upload/logs
 * 업로드 이력 목록 조회 (ADMIN 이상)
 * Query: page?, limit?
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  // GET /api/menus/upload/logs/:logId → 상세 조회 (logId 쿼리 파라미터로 전달)
  const { logId } = req.query as { logId?: string };
  if (logId) {
    const [logResult, errorResult] = await Promise.all([
      supabaseAdmin.from('tb_menu_upload_log').select('*').eq('log_id', logId).single(),
      supabaseAdmin.from('tb_menu_upload_error').select('*').eq('log_id', logId).order('row_no'),
    ]);
    if (logResult.error || !logResult.data) {
      return res.status(404).json(errorResponse('NOT_FOUND', '이력을 찾을 수 없습니다.'));
    }
    return res.status(200).json(successResponse({ log: logResult.data, errors: errorResult.data ?? [] }));
  }

  const page  = parseInt((req.query.page  as string) ?? '1',  10);
  const limit = parseInt((req.query.limit as string) ?? '20', 10);
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('tb_menu_upload_log')
    .select('*, users!upload_user_id(email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));

  return res.status(200).json(successResponse({ list: data, total: count ?? 0, page, limit }));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
