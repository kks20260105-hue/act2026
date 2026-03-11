/**
 * api/auth/login.js - Vercel Serverless Function
 * POST /api/auth/login
 * public.users + uf_login() 프로시저로 인증 → JWT 발급
 */
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'portal-secret-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력하세요.' });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // uf_login(email, password) → public.users bcrypt 검증
    const { data: rows, error } = await supabaseAdmin
      .rpc('uf_login', { p_email: email, p_password: password });

    if (error) {
      console.error('[login] uf_login 오류:', error.message);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    const user = rows[0];

    // 계정 비활성화 체크
    if (user.is_active === false) {
      return res.status(403).json({ success: false, message: '비활성화된 계정입니다.' });
    }

    // JWT 발급
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.status(200).json({
      success: true,
      data: {
        accessToken: token,
        user: {
          id:          user.id,
          email:       user.email,
          username:    user.username,
          displayName: user.display_name,
        },
      },
    });
  } catch (err) {
    console.error('[login] 예외:', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};
