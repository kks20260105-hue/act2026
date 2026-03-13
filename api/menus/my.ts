import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { withAuth } from '../../../lib/authMiddleware';
import { getUserRoles } from '../../../lib/checkRole';
import { successResponse, errorResponse } from '../../../lib/errorCodes';

/**
 * GET /api/menus/my
 * 로그인 사용자의 Role 기반으로 허용된 메뉴만 반환합니다.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
  }

  const user = (req as any).user;
  const userRoles = await getUserRoles(user.id);

  if (userRoles.length === 0) {
    return res.status(200).json(successResponse([], '접근 가능한 메뉴가 없습니다.'));
  }

  // Role에 해당하는 role_id 조회
  const { data: roleData, error: roleErr } = await supabaseAdmin
    .from('tb_role')
    .select('role_id')
    .in('role_cd', userRoles);

  if (roleErr || !roleData) {
    return res.status(500).json(errorResponse('DB_ERROR', 'Role 조회 실패'));
  }

  const roleIds = roleData.map((r: any) => r.role_id);

  // 해당 Role이 접근 가능한 메뉴 조회
  const { data: menuRoleData, error: mrErr } = await supabaseAdmin
    .from('tb_menu_role')
    .select('menu_id, read_yn, write_yn')
    .in('role_id', roleIds)
    .eq('read_yn', 'Y');

  if (mrErr || !menuRoleData) {
    return res.status(500).json(errorResponse('DB_ERROR', '메뉴 권한 조회 실패'));
  }

  const allowedMenuIds = [...new Set(menuRoleData.map((m: any) => m.menu_id))];

  const { data: menus, error: menuErr } = await supabaseAdmin
    .from('tb_menu')
    .select('*')
    .in('menu_id', allowedMenuIds)
    .eq('use_yn', 'Y')
    .order('menu_depth', { ascending: true })
    .order('menu_order', { ascending: true });

  if (menuErr) return res.status(500).json(errorResponse('DB_ERROR', menuErr.message));

  // 쓰기 권한 맵 생성
  const writeMap: Record<string, boolean> = {};
  menuRoleData.forEach((m: any) => {
    if (m.write_yn === 'Y') writeMap[m.menu_id] = true;
  });

  const result = (menus ?? []).map((m: any) => ({
    ...m,
    can_write: !!writeMap[m.menu_id],
  }));

  return res.status(200).json(successResponse(result));
}

export default withAuth(handler);
