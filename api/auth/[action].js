/**
 * api/auth/[action].js - Vercel Serverless Function
 * Handles: POST /api/auth/login
 *          POST /api/auth/logout
 *          GET  /api/auth/me
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'portal-secret-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

module.exports = async (req, res) => {
  // ─────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ═══════════════════════════════════════════
  // POST /api/auth/login
  // ═══════════════════════════════════════════
  if (action === 'login') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ success: false, message: '잘못된 요청 형식입니다.' }); }
    }

    const { email, password } = body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력하세요.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        message: '서버 환경변수가 설정되지 않았습니다.',
        debug: { SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_KEY: !!supabaseKey },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
      const { data: rows, error } = await supabaseAdmin.rpc('uf_login', {
        p_email:    email,
        p_password: password,
      });

      if (error) {
        return res.status(500).json({ success: false, message: 'DB 오류가 발생했습니다.', debug: { code: error.code, detail: error.message } });
      }
      if (!rows || rows.length === 0) {
        return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      const user = rows[0];
      if (user.is_active === false) {
        return res.status(403).json({ success: false, message: '비활성화된 계정입니다.' });
      }

      // Role 조회
      const { data: roleRows } = await supabaseAdmin
        .from('tb_user_role')
        .select('tb_role(role_cd)')
        .eq('user_id', user.id);

      const roles = (roleRows ?? []).map((r) => r.tb_role?.role_cd).filter(Boolean);

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username, roles },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.status(200).json({
        success: true,
        data: {
          accessToken: token,
          user: { id: user.id, email: user.email, username: user.username, displayName: user.display_name, roles },
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', debug: { error: err.message } });
    }
  }

  // ═══════════════════════════════════════════
  // POST /api/auth/logout
  // ═══════════════════════════════════════════
  if (action === 'logout') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
    return res.status(200).json({ success: true, message: '로그아웃되었습니다.' });
  }

  // ═══════════════════════════════════════════
  // GET /api/auth/me
  // ═══════════════════════════════════════════
  if (action === 'me') {
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.' });
    }

    try {
      const token   = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.status(200).json({
        success: true,
        data: { id: decoded.id, email: decoded.email, username: decoded.username, roles: decoded.roles ?? [] },
      });
    } catch {
      return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
  }

  return res.status(404).json({ success: false, message: `알 수 없는 액션: ${action}` });
};
