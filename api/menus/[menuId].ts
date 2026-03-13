import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { withAuth } from '../../lib/authMiddleware';
import { withRole } from '../../lib/checkRole';
import { successResponse, errorResponse } from '../../lib/errorCodes';

async function handler(req: VercelRequest, res: VercelResponse) {
  const { menuId } = req.query as { menuId: string };

  // GET /api/menus/:menuId
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('tb_menu')
      .select('*, tb_menu_role(role_id, read_yn, write_yn, tb_role(role_cd, role_nm))')
      .eq('menu_id', menuId)
      .single();

    if (error || !data) return res.status(404).json(errorResponse('NOT_FOUND', '메뉴를 찾을 수 없습니다.'));
    return res.status(200).json(successResponse(data));
  }

  // PUT /api/menus/:menuId
  if (req.method === 'PUT') {
    const { menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn } = req.body;
    const { data, error } = await supabaseAdmin
      .from('tb_menu')
      .update({ menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn })
      .eq('menu_id', menuId)
      .select()
      .single();

    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(data, '메뉴가 수정되었습니다.'));
  }

  // DELETE /api/menus/:menuId
  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin.from('tb_menu').delete().eq('menu_id', menuId);
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(null, '메뉴가 삭제되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

export default withAuth(withRole(['SUPER_ADMIN', 'ADMIN'], handler));
