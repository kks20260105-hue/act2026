import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/roles
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('tb_role')
      .select('*')
      .order('sort_order');
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(data));
  }

  // POST /api/roles (SUPER_ADMIN 전용)
  if (req.method === 'POST') {
    const { role_cd, role_nm, role_desc, role_color, sort_order } = req.body;
    if (!role_cd || !role_nm) {
      return res.status(400).json(errorResponse('MISSING_FIELD', 'role_cd, role_nm 필수'));
    }
    if (!/^[A-Z_]+$/.test(role_cd)) {
      return res.status(400).json(errorResponse('INVALID_FORMAT', 'role_cd는 대문자와 _ 만 허용'));
    }

    const { data, error } = await supabaseAdmin
      .from('tb_role')
      .insert({ role_cd, role_nm, role_desc, role_color, sort_order: sort_order ?? 50 })
      .select()
      .single();

    if (error) {
      const code = error.code === '23505' ? 'DUPLICATE' : 'DB_ERROR';
      return res.status(error.code === '23505' ? 409 : 500).json(errorResponse(code, error.message));
    }
    return res.status(201).json(successResponse(data, 'Role이 생성되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
