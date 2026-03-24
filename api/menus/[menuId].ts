import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseClient';
import { withAuth } from '../../lib/authMiddleware';
import { successResponse, errorResponse } from '../../lib/errorCodes';

// 관리자 Role 체크 헬퍼 (my 엔드포인트는 일반 사용자도 접근 가능하므로 내부에서 개별 적용)
function isAdmin(req: VercelRequest): boolean {
  const roles: string[] = (req as any).user?.roles ?? [];
  return roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const { menuId } = req.query as { menuId: string };

  // ─── GET /api/menus/my → 로그인 사용자 Role 기반 메뉴 반환 ───────────
  if (menuId === 'my') {
    if (req.method !== 'GET') return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
    const user = (req as any).user;

    const { data: userRoleData } = await supabaseAdmin
      .from('tb_user_role')
      .select('tb_role(role_cd)')
      .eq('user_id', user.id)
      .eq('use_yn', 'Y');

    const roleCds: string[] = (userRoleData ?? []).map((r: any) => r.tb_role?.role_cd).filter(Boolean);
    if (roleCds.length === 0) return res.status(200).json(successResponse([], '접근 가능한 메뉴가 없습니다.'));

    const { data: roleData } = await supabaseAdmin.from('tb_role').select('role_id').in('role_cd', roleCds);
    const roleIds = (roleData ?? []).map((r: any) => r.role_id);

    const { data: menuRoleData, error: mrErr } = await supabaseAdmin
      .from('tb_menu_role')
      .select('menu_id, read_yn, write_yn')
      .in('role_id', roleIds)
      .eq('read_yn', 'Y');

    if (mrErr || !menuRoleData) return res.status(500).json(errorResponse('DB_ERROR', '메뉴 권한 조회 실패'));

    const allowedMenuIds = [...new Set(menuRoleData.map((m: any) => m.menu_id))];
    const { data: menus, error: menuErr } = await supabaseAdmin
      .from('tb_menu').select('*').in('menu_id', allowedMenuIds).eq('use_yn', 'Y')
      .order('menu_depth', { ascending: true }).order('menu_order', { ascending: true });

    if (menuErr) return res.status(500).json(errorResponse('DB_ERROR', menuErr.message));

    const writeMap: Record<string, boolean> = {};
    menuRoleData.forEach((m: any) => { if (m.write_yn === 'Y') writeMap[m.menu_id] = true; });
    const result = (menus ?? []).map((m: any) => ({ ...m, can_write: !!writeMap[m.menu_id] }));
    return res.status(200).json(successResponse(result));
  }

  // GET /api/menus/:menuId
  if (req.method === 'GET') {
    if (!isAdmin(req)) return res.status(403).json(errorResponse('FORBIDDEN', '관리자 권한이 필요합니다.'));
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
    if (!isAdmin(req)) return res.status(403).json(errorResponse('FORBIDDEN', '관리자 권한이 필요합니다.'));
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
    if (!isAdmin(req)) return res.status(403).json(errorResponse('FORBIDDEN', '관리자 권한이 필요합니다.'));
    const { error } = await supabaseAdmin.from('tb_menu').delete().eq('menu_id', menuId);
    if (error) return res.status(500).json(errorResponse('DB_ERROR', error.message));
    return res.status(200).json(successResponse(null, '메뉴가 삭제되었습니다.'));
  }

  return res.status(405).json(errorResponse('SERVER_ERROR', 'Method Not Allowed'));
}

// /my 는 일반 사용자도 접근 가능하므로 withRole 제거 → 내부에서 개별 체크
export default withAuth(handler);
