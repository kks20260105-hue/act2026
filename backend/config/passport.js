/**
 * config/passport.js
 * 소셜 로그인 Passport 전략 설정 (네이버, 카카오, Google)
 * 최초 로그인 시 자동 회원가입 처리
 *
 * 필요 패키지: npm install passport passport-naver passport-kakao passport-google-oauth20
 */
const passport       = require('passport');
const NaverStrategy  = require('passport-naver').Strategy;
const KakaoStrategy  = require('passport-kakao').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getSupabaseAdmin } = require('../../lib/sharedAuth');

// ─────────────────────────────────────────────
// 공통: 소셜 로그인 처리
// 기존 public.users 테이블에 통합 (별도 테이블 X)
// uf_upsert_social_user RPC → 조회 or 자동 INSERT
// ─────────────────────────────────────────────
const handleSocialLogin = async (provider, profile, done, req, accessToken = null) => {
  try {
    const admin      = getSupabaseAdmin();
    const providerId = String(profile.id);
    const ipAddress  = req?.ip ?? req?.headers?.['x-forwarded-for'] ?? null;
    const userAgent  = req?.headers?.['user-agent'] ?? null;

    let email = '';
    let name  = profile.displayName ?? '';
    let profileImage = '';

    if (provider === 'naver') {
      email        = profile._json?.email        ?? '';
      name         = profile._json?.name         ?? profile._json?.nickname ?? profile.displayName ?? '';
      profileImage = profile._json?.profile_image ?? '';
      // ── 네이버 프로필 전체 덤프 ──
      console.log('[passport][naver] ① 원본 _json 전체:\n', JSON.stringify(profile._json, null, 2));
      console.log('[passport][naver] ② 추출값 → name:', JSON.stringify(name), '| email:', email, '| profileImage:', !!profileImage);
    } else if (provider === 'kakao') {
      email        = profile._json?.kakao_account?.email ?? '';
      name         = profile._json?.kakao_account?.profile?.nickname
                  || profile._json?.properties?.nickname
                  || profile.displayName
                  || '';
      profileImage = profile._json?.kakao_account?.profile?.profile_image_url
                  || profile._json?.properties?.profile_image
                  || '';
    } else if (provider === 'google') {
      email        = profile.emails?.[0]?.value ?? '';
      profileImage = profile.photos?.[0]?.value ?? '';
    }

    // ✅ 카카오 이메일 미제공 시 → kakao_id 기반 가상 이메일 자동 생성 후 기존 로직 그대로 진행
    // 비즈 앱 심사 완료 후 카카오가 실 이메일을 제공하면 이 조건은 자동으로 스킵됩니다.
    if (provider === 'kakao' && !email) {
      email = `kakao_${providerId}@kakao.com`;
      console.log('[passport][kakao] ⚠️ 이메일 미제공 → 가상 이메일 자동 생성:', email);
    }

    // ✅ public.users 에서 조회 or 자동 가입 (RPC 호출)
    const rpcParams = {
      p_provider:      provider,
      p_provider_id:   providerId,
      p_email:         email,
      p_name:          name,
      p_profile_image: profileImage || null,
    };
    console.log('[passport] ③ RPC 호출 파라미터:', JSON.stringify(rpcParams));

    const { data: rows, error } = await admin.rpc('uf_upsert_social_user', rpcParams);

    if (error) {
      console.error('[passport] ⑤ RPC 오류:', error.message, '| code:', error.code, '| details:', error.details);
      return done(error);
    }

    const user = rows?.[0];
    if (!user) return done(new Error('사용자 처리 실패'));
    console.log('[passport] ⑤ DB 결과 → id:', user.id, '| provider:', provider, '| email:', user.email || '(비어있음)', '| name:', user.name);

    // ── RPC 후 email 이 비어있는 경우 대비 후처리 (DB 직접 패치)
    if (!user.email && email) {
      console.warn('[passport] ⚠️ email 비어있음 → 직접 UPDATE:', email);
      const { error: patchErr } = await admin
        .from('users')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (patchErr) {
        console.error('[passport] 후처리 UPDATE 실패:', patchErr.message);
      } else {
        user.email = email;
        console.log('[passport] ✅ email 후처리 UPDATE 완료:', email);
      }
    }

    // ── access_token DB 저장 (await - roles 조회 전 완료 보장)
    if (accessToken) {
      const { error: tokErr } = await admin.rpc('uf_update_social_token', {
        p_user_id:     user.id,
        p_access_token: accessToken,
      });
      if (tokErr) {
        console.error('[passport] social_token 저장 실패:', tokErr.message, '| code:', tokErr.code);
      } else {
        console.log('[passport] ✅ social_token 저장 완료 (길이:', accessToken?.length, ')');
      }
    }

    // ── 로그인 이력 남기기 (비동기, 실패해도 로그인 계속)
    // ※ roles 선언 이후에 위치해야 TDZ 오류 없음

    // roles 조회 (tb_user_role)
    const { data: roleData } = await admin
      .from('tb_user_role')
      .select('tb_role(role_cd)')
      .eq('user_id', user.id);
    const roles = (roleData ?? []).map((r) => r.tb_role?.role_cd).filter(Boolean);

    admin.rpc('uf_insert_login_log', {
      p_user_id:    user.id,
      p_provider:   provider,
      p_email:      user.email   ?? null,
      p_name:       user.name    ?? null,
      p_ip:         ipAddress,
      p_user_agent: userAgent,
      p_status:     'success',
      p_extra_json: JSON.stringify({
        provider_id:   providerId,
        raw_name:      name,              // 네이버가 넘겨준 원본 name 값 (null이면 API 미제공)
        has_name:      !!name,            // false면 네이버 콘솔 이름 권한 미설정
        profile_image: !!user.profile_image,
        roles,
      }),
    }).then(({ error: logErr }) => {
      if (logErr) console.warn('[passport] login_log 삽입 실패:', logErr.message);
    });

    console.log(`[passport] ${provider} 로그인 완료 → ${user.name || name} (roles: ${roles.join(',') || 'none'})`);
    return done(null, { ...user, roles });
  } catch (err) {
    console.error(`[passport] handleSocialLogin 오류:`, err.message);
    return done(err);
  }
};

// ─────────────────────────────────────────────
// 네이버 전략 (CLIENT_ID 설정된 경우에만 등록)
// ─────────────────────────────────────────────
if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
  passport.use(new NaverStrategy(
    {
      clientID:          process.env.NAVER_CLIENT_ID,
      clientSecret:      process.env.NAVER_CLIENT_SECRET,
      callbackURL:       process.env.NAVER_CALLBACK_URL,
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) => {
      handleSocialLogin('naver', profile, done, req, accessToken);
    }
  ));
  console.log('[passport] ✅ 네이버 전략 등록');
} else {
  console.warn('[passport] ⚠️  NAVER_CLIENT_ID 미설정 - 네이버 로그인 비활성');
}

// ─────────────────────────────────────────────
// 카카오 전략 (CLIENT_ID 설정된 경우에만 등록)
// ─────────────────────────────────────────────
if (process.env.KAKAO_CLIENT_ID) {
  passport.use(new KakaoStrategy(
    {
      clientID:          process.env.KAKAO_CLIENT_ID,
      clientSecret:      process.env.KAKAO_CLIENT_SECRET || '',
      callbackURL:       process.env.KAKAO_CALLBACK_URL,
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) => {
      handleSocialLogin('kakao', profile, done, req, accessToken);
    }
  ));
  console.log('[passport] ✅ 카카오 전략 등록');
} else {
  console.warn('[passport] ⚠️  KAKAO_CLIENT_ID 미설정 - 카카오 로그인 비활성');
}

// ─────────────────────────────────────────────
// Google 전략 (CLIENT_ID 설정된 경우에만 등록)
// ─────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:          process.env.GOOGLE_CLIENT_ID,
      clientSecret:      process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:       process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) => {
      handleSocialLogin('google', profile, done, req, accessToken);
    }
  ));
  console.log('[passport] ✅ Google 전략 등록');
} else {
  console.warn('[passport] ⚠️  GOOGLE_CLIENT_ID 미설정 - Google 로그인 비활성');
}

module.exports = passport;
