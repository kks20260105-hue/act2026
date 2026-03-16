/**
 * middlewares/authMiddleware.js - JWT 토큰 검증 미들웨어
 * 차후 .NET 마이그레이션 시 → JwtBearerAuthentication Middleware (ASP.NET Core)
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'portal-secret-key-2026';

/**
 * verifyToken 미들웨어
 * Authorization: Bearer <JWT> 헤더 검증
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];

    // JWT 검증
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id:       decoded.id,
      email:    decoded.email,
      username: decoded.username,
      roles:    decoded.roles ?? [],   // roles 포함 (sharedAuth.js에서 발급)
    };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않거나 만료된 토큰입니다.' });
  }
};

module.exports = { verifyToken };
