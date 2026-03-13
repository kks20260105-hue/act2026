import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { withAuth } from '../../../../../lib/authMiddleware';
import { withRole } from '../../../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId } = req.query as { userId: string };
  const actor = (req as any).user;

  // GET /api/users/:userId/roles
  if (req.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from('tb_user_role')
      .select('*, tb_role(role_id, role_cd, role_nm, role_color, sort_order)')
      .eq('user_id', userId)
      .or(`end_dt.is.null,end_dt.gte.${today}`);

    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(data));
  }

  // POST /api/users/:userId/roles → Role 부여
  if (req.method === 'POST') {
    const { role_id, start_dt, end_dt } = req.body;
    if (!role_id) return res.status(400).json(errorResponse('MISSING_FIELD', 'role_id 필수'));

    const { data, error } = await supabaseAdmin
      .from('tb_user_role')
      .insert({
        user_id:    userId,
        role_id,
        start_dt:   start_dt ?? new Date().toISOString().split('T')[0],
        end_dt:     end_dt ?? null,
        use_yn:     'Y',
        granted_by: actor.id,
      })
      .select('*, tb_role(role_cd)')
      .single();

    if (error) {
      const code = error.code === '23505' ? 'DUPLICATE' : 'DB_ERROR';
      return res.status(error.code === '23505' ? 409 : 500).json(errorResponse(code, error.message));
    }

    // 감사 이력 저장
    await supabaseAdmin.from('tb_permission_log').insert({
      target_user_id: userId,
      action_type:    'GRANT',
      role_id:        role_id,
      role_cd_snap:   (data as any).tb_role?.role_cd ?? '',
      after_state:    data,
      acted_by:       actor.id,
    });

    return res.status(201).json(successResponse(data, 'Role이 부여되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
