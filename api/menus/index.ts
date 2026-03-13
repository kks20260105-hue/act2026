import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { withRole } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/menus → 전체 메뉴 트리 (ADMIN 이상)
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('tb_menu')
      .select('*, tb_menu_role(role_id, read_yn, write_yn, tb_role(role_cd, role_nm, role_color))')
      .order('menu_depth', { ascending: true })
      .order('menu_order', { ascending: true });

    if (error) {
      return res.status(500).json(errorResponse('DB_ERROR', error.message));
    }
    return res.status(200).json(successResponse(data));
  }

  // POST /api/menus → 메뉴 생성 (SUPER_ADMIN)
  if (req.method === 'POST') {
    const { menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn } = req.body;

    if (!menu_nm || !menu_url || !menu_depth) {
      return res.status(400).json(errorResponse('MISSING_FIELD', 'menu_nm, menu_url, menu_depth 필수'));
    }

    const { data, error } = await supabaseAdmin
      .from('tb_menu')
      .insert({ menu_nm, menu_url, parent_menu_id, menu_depth, menu_order: menu_order ?? 1, icon_class, use_yn: use_yn ?? 'Y' })
      .select()
      .single();

    if (error) {
      const code = error.code === '23505' ? 'DUPLICATE' : 'DB_ERROR';
      return res.status(error.code === '23505' ? 409 : 500).json(errorResponse(code, error.message));
    }
    return res.status(201).json(successResponse(data, '메뉴가 생성되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
