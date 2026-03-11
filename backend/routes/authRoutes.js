/**
 * routes/authRoutes.js - 인증 관련 라우팅
 */
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

/** POST /api/auth/login - 로그인 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('올바른 이메일을 입력하세요.').normalizeEmail(),
    // 비밀번호 최소 길이 검증 임시 비활성화 (TODO: 운영 시 재활성화)
    // body('password').isLength({ min: 6 }).withMessage('비밀번호는 6자 이상이어야 합니다.'),
  ],
  authController.login
);

/** POST /api/auth/logout - 로그아웃 (인증 필요) */
router.post('/logout', verifyToken, authController.logout);

/** GET /api/auth/me - 현재 사용자 정보 조회 */
router.get('/me', verifyToken, authController.getMe);

module.exports = router;
