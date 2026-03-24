/**
 * routes/userRoutes.js - 사용자 관련 라우팅
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

/** GET /api/users/profile - 내 프로필 조회 */
router.get('/profile', verifyToken, async (req, res) => {
  res.json({ success: true, data: req.user });
});

/** GET /api/users - 사용자 목록 (ADMIN 이상) */
router.get('/', verifyToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    const admin = getSupabaseAdmin();
    let query = admin
      .from('users')
      .select(`
        id, email, username, name, display_name, department, position_nm, is_active, created_at,
        tb_user_role!tb_user_role_user_id_fkey(role_id, start_dt, end_dt, use_yn, tb_role(role_cd, role_nm, role_color))
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%,name.ilike.%${search}%,department.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data, total: count ?? 0, page: pageNum, limit: limitNum });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
