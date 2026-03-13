import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  const { roleId } = req.query as { roleId: string };

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('tb_role')
      .select('*')
      .eq('role_id', roleId)
      .single();
    if (error || !data) return res.status(404).json(errorResponse('NOT_FOUND', 'Role을 찾을 수 없습니다.'));
    return res.status(200).json(successResponse(data));
  }

  if (req.method === 'PUT') {
    const { role_nm, role_desc, role_color, sort_order, use_yn } = req.body;
    const { data, error } = await supabaseAdmin
      .from('tb_role')
      .update({ role_nm, role_desc, role_color, sort_order, use_yn })
      .eq('role_id', roleId)
      .select()
      .single();
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(data, 'Role이 수정되었습니다.'));
  }

  if (req.method === 'DELETE') {
    // is_system=true인 Role은 삭제 불가
    const { data: existing } = await supabaseAdmin
      .from('tb_role')
      .select('is_system')
      .eq('role_id', roleId)
      .single();

    if (existing?.is_system) {
      return res.status(400).json(errorResponse('FORBIDDEN', '시스템 기본 Role은 삭제할 수 없습니다.'));
    }

    const { error } = await supabaseAdmin.from('tb_role').delete().eq('role_id', roleId);
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(null, 'Role이 삭제되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
