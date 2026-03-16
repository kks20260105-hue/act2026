/**
 * routes/userRoleRoutes.js - 사용자 Role 부여/조회/삭제
 * Vercel 서버리스 api/users/[userId]/roles/ 와 동일한 로직 (개발환경 Express용)
 */
const express = require('express');
const router = express.Router({ mergeParams: true });  // :userId 상속
const { verifyToken } = require('../middlewares/authMiddleware');
const { getSupabaseAdmin } = require('../../lib/sharedAuth');

const requireRole = (...roles) => (req, res, next) => {
  const userRoles = req.user?.roles ?? [];
  if (roles.some((r) => userRoles.includes(r))) return next();
  return res.status(403).json({ success: false, message: '접근 권한이 없습니다.' });
};

// GET /api/users/:userId/roles
router.get('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_user_role')
      .select('*, tb_role(role_id, role_cd, role_nm, role_color, sort_order)')
      .eq('user_id', req.params.userId)
      .or(`end_dt.is.null,end_dt.gte.${today}`);

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/:userId/roles  →  Role 부여
router.post('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { role_id, start_dt, end_dt } = req.body;
    if (!role_id) return res.status(400).json({ success: false, message: 'role_id 필수' });
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('tb_user_role')
      .insert({
        user_id:    req.params.userId,
        role_id,
        start_dt:   start_dt ?? new Date().toISOString().split('T')[0],
        end_dt:     end_dt ?? null,
        use_yn:     'Y',
        granted_by: req.user.id,
      })
      .select('*, tb_role(role_cd)').single();

    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.message });
    return res.status(201).json({ success: true, data, message: 'Role이 부여되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:userId/roles?roleId=xxx
router.delete('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { roleId } = req.query;
    if (!roleId) return res.status(400).json({ success: false, message: 'roleId 필수' });
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('tb_user_role')
      .delete()
      .eq('user_id', req.params.userId)
      .eq('role_id', roleId);

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data: null, message: 'Role이 삭제되었습니다.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
