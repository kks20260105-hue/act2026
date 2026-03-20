/**
 * routes/authRoutes.js - 인증 관련 라우팅
 * - 일반 로그인/로그아웃
 * - 사번 회원가입
 * - 소셜 OAuth (네이버, 카카오, Google)
 */
const express        = require('express');
const router         = express.Router();
const { body }       = require('express-validator');
const jwt            = require('jsonwebtoken');
const passport       = require('../config/passport');
const authController = require('../controllers/authController');
const { verifyToken, verifyTokenForLogout } = require('../middlewares/authMiddleware');

// ─────────────────────────────────────────────
// 환경별 URL 헬퍼
// ─────────────────────────────────────────────

/** 요청이 들어온 API 서버의 베이스 URL (localhost or Vercel) */
const getApiBaseUrl = (req) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host  = req.headers['x-forwarded-host']  || req.get('host');
  return `${proto}://${host}`;
};

/**
 * 요청 origin 에 따라 프론트엔드 URL 결정
 * - Vercel 도메인이면 https://act2026.vercel.app
 * - 그 외 .env FRONTEND_URL (기본 localhost:3000)
 */
const getFrontendUrl = (req) => {
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin.includes('act2026.vercel.app')) return 'https://act2026.vercel.app';
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

// ─────────────────────────────────────────────
// JWT 발급 공통 함수
// ─────────────────────────────────────────────
const generateToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, name: user.name, provider: user.provider, roles: user.roles ?? [] },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

// ─────────────────────────────────────────────
// 일반 로그인 / 로그아웃 / 내 정보
// ─────────────────────────────────────────────
/** POST /api/auth/login */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('올바른 이메일을 입력하세요.').normalizeEmail(),
  ],
  authController.login
);

/** POST /api/auth/logout */
router.post('/logout', verifyTokenForLogout, authController.logout);

/** GET /api/auth/me */
router.get('/me', verifyToken, authController.getMe);

// ─────────────────────────────────────────────
// 사번 회원가입
// ─────────────────────────────────────────────
/** POST /api/auth/register - 일반 사번 등록 */
router.post(
  '/register',
  [
    body('employeeId').notEmpty().withMessage('사번을 입력하세요.'),
    body('name').notEmpty().withMessage('이름을 입력하세요.'),
    body('email').isEmail().withMessage('올바른 이메일을 입력하세요.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.'),
  ],
  authController.register
);

// ─────────────────────────────────────────────
// 소셜 OAuth 라우트 (네이버)
// 모든 로그인 시도는 항상 네이버 OAuth를 통해 처리
// → 네이버가 자체적으로 동의 이력을 관리 (1회 동의 후 얰소, 철회 시 재동의)
// ─────────────────────────────────────────────
router.get('/naver', (req, res, next) => {
  if (!process.env.NAVER_CLIENT_ID) {
    return res.status(503).json({ success: false, message: '네이버 로그인이 아직 설정되지 않았습니다.' });
  }
  const callbackURL = `${getApiBaseUrl(req)}/api/auth/naver-callback`;
  passport.authenticate('naver', { callbackURL })(req, res, next);
});
router.get('/naver-callback', (req, res, next) => {
  const callbackURL = `${getApiBaseUrl(req)}/api/auth/naver-callback`;
  const frontendUrl = getFrontendUrl(req);
  passport.authenticate('naver', {
    session: false,
    callbackURL,
    failureRedirect: `${frontendUrl}/login?error=naver`,
  })(req, res, next);
}, (req, res) => {
  const token = generateToken(req.user);
  res.redirect(`${getFrontendUrl(req)}/oauth/callback?token=${encodeURIComponent(token)}&provider=${encodeURIComponent('네이버')}`);
});

// ─────────────────────────────────────────────
// 소셜 OAuth 라우트 (카카오)
// ─────────────────────────────────────────────
router.get('/kakao', (req, res, next) => {
  if (!process.env.KAKAO_CLIENT_ID) {
    return res.status(503).json({ success: false, message: '카카오 로그인이 아직 설정되지 않았습니다.' });
  }
  const callbackURL = `${getApiBaseUrl(req)}/api/auth/kakao-callback`;
  passport.authenticate('kakao', { callbackURL })(req, res, next);
});
router.get('/kakao-callback', (req, res, next) => {
  const callbackURL = `${getApiBaseUrl(req)}/api/auth/kakao-callback`;
  const frontendUrl = getFrontendUrl(req);
  passport.authenticate('kakao', {
    session: false,
    callbackURL,
    failureRedirect: `${frontendUrl}/login?error=kakao`,
  })(req, res, next);
}, (req, res) => {
  const token = generateToken(req.user);
  res.redirect(`${getFrontendUrl(req)}/oauth/callback?token=${encodeURIComponent(token)}&provider=${encodeURIComponent('카카오')}`);
});

// ─────────────────────────────────────────────
// 소셜 OAuth 라우트 (Google)
// ─────────────────────────────────────────────
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ success: false, message: 'Google 로그인이 아직 설정되지 않았습니다.' });
  }
  const callbackURL = `${getApiBaseUrl(req)}/api/auth/google-callback`;
  passport.authenticate('google', { scope: ['profile', 'email'], callbackURL })(req, res, next);
});
router.get('/google-callback', (req, res, next) => {
  const callbackURL = `${getApiBaseUrl(req)}/api/auth/google-callback`;
  const frontendUrl = getFrontendUrl(req);
  passport.authenticate('google', {
    session: false,
    callbackURL,
    failureRedirect: `${frontendUrl}/login?error=google`,
  })(req, res, next);
}, (req, res) => {
  const token = generateToken(req.user);
  res.redirect(`${getFrontendUrl(req)}/oauth/callback?token=${encodeURIComponent(token)}&provider=${encodeURIComponent('Google')}`);
});

module.exports = router;
