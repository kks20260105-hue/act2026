/**
 * routes/menuRoutes.js - 메뉴 CRUD + 사용자 메뉴 조회
 * Vercel 서버리스 api/menus/ 와 동일한 로직 (개발환경 Express용)
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { getSupabaseAdmin } = require('../../lib/sharedAuth');

const requireRole = (...roles) => (req, res, next) => {
  const userRoles = req.user?.roles ?? [];
  if (roles.some((r) => userRoles.includes(r))) return next();
  return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
};

// GET /api/menus/my  →  로그인 사용자 Role 기반 메뉴 반환
router.get('/my', verifyToken, async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { data: userRoleData } = await admin
      .from('tb_user_role')
      .select('tb_role(role_cd)')
      .eq('user_id', req.user.id)
      .eq('use_yn', 'Y');

    const roleCds = (userRoleData ?? []).map((r) => r.tb_role?.role_cd).filter(Boolean);
    if (roleCds.length === 0) return res.json({ success: true, data: [], message: '접근 가능한 메뉴가 없습니다.' });

    const { data: roleData } = await admin.from('tb_role').select('role_id').in('role_cd', roleCds);
    const roleIds = (roleData ?? []).map((r) => r.role_id);

    const { data: menuRoleData, error: mrErr } = await admin
      .from('tb_menu_role')
      .select('menu_id, read_yn, write_yn')
      .in('role_id', roleIds)
      .eq('read_yn', 'Y');

    if (mrErr) return res.status(500).json({ success: false, message: '메뉴 권한 조회 실패' });

    const allowedMenuIds = [...new Set(menuRoleData.map((m) => m.menu_id))];
    if (allowedMenuIds.length === 0) return res.json({ success: true, data: [] });

    const { data: menus, error: menuErr } = await admin
      .from('tb_menu').select('*').in('menu_id', allowedMenuIds).eq('use_yn', 'Y')
      .order('menu_depth', { ascending: true }).order('menu_order', { ascending: true });

    if (menuErr) return res.status(500).json({ success: false, message: menuErr.message });

    const writeMap = {};
    menuRoleData.forEach((m) => { if (m.write_yn === 'Y') writeMap[m.menu_id] = true; });
    const result = (menus ?? []).map((m) => ({ ...m, can_write: !!writeMap[m.menu_id] }));
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/menus  →  전체 메뉴 목록 (ADMIN 이상)
router.get('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_menu')
      .select('*, tb_menu_role(role_id, read_yn, write_yn, tb_role(role_cd, role_nm, role_color))')
      .order('menu_depth', { ascending: true })
      .order('menu_order', { ascending: true });

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/menus  →  메뉴 생성 (SUPER_ADMIN)
router.post('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn } = req.body;
    if (!menu_nm || !menu_url || !menu_depth) {
      return res.status(400).json({ success: false, message: 'menu_nm, menu_url, menu_depth 필수' });
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_menu')
      .insert({ menu_nm, menu_url, parent_menu_id, menu_depth, menu_order: menu_order ?? 1, icon_class, use_yn: use_yn ?? 'Y' })
      .select().single();

    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.message });
    return res.status(201).json({ success: true, data, message: '메뉴가 생성되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/menus/:menuId
router.get('/:menuId', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_menu')
      .select('*, tb_menu_role(role_id, read_yn, write_yn, tb_role(role_cd, role_nm))')
      .eq('menu_id', req.params.menuId).single();

    if (error || !data) return res.status(404).json({ success: false, message: '메뉴를 찾을 수 없습니다.' });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/menus/:menuId
router.put('/:menuId', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn } = req.body;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_menu')
      .update({ menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn })
      .eq('menu_id', req.params.menuId).select().single();

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data, message: '메뉴가 수정되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/menus/:menuId
router.delete('/:menuId', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('tb_menu').delete().eq('menu_id', req.params.menuId);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data: null, message: '메뉴가 삭제되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
