/**
 * api/auth/me.js - Vercel Serverless Function
 * GET /api/auth/me
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'portal-secret-key-2026';

module.exports = async (req, res) => {
  const allowedOrigins = ['https://act2026.vercel.app', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://act2026.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.status(200).json({
      success: true,
      data: { id: decoded.id, email: decoded.email, username: decoded.username },
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
};
