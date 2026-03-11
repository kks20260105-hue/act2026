/**
 * api/auth/logout.js - Vercel Serverless Function
 * POST /api/auth/logout
 */
module.exports = async (req, res) => {
  const allowedOrigins = ['https://act2026.vercel.app', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://act2026.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  return res.status(200).json({ success: true, message: '로그아웃되었습니다.' });
};
