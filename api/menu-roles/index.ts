import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/menu-roles?menu_id=xxx
  if (req.method === 'GET') {
    const { menu_id } = req.query;
    let query = supabaseAdmin
      .from('tb_menu_role')
      .select('*, tb_menu(menu_nm, menu_url), tb_role(role_cd, role_nm, role_color)');

    if (menu_id) query = query.eq('menu_id', menu_id as string);

    const { data, error } = await query;
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(data));
  }

  // POST /api/menu-roles → 단일 매핑 추가
  if (req.method === 'POST') {
    const { menu_id, role_id, read_yn, write_yn } = req.body;
    if (!menu_id || !role_id) {
      return res.status(400).json(errorResponse('MISSING_FIELD', 'menu_id, role_id 필수'));
    }

    const { data, error } = await supabaseAdmin
      .from('tb_menu_role')
      .insert({ menu_id, role_id, read_yn: read_yn ?? 'Y', write_yn: write_yn ?? 'N' })
      .select()
      .single();

    if (error) {
      const code = error.code === '23505' ? 'DUPLICATE' : 'DB_ERROR';
      return res.status(error.code === '23505' ? 409 : 500).json(errorResponse(code, error.message));
    }
    return res.status(201).json(successResponse(data, '매핑이 추가되었습니다.'));
  }

  // DELETE /api/menu-roles?id=xxx
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json(errorResponse('MISSING_FIELD', 'id 필수'));
    const { error } = await supabaseAdmin.from('tb_menu_role').delete().eq('id', id as string);
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(null, '매핑이 삭제되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
