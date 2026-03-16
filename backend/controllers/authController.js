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
          const userId = userRows?.[0]?.id ?? null;
          if (userId) {
            await admin.rpc('up_insert_login_log', {
              p_user_id: userId, p_ip: ip, p_agent: userAgent, p_success: false,
            });
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
        await admin.rpc('up_insert_login_log', {
          p_user_id: result.data.user.id, p_ip: ip, p_agent: userAgent, p_success: true,
        });
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
   */
  logout: async (req, res, next) => {
    try {
      return res.json({ success: true, message: '로그아웃되었습니다.' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/auth/me
   */
  getMe: async (req, res) => {
    return res.json({ success: true, data: req.user });
  },
};

module.exports = authController;
