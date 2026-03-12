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

  // ─────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────
  const allowedOrigins = [
    'https://act2026.vercel.app',
    'http://localhost:3000'
  ];

  const origin = req.headers.origin;

  // CORS
//   if (allowedOrigins.includes(origin)) {
//     res.setHeader('Access-Control-Allow-Origin', origin);
//   } else {
//     res.setHeader('Access-Control-Allow-Origin', 'https://act2026.vercel.app');
//   }

res.setHeader('Access-Control-Allow-Origin', '*');


res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');


  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed'
    });
  }

  // ─────────────────────────────────────────
  // BODY 안전 파싱 (Vercel 대응)
  // ─────────────────────────────────────────
  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      console.error('[login] JSON parse error:', err.message);

      return res.status(400).json({
        success: false,
        message: '잘못된 요청 형식입니다...'
      });
    }
  }

  console.log('[login] request body:', body);

  const { email, password } = body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: '이메일과 비밀번호를 입력하세요.'
    });
  }

  // ─────────────────────────────────────────
  // 환경변수 체크
  // ─────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[login] 환경변수 누락:', {
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_KEY: !!supabaseKey
    });

    return res.status(500).json({
      success: false,
      message: '서버 환경변수가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.',
      debug: {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_KEY: !!supabaseKey
      }
    });
  }

  // ─────────────────────────────────────────
  // Supabase Admin Client
  // ─────────────────────────────────────────
  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {

    // ─────────────────────────────────────────
    // 로그인 프로시저 호출
    // uf_login(email, password)
    // ─────────────────────────────────────────
    const { data: rows, error } = await supabaseAdmin
      .rpc('uf_login', {
        p_email: email,
        p_password: password
      });

    if (error) {
      console.error('[login] uf_login 오류:', error.message, error.code);

      return res.status(500).json({
        success: false,
        message: 'DB 오류가 발생했습니다.',
        debug: {
          code: error.code,
          detail: error.message
        }
      });
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    const user = rows[0];

    // ─────────────────────────────────────────
    // 계정 활성화 체크
    // ─────────────────────────────────────────
    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        message: '비활성화된 계정입니다.'
      });
    }

    // ─────────────────────────────────────────
    // JWT 발급
    // ─────────────────────────────────────────
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES
      }
    );

    // ─────────────────────────────────────────
    // 응답
    // ─────────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: {
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name
        }
      }
    });

  } catch (err) {

    console.error('[login] 예외:', err.message);
    console.error(err.stack);

    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      debug: {
        error: err.message
      }
    });
  }
};