import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { withAuth } from '../../../../lib/authMiddleware';
import { withRole } from '../../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../../lib/errorCodes';

/**
 * GET /api/menus/upload/logs/:logId
 * 업로드 이력 상세 + 오류 목록
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const { logId } = req.query as { logId: string };

  const [logResult, errorResult] = await Promise.all([
    supabaseAdmin.from('tb_menu_upload_log').select('*').eq('log_id', logId).single(),
    supabaseAdmin.from('tb_menu_upload_error').select('*').eq('log_id', logId).order('row_no'),
  ]);

  if (logResult.error || !logResult.data) {
    return res.status(404).json(errorResponse('NOT_FOUND', '이력을 찾을 수 없습니다.'));
  }

  return res.status(200).json(successResponse({
    log:    logResult.data,
    errors: errorResult.data ?? [],
  }));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
