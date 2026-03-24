/**
 * routes/menuRoleRoutes.js - 메뉴-Role 매핑 CRUD + batch
 * Vercel 서버리스 api/menu-roles/ 와 동일한 로직 (개발환경 Express용)
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

// GET /api/menu-roles?menu_id=xxx
router.get('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    let query = admin
      .from('tb_menu_role')
      .select('*, tb_menu(menu_nm, menu_url), tb_role(role_cd, role_nm, role_color)');
    if (req.query.menu_id) query = query.eq('menu_id', req.query.menu_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/menu-roles  →  단일 매핑 추가
router.post('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { menu_id, role_id, read_yn, write_yn } = req.body;
    if (!menu_id || !role_id) return res.status(400).json({ success: false, message: 'menu_id, role_id 필수' });
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_menu_role')
      .insert({ menu_id, role_id, read_yn: read_yn ?? 'Y', write_yn: write_yn ?? 'N' })
      .select().single();

    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.message });
    return res.status(201).json({ success: true, data, message: '매핑이 추가되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/menu-roles  →  특정 메뉴의 Role 매핑 전체 교체 (Vercel index.ts와 동일 경로)
router.put('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { menu_id, role_ids } = req.body;
    if (!menu_id || !Array.isArray(role_ids)) {
      return res.status(400).json({ success: false, message: 'menu_id, role_ids 필수' });
    }
    const admin = getSupabaseAdmin();
    const { error: delError } = await admin.from('tb_menu_role').delete().eq('menu_id', menu_id);
    if (delError) return res.status(500).json({ success: false, message: delError.message });

    if (role_ids.length > 0) {
      const inserts = role_ids.map((role_id) => ({ menu_id, role_id, read_yn: 'Y', write_yn: 'N' }));
      const { error: insError } = await admin.from('tb_menu_role').insert(inserts);
      if (insError) return res.status(500).json({ success: false, message: insError.message });
    }
    return res.json({ success: true, data: null, message: '메뉴-Role 매핑이 갱신되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/menu-roles/batch  →  하위호환 유지
router.put('/batch', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { menu_id, role_ids } = req.body;
    if (!menu_id || !Array.isArray(role_ids)) {
      return res.status(400).json({ success: false, message: 'menu_id, role_ids 필수' });
    }
    const admin = getSupabaseAdmin();
    const { error: delError } = await admin.from('tb_menu_role').delete().eq('menu_id', menu_id);
    if (delError) return res.status(500).json({ success: false, message: delError.message });

    if (role_ids.length > 0) {
      const inserts = role_ids.map((role_id) => ({ menu_id, role_id, read_yn: 'Y', write_yn: 'N' }));
      const { error: insError } = await admin.from('tb_menu_role').insert(inserts);
      if (insError) return res.status(500).json({ success: false, message: insError.message });
    }
    return res.json({ success: true, data: null, message: '메뉴-Role 매핑이 갱신되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/menu-roles?id=xxx
router.delete('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, message: 'id 필수' });
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('tb_menu_role').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data: null, message: '매핑이 삭제되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
