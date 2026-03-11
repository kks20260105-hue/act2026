/**
 * routes/userRoutes.js - 사용자 관련 라우팅
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');

/** GET /api/users/profile - 프로필 조회 */
router.get('/profile', verifyToken, async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
