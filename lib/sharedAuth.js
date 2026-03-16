/**
 * lib/sharedAuth.js  – CommonJS 공유 인증 유틸리티
 *
 * 개발환경 (Express backend)과 Vercel 서버리스(api/) 양쪽에서 공통으로 사용합니다.
 *   - backend/controllers/authController.js  → require('../../lib/sharedAuth')
 *   - api/auth/login.js                      → require('../../lib/sharedAuth')
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'portal-secret-key-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// ─────────────────────────────────────────────────────────────────
// Supabase Admin 클라이언트 생성 (매 요청마다 재사용 가능한 싱글톤 패턴)
// ─────────────────────────────────────────────────────────────────
let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('[sharedAuth] SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 환경변수가 없습니다.');
  }

  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _supabaseAdmin;
}

// ─────────────────────────────────────────────────────────────────
// DB 프로시저: uf_login(email, password) 호출
// 성공 시 user row 반환, 실패 시 null
// ─────────────────────────────────────────────────────────────────
async function ufLogin(email, password) {
  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin.rpc('uf_login', {
    p_email:    email,
    p_password: password,
  });

  if (error) throw new Error(error.message);
  return rows?.[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────
// tb_user_role → tb_role.role_cd 목록 조회
// ─────────────────────────────────────────────────────────────────
async function queryUserRoles(userId) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('tb_user_role')
    .select('tb_role(role_cd)')
    .eq('user_id', userId);

  if (error) {
    console.error('[sharedAuth] role 조회 오류:', error.message);
    return [];
  }

  return (data ?? []).map((r) => r.tb_role?.role_cd).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────
// JWT 발급
// payload: { id, email, username, roles }
// ─────────────────────────────────────────────────────────────────
function issueJWT(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// ─────────────────────────────────────────────────────────────────
// 로그인 전체 흐름 (DB 조회 → roles 조회 → JWT 발급 → 응답 객체 반환)
// ─────────────────────────────────────────────────────────────────
async function loginFlow(email, password) {
  const user = await ufLogin(email, password);
  if (!user) return { ok: false, status: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  if (user.is_active === false) return { ok: false, status: 403, message: '비활성화된 계정입니다.' };

  const roles       = await queryUserRoles(user.id);
  const accessToken = issueJWT({ id: user.id, email: user.email, username: user.username, roles });

  return {
    ok: true,
    data: {
      accessToken,
      user: {
        id:          user.id,
        email:       user.email,
        username:    user.username,
        displayName: user.display_name,
        roles,
      },
    },
  };
}

module.exports = { getSupabaseAdmin, ufLogin, queryUserRoles, issueJWT, loginFlow };
