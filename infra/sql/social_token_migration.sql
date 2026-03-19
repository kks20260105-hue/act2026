-- ================================================================
-- 마이그레이션: social_access_token 컬럼 추가
-- 소셜 로그인 시 access_token 저장 → 로그아웃 시 토큰 폐기에 사용
-- Supabase SQL Editor에서 실행
-- ================================================================

-- ① 컬럼 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS social_access_token TEXT;

COMMENT ON COLUMN public.users.social_access_token IS '소셜 OAuth access_token (로그아웃 시 폐기용)';

-- ② access_token 업데이트 함수 (updated_at 컬럼 없어도 동작)
CREATE OR REPLACE FUNCTION public.uf_update_social_token(
  p_user_id     UUID,
  p_access_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
     SET social_access_token = p_access_token
   WHERE id = p_user_id;

  -- updated_at 컬럼이 있으면 갱신 (없어도 에러 없이 통과)
  BEGIN
    UPDATE public.users
       SET updated_at = NOW()
     WHERE id = p_user_id;
  EXCEPTION WHEN undefined_column THEN
    NULL; -- updated_at 없으면 무시
  END;
END;
$$;

COMMENT ON FUNCTION public.uf_update_social_token IS '소셜 OAuth access_token 저장 (로그아웃 토큰 폐기용)';

-- ③ 로그아웃용 조회 함수 (provider + token 반환)
CREATE OR REPLACE FUNCTION public.uf_get_user_social_token(
  p_user_id UUID
)
RETURNS TABLE (provider TEXT, social_access_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT u.provider, u.social_access_token
      FROM public.users u
     WHERE u.id = p_user_id
     LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.uf_get_user_social_token IS '로그아웃 시 소셜 토큰 조회';
