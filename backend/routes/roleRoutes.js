/**
 * routes/roleRoutes.js - Role CRUD
 * Vercel 서버리스 api/roles/ 와 동일한 로직 (개발환경 Express용)
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

// GET /api/roles
router.get('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('tb_role').select('*').order('sort_order');
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/roles
router.post('/', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { role_cd, role_nm, role_desc, role_color, sort_order } = req.body;
    if (!role_cd || !role_nm) return res.status(400).json({ success: false, message: 'role_cd, role_nm 필수' });
    if (!/^[A-Z_]+$/.test(role_cd)) return res.status(400).json({ success: false, message: 'role_cd는 대문자와 _ 만 허용' });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_role')
      .insert({ role_cd, role_nm, role_desc, role_color, sort_order: sort_order ?? 50 })
      .select().single();

    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.message });
    return res.status(201).json({ success: true, data, message: 'Role이 생성되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/roles/:roleId
router.put('/:roleId', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { role_nm, role_desc, role_color, sort_order, use_yn } = req.body;
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_role')
      .update({ role_nm, role_desc, role_color, sort_order, use_yn })
      .eq('role_id', req.params.roleId).select().single();

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data, message: 'Role이 수정되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/roles/:roleId
router.delete('/:roleId', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('tb_role').delete().eq('role_id', req.params.roleId);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data: null, message: 'Role이 삭제되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
