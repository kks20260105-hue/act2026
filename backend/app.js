/**
 * app.js - Express 앱 설정 및 미들웨어
 * 차후 .NET 마이그레이션 시 Startup.cs / Program.cs 역할
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// 라우터 임포트
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');

const app = express();

// ─────────────────────────────────────────────
// 공통 미들웨어
// ─────────────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Rate Limiting (API 요청 제한)
// ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10, // 로그인 시도 10회 제한
  message: { success: false, message: '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도하세요.' },
});

// ─────────────────────────────────────────────
// 헬스 체크 엔드포인트
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// API 라우팅
// ─────────────────────────────────────────────
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/posts', apiLimiter, postRoutes);

// Auth 라우터는 authLimiter 적용
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authLimiter, authRoutes);

// ─────────────────────────────────────────────
// 에러 핸들러 (전역)
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || '서버 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 처리
app.use((req, res) => {
  res.status(404).json({ success: false, message: '요청한 리소스를 찾을 수 없습니다.' });
});

module.exports = app;
