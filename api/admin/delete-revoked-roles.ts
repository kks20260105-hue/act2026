import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { withAuth } from '../../lib/authMiddleware';
import { withRole } from '../../lib/checkRole';
import { successResponse, errorResponse } from '../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));

  const actor = (req as any).user;
  try {
    const { userId, roleId, confirm } = req.body || {};

    // Safety: deleting ALL revoked rows requires explicit confirm=true
    if (!userId && !roleId && confirm !== true) {
      return res.status(400).json(errorResponse('CONFIRM_REQUIRED', '전체 삭제는 confirm=true를 포함해야 합니다.'));
    }

    const cond: any = { use_yn: 'N' };
    if (userId) cond.user_id = userId;
    if (roleId) cond.role_id = roleId;

    const { data, error } = await supabaseAdmin.from('tb_user_role').delete().match(cond);
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));

    // 감사 로그(선택): 권한 있는 사용자(actor) 정보를 기록
    await supabaseAdmin.from('tb_permission_log').insert({
      target_user_id: userId ?? null,
      action_type:    'PURGE_REVOKED',
      role_id:        roleId ?? null,
      after_state:    null,
      acted_by:       actor?.id ?? null,
    });

    const deleted = Array.isArray(data as any) ? (data as any).length : (data ? 1 : 0);
    return res.status(200).json(successResponse({ deleted }));
  } catch (err: any) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message || String(err)));
  }
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
