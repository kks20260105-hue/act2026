/**
 * controllers/authController.js - 인증 비즈니스 로직
 * DB: uf_login() 프로시저로 이메일+비밀번호 검증
 * 차후 .NET 마이그레이션 시 → AuthController.cs (ASP.NET Core)
 *
 * 공유 로직: lib/sharedAuth.js  (개발환경 + Vercel 공통)
 */
const { validationResult } = require('express-validator');
const { loginFlow, getSupabaseAdmin } = require('../../lib/sharedAuth');

const authController = {
  /**
   * POST /api/auth/login
   * uf_login(email, password) 프로시저로 검증 → JWT 발급
   */
  login: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.warn('[login] ❌ 유효성 검사 실패:', errors.array());
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password } = req.body;
      const ip        = req.ip || req.headers['x-forwarded-for'] || '';
      const userAgent = req.headers['user-agent'] || '';

      console.group('[login] 🔐 로그인 요청');
      console.log('📧 email:', email);
      console.log('🌐 ip:', ip);
      console.log('🔑 SUPABASE_URL 설정 여부:', !!process.env.SUPABASE_URL);
      console.log('🔑 SUPABASE_SERVICE_KEY 설정 여부:', !!process.env.SUPABASE_SERVICE_KEY);
      console.log('🔑 SUPABASE_SERVICE_KEY 앞 20자:', process.env.SUPABASE_SERVICE_KEY?.substring(0, 20));
      console.groupEnd();

      // ── 공유 loginFlow (lib/sharedAuth.js) ──────────────────
      console.log('[login] loginFlow 호출 시작...');
      const result = await loginFlow(email, password || '');
      console.log('[login] loginFlow 완료 → ok:', result.ok, '| status:', result.status ?? 200);

      if (!result.ok) {
        console.warn('[login] ❌ 로그인 실패:', result.message);
        // 로그인 실패 로그
        try {
          const admin = getSupabaseAdmin();
          const { data: userRows } = await admin.rpc('uf_get_user_by_email', { p_email: email });
          const failUser = userRows?.[0] ?? null;
          if (failUser?.id) {
            admin.rpc('uf_insert_login_log', {
              p_user_id:    failUser.id,
              p_provider:   failUser.provider ?? 'local',
              p_email:      email,
              p_name:       failUser.name ?? null,
              p_ip:         ip,
              p_user_agent: userAgent,
              p_status:     'fail',
              p_fail_reason: result.message ?? '로그인 실패',
              p_extra_json: JSON.stringify({ action: 'login', reason: result.message }),
            }).catch(() => {});
          }
        } catch (_) { /* 로그 실패는 무시 */ }

        return res.status(result.status).json({ success: false, message: result.message });
      }

      console.group('[login] ✅ 로그인 성공');
      console.log('👤 user.id:', result.data.user.id);
      console.log('📧 user.email:', result.data.user.email);
      console.log('🎭 roles:', JSON.stringify(result.data.user.roles));
      console.log('🎫 accessToken 앞 30자:', result.data.accessToken?.substring(0, 30));
      console.groupEnd();

      // 로그인 성공 로그
      try {
        const admin = getSupabaseAdmin();
        admin.rpc('uf_insert_login_log', {
          p_user_id:    result.data.user.id,
          p_provider:   result.data.user.provider ?? 'local',
          p_email:      result.data.user.email ?? null,
          p_name:       result.data.user.name   ?? null,
          p_ip:         ip,
          p_user_agent: userAgent,
          p_status:     'success',
          p_extra_json: JSON.stringify({
            action: 'login',
            roles:  result.data.user.roles ?? [],
          }),
        }).catch(() => {});
      } catch (_) { /* 로그 실패는 무시 */ }

      return res.json({ success: true, data: result.data });
    } catch (err) {
      console.error('[login] 💥 예외 발생:', err.message);
      console.error(err.stack);
      next(err);
    }
  },

  /**
   * POST /api/auth/logout
   * - 소셜 로그인(네이버 등) access_token 폐기
   * - user_login_logs에 logout 이력 기록
   */
  logout: async (req, res, next) => {
    try {
      const userId = req.user?.id ?? null;
      console.log('[logout] 요청 user_id:', userId, '| provider:', req.user?.provider);

      if (userId) {
        const admin = getSupabaseAdmin();

        // ① 소셜 토큰 조회 (await)
        const { data: tokenRows, error: tokenQueryErr } = await admin
          .rpc('uf_get_user_social_token', { p_user_id: userId });

        if (tokenQueryErr) {
          console.error('[logout] 토큰 조회 RPC 오류:', tokenQueryErr.message, '| code:', tokenQueryErr.code);
        }

        const row = tokenRows?.[0];
        console.log('[logout] 토큰 조회 결과 → provider:', row?.provider, '| token 있음:', !!row?.social_access_token);

        // ② 네이버 토큰 폐기 (await)
        if (row?.provider === 'naver' && row?.social_access_token) {
          const revokeUrl = new URL('https://nid.naver.com/oauth2.0/token');
          revokeUrl.searchParams.set('grant_type',       'delete');
          revokeUrl.searchParams.set('client_id',        process.env.NAVER_CLIENT_ID);
          revokeUrl.searchParams.set('client_secret',    process.env.NAVER_CLIENT_SECRET);
          revokeUrl.searchParams.set('access_token',     row.social_access_token);
          revokeUrl.searchParams.set('service_provider', 'NAVER');

          try {
            const revokeRes  = await fetch(revokeUrl.toString());
            const revokeJson = await revokeRes.json();
            console.log('[logout] 네이버 토큰 폐기 결과:', JSON.stringify(revokeJson));
          } catch (revokeErr) {
            console.error('[logout] 네이버 토큰 폐기 HTTP 오류:', revokeErr.message);
          }

          // ③ DB 토큰 null 처리 (await)
          const { error: clearErr } = await admin.rpc('uf_update_social_token', {
            p_user_id:      userId,
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
        admin.rpc('uf_insert_login_log', {
          p_user_id:     userId,
          p_provider:    row?.provider ?? 'unknown',
          p_email:       req.user?.email ?? null,
          p_name:        req.user?.name  ?? null,
          p_ip:          req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
          p_user_agent:  req.headers?.['user-agent'] ?? null,
          p_status:      'success',
          p_fail_reason: 'logout',
          p_extra_json:  JSON.stringify({
            action:  'logout',
            revoked: row?.provider === 'naver' && !!row?.social_access_token,
          }),
        }).catch((e) => console.warn('[logout] login_log 기록 실패:', e.message));
      } else {
        console.warn('[logout] user_id 없음 → 토큰 폐기 건너뜀');
      }

      return res.json({ success: true, message: '로그아웃되었습니다.' });
    } catch (err) {
      console.error('[logout] 예외 발생:', err.message);
      next(err);
    }
  },

  /**
   * GET /api/auth/me
   */
  getMe: async (req, res) => {
    return res.json({ success: true, data: req.user });
  },

  /**
   * POST /api/auth/register - 일반 사번 등록 (회원가입)
   * → 기존 public.users 테이블에 통합 저장 (별도 테이블 X)
   * → uf_register_employee RPC 사용 (이메일/사번 중복 체크 + INSERT)
   * → status='pending' : 관리자 승인 후 is_active=true 처리
   */
  register: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { employeeId, name, email, department, position, password } = req.body;

      // bcrypt 해싱 (백엔드에서 처리, DB에는 해시만 저장)
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);

      const admin = getSupabaseAdmin();

      // uf_register_employee RPC: public.users 에 직접 INSERT
      // (이메일/사번 중복 체크 포함)
      const { data: result, error } = await admin.rpc('uf_register_employee', {
        p_employee_id: employeeId,
        p_name:        name,
        p_email:       email,
        p_department:  department ?? null,
        p_position:    position   ?? null,
        p_password:    hashedPassword,
      });

      if (error) {
        console.error('[register] RPC 오류:', error.message);
        return res.status(500).json({ success: false, message: '회원가입 처리 중 오류가 발생했습니다.' });
      }

      // RPC 반환값: { ok, message?, id?, status? }
      if (!result?.ok) {
        return res.status(409).json({ success: false, message: result?.message ?? '가입에 실패했습니다.' });
      }

      console.log(`[register] ✅ 신규 사번 등록: ${name} (${employeeId}) → public.users`);
      return res.status(201).json({
        success: true,
        message: '가입 신청이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.',
        data:    { id: result.id, name, status: result.status },
      });
    } catch (err) {
      console.error('[register] 예외 발생:', err.message);
      next(err);
    }
  },
};

module.exports = authController;
