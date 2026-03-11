/**
 * routes/postRoutes.js - 게시물 관련 라우팅 (차후 구현 예정)
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');

/** GET /api/posts - 게시물 목록 (차후 구현) */
router.get('/', verifyToken, async (req, res) => {
  res.json({ success: true, data: [], message: '준비 중인 기능입니다.' });
});

module.exports = router;
