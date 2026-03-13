import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { withAuth } from '../../../../../lib/authMiddleware';
import { withRole } from '../../../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId, roleId } = req.query as { userId: string; roleId: string };
  const actor = (req as any).user;

  // DELETE /api/users/:userId/roles/:roleId → Role 회수
  if (req.method === 'DELETE') {
    // 현재 role 정보 스냅샷
    const { data: existing } = await supabaseAdmin
      .from('tb_user_role')
      .select('*, tb_role(role_cd)')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('use_yn', 'Y')
      .single();

    if (!existing) {
      return res.status(404).json(errorResponse('NOT_FOUND', '해당 Role을 찾을 수 없습니다.'));
    }

    const { error } = await supabaseAdmin
      .from('tb_user_role')
      .update({ use_yn: 'N' })
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));

    // 감사 이력 저장
    await supabaseAdmin.from('tb_permission_log').insert({
      target_user_id: userId,
      action_type:    'REVOKE',
      role_id:        roleId,
      role_cd_snap:   (existing as any).tb_role?.role_cd ?? '',
      before_state:   existing,
      acted_by:       actor.id,
    });

    return res.status(200).json(successResponse(null, 'Role이 회수되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
