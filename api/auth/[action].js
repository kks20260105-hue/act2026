/**
 * api/auth/[action].js - Vercel Serverless Function
 *
 * GET  /api/auth/naver           → 네이버 OAuth 시작 (Naver로 리다이렉트)
 * GET  /api/auth/naver-callback  → 네이버 OAuth 콜백 (토큰 教환 + Supabase upsert + JWT)
 * POST /api/auth/login           → 일반 이메일/비밀번호 로그인
 * POST /api/auth/logout          → 로그아웃
 * GET  /api/auth/me              → 내 정보 조회
 * POST /api/auth/register        → 사번(임직원) 회원가입
 *
 * Node 18+의 built-in fetch 사용 (별도 패키지 불필요)
 */

const { createClient } = require('@supabase/supabase-js');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const JWT_SECRET  = process.env.JWT_SECRET  || 'portal-secret-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// ─────────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────────

/** 허용된 CORS origin 목록 */
const getAllowedOrigins = () =>
  (process.env.CORS_ORIGIN || 'http://localhost:3000,https://act2026.vercel.app')
    .split(',').map((o) => o.trim());

/**
 * 현재 요청이 들어온 서버의 베이스 URL
 * Vercel: https://act2026.vercel.app
 * 로컬  : http://localhost:4000
 */
const getBaseUrl = (req) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host  = req.headers['x-forwarded-host']  || req.headers.host || 'act2026.vercel.app';
  return `${proto}://${host}`;
};

/**
 * OAuth 완료 후 리다이렉트할 프론트엔드 URL
 * Vercel 환경: API와 프론트가 같은 도메인 → getBaseUrl과 동일
 * 로컬 Express(포트 4000): 프론트는 포트 3000 → FRONTEND_URL 환경변수 사용
 */
const getFrontendUrl = (req) => {
  const base = getBaseUrl(req);
  if (base.includes('vercel.app') || base.includes('act2026')) return base;
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

/** Supabase service_role 클라이언트 */
const getSupabaseAdmin = () =>
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

/** JWT 발급 */
const generateJwt = (user) =>
  jwt.sign(
    {
      id:       user.id,
      email:    user.email,
      name:     user.name,
      provider: user.provider,
      roles:    user.roles ?? [],
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

/** 쿠키 헤더에서 특정 키 값을 파싱 */
const parseCookie = (cookieHeader, key) => {
  if (!cookieHeader) return null;
  const found = cookieHeader.split(';').find((c) => c.trim().startsWith(`${key}=`));
  return found ? found.split('=').slice(1).join('=').trim() : null;
};

module.exports = async (req, res) => {
  // ─────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────
  const origin         = req.headers.origin || '';
  const allowedOrigins = getAllowedOrigins();
  const corsOrigin     = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin',      corsOrigin);
  res.setHeader('Access-Control-Allow-Methods',     'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',     'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ═══════════════════════════════════════════
  // GET /api/auth/naver  →  네이버 OAuth 시작
  // ═══════════════════════════════════════════
  if (action === 'naver') {
    if (req.method !== 'GET') return res.status(405).end();

    const clientId = process.env.NAVER_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ success: false, message: '네이버 로그인이 아직 설정되지 않았습니다.' });
    }

    // CSRF 방지용 state (HttpOnly 쿠키에 5분 저장)
    const state       = crypto.randomBytes(16).toString('hex');
    const callbackUrl = encodeURIComponent(`${getBaseUrl(req)}/api/auth/naver-callback`);
    const naverUrl    =
      `https://nid.naver.com/oauth2.0/authorize` +
      `?response_type=code` +
      `&client_id=${clientId}` +
      `&state=${state}` +
      `&redirect_uri=${callbackUrl}`;

    res.setHeader('Set-Cookie',
      `naver_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300`);
    return res.redirect(302, naverUrl);
  }

  // ═══════════════════════════════════════════
  // GET /api/auth/naver-callback  →  콜백 처리
  // ═══════════════════════════════════════════
  if (action === 'naver-callback') {
    if (req.method !== 'GET') return res.status(405).end();

    const { code, state, error: naverError } = req.query;
    const frontendUrl = getFrontendUrl(req);

    // 1. 네이버에서 error 파라미터를 보낸 경우 (access_denied 등)
    if (naverError || !code) {
      return res.redirect(302, `${frontendUrl}/login?error=naver_denied`);
    }

    // 2. state 검증 (CSRF 방지)
    const cookieHeader = req.headers.cookie || '';
    const savedState   = parseCookie(cookieHeader, 'naver_oauth_state');
    if (!savedState || savedState !== state) {
      console.warn('[naver-callback] state 불일치 savedState=%s, state=%s', savedState, state);
      return res.redirect(302, `${frontendUrl}/login?error=naver_state`);
    }
    // state 쿠키 삭제
    res.setHeader('Set-Cookie', 'naver_oauth_state=; Path=/; HttpOnly; Max-Age=0');

    const clientId     = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.redirect(302, `${frontendUrl}/login?error=naver_config`);
    }

    try {
      // 3. 액세스 토큰 발급
      const tokenUrl =
        `https://nid.naver.com/oauth2.0/token` +
        `?grant_type=authorization_code` +
        `&client_id=${clientId}` +
        `&client_secret=${clientSecret}` +
        `&code=${code}` +
        `&state=${state}`;

      const tokenRes  = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error || !tokenData.access_token) {
        console.error('[naver-callback] 토큰 발급 실패:', tokenData);
        return res.redirect(302, `${frontendUrl}/login?error=naver_token`);
      }

      // 4. 프로필 조회
      const profileRes  = await fetch('https://openapi.naver.com/v1/nid/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileRes.json();

      if (profileData.resultcode !== '00' || !profileData.response) {
        console.error('[naver-callback] 프로필 조회 실패:', profileData);
        return res.redirect(302, `${frontendUrl}/login?error=naver_profile`);
      }

      const naverUser = profileData.response;
      // ── 네이버 프로필 전체 덤프 ──
      console.log('[naver-callback] ① 네이버 원본 response 전체:\n', JSON.stringify(naverUser, null, 2));

      const nameValue  = naverUser.name         || naverUser.nickname || '';
      const emailValue = naverUser.email         || '';
      const imgValue   = naverUser.profile_image || null;
      console.log('[naver-callback] ② 추출값 → name:', JSON.stringify(nameValue), '| email:', emailValue, '| img:', !!imgValue);

      // 5. public.users에 소셜 사용자 upsert (uf_upsert_social_user RPC)
      const supabaseAdmin = getSupabaseAdmin();
      const rpcParams = {
        p_provider:      'naver',
        p_provider_id:   String(naverUser.id),
        p_email:         emailValue,
        p_name:          nameValue,
        p_profile_image: imgValue,
      };
      console.log('[naver-callback] ③ RPC 호출 파라미터:', JSON.stringify(rpcParams));

      const { data: rows, error: rpcError } = await supabaseAdmin.rpc('uf_upsert_social_user', rpcParams);

      if (rpcError || !rows?.[0]) {
        console.error('[naver-callback] ④ Supabase upsert 오류:', rpcError?.message, '| code:', rpcError?.code);
        return res.redirect(302, `${frontendUrl}/login?error=naver_db`);
      }

      const user = rows[0];
      console.log('[naver-callback] ⑤ DB 저장 결과 → id:', user.id, '| name:', user.name, '| email:', user.email);

      // 6. access_token DB 저장 (await - 리다이렉트 전 완료 보장)
      const { error: tokErr } = await supabaseAdmin.rpc('uf_update_social_token', {
        p_user_id:      user.id,
        p_access_token: tokenData.access_token,
      });
      if (tokErr) {
        console.error('[naver-callback] ⚠️ social_token 저장 실패:', tokErr.message, '| code:', tokErr.code);
      } else {
        console.log('[naver-callback] ✅ social_token 저장 완료 (길이:', tokenData.access_token?.length, ')');
      }

      // 7. roles 조회
      const { data: roleData } = await supabaseAdmin
        .from('tb_user_role')
        .select('tb_role(role_cd)')
        .eq('user_id', user.id);
      const roles = (roleData ?? []).map((r) => r.tb_role?.role_cd).filter(Boolean);

      // 8. 로그인 이력 기록 (roles 조회 후 - 비동기, 실패해도 로그인 계속)
      supabaseAdmin.rpc('uf_insert_login_log', {
        p_user_id:    user.id,
        p_provider:   'naver',
        p_email:      user.email ?? null,
        p_name:       user.name  ?? nameValue ?? null,
        p_ip:         req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? null,
        p_user_agent: req.headers['user-agent'] ?? null,
        p_status:     'success',
        p_extra_json: JSON.stringify({
          provider_id:  naverUser.id,
          naver_email:  emailValue,
          has_name:     !!nameValue,
          has_image:    !!imgValue,
          token_saved:  !tokErr,
          roles,
        }),
      }).then(({ error: logErr }) => {
        if (logErr) console.warn('[naver-callback] login_log 삽입 실패:', logErr.message);
      });

      // 9. JWT 발급 → 프론트엔드로 리다이렉트
      const token = generateJwt({ ...user, roles });
      console.log('[naver-callback] 로그인 성공:', user.name, '→', frontendUrl);

      return res.redirect(302,
        `${frontendUrl}/oauth/callback?token=${encodeURIComponent(token)}&provider=${encodeURIComponent('네이버')}`
      );
    } catch (err) {
      console.error('[naver-callback] 예외 발생:', err.message);
      return res.redirect(302, `${getFrontendUrl(req)}/login?error=naver_server`);
    }
  }

  // ═══════════════════════════════════════════
  // POST /api/auth/register  →  사번 회원가입
  // ═══════════════════════════════════════════
  if (action === 'register') {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ success: false, message: '잘못된 요청 형식입니다.' }); }
    }

    const { employeeId, name, email, department, position, password } = body || {};
    if (!employeeId || !name || !email || !password) {
      return res.status(400).json({ success: false, message: '사번, 이름, 이메일, 비밀번호는 필수입니다.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: '비밀번호는 8자 이상이어야 합니다.' });
    }

    try {
      const supabaseAdmin  = getSupabaseAdmin();
      const hashedPassword = await bcrypt.hash(password, 12);

      const { data: result, error: rpcError } = await supabaseAdmin.rpc('uf_register_employee', {
        p_employee_id: employeeId,
        p_name:        name,
        p_email:       email,
        p_department:  department || null,
        p_position:    position   || null,
        p_password:    hashedPassword,
      });

      if (rpcError) {
        console.error('[register] RPC 오류:', rpcError.message);
        return res.status(500).json({ success: false, message: 'DB 오류: ' + rpcError.message });
      }
      if (!result?.ok) {
        return res.status(409).json({ success: false, message: result?.message || '이미 등록된 사번 또는 이메일입니다.' });
      }

      return res.status(201).json({
        success: true,
        message: '가입 신청이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.',
      });
    } catch (err) {
      console.error('[register] 예외:', err.message);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  }

  // ═══════════════════════════════════════════
  // POST /api/auth/login  →  일반 이메일 로그인
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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ success: false, message: '서버 환경변수가 설정되지 않았습니다.' });
    }
    const supabaseAdmin = getSupabaseAdmin();

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

      const token = generateJwt({
        id:       user.id,
        email:    user.email,
        name:     user.display_name || user.name || user.username,
        provider: 'local',
        roles,
      });

      return res.status(200).json({
        success: true,
        data: {
          accessToken: token,
          user: {
            id:          user.id,
            email:       user.email,
            name:        user.display_name || user.name || user.username,
            displayName: user.display_name,
            provider:    'local',
            roles,
          },
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

    // JWT에서 user_id 추출
    let logoutUserId = null;
    try {
      const authHeader = req.headers.authorization ?? '';
      if (authHeader.startsWith('Bearer ')) {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        logoutUserId = decoded?.id ?? decoded?.sub ?? null;
        console.log('[logout] JWT 디코딩 성공 → user_id:', logoutUserId);
      } else {
        console.warn('[logout] Authorization 헤더 없음 or Bearer 아님');
      }
    } catch (jwtErr) {
      console.warn('[logout] JWT 파싱 실패 (만료 등):', jwtErr.message);
    }

    if (logoutUserId) {
      const supabaseAdmin = getSupabaseAdmin();

      // ① 소셜 토큰 조회 (await)
      const { data: tokenRows, error: tokenQueryErr } = await supabaseAdmin
        .rpc('uf_get_user_social_token', { p_user_id: logoutUserId });

      if (tokenQueryErr) {
        console.error('[logout] 토큰 조회 RPC 오류:', tokenQueryErr.message, '| code:', tokenQueryErr.code);
      }

      const row = tokenRows?.[0];
      console.log('[logout] 토큰 조회 결과 → provider:', row?.provider, '| token 있음:', !!row?.social_access_token);

      // ② 네이버 토큰 폐기 (await)
      if (row?.provider === 'naver' && row?.social_access_token) {
        const revokeUrl = `https://nid.naver.com/oauth2.0/token` +
          `?grant_type=delete` +
          `&client_id=${process.env.NAVER_CLIENT_ID}` +
          `&client_secret=${process.env.NAVER_CLIENT_SECRET}` +
          `&access_token=${encodeURIComponent(row.social_access_token)}` +
          `&service_provider=NAVER`;

        try {
          const revokeRes  = await fetch(revokeUrl);
          const revokeJson = await revokeRes.json();
          console.log('[logout] 네이버 토큰 폐기 결과:', JSON.stringify(revokeJson));
        } catch (revokeErr) {
          console.error('[logout] 네이버 토큰 폐기 HTTP 오류:', revokeErr.message);
        }

        // ③ DB 토큰 null 처리 (await)
        const { error: clearErr } = await supabaseAdmin.rpc('uf_update_social_token', {
          p_user_id:      logoutUserId,
          p_access_token: null,
        });
        if (clearErr) {
          console.error('[logout] DB 토큰 삭제 실패:', clearErr.message, '| code:', clearErr.code);
        } else {
          console.log('[logout] ✅ DB social_access_token → null 완료');
        }
      } else if (row?.provider === 'naver' && !row?.social_access_token) {
        console.warn('[logout] 네이버 유저인데 social_access_token이 이미 null (로그인 시 저장 실패 가능성)');
      }

      // ④ 로그아웃 이력 기록 (비동기 - 실패해도 무관)
      supabaseAdmin.rpc('uf_insert_login_log', {
        p_user_id:    logoutUserId,
        p_provider:   row?.provider ?? 'unknown',
        p_email:      null,
        p_name:       null,
        p_ip:         req.headers['x-forwarded-for'] ?? null,
        p_user_agent: req.headers['user-agent'] ?? null,
        p_status:     'success',
        p_fail_reason: 'logout',
        p_extra_json:  JSON.stringify({
          action:  'logout',
          revoked: row?.provider === 'naver' && !!row?.social_access_token,
        }),
      }).catch((e) => console.warn('[logout] login_log 기록 실패:', e.message));
    } else {
      console.warn('[logout] user_id 없음 → 토큰 폐기 건너뜀');
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
