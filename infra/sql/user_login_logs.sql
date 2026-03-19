-- ================================================================
-- user_login_logs 테이블: 소셜/사번 로그인 이력 기록
-- Supabase SQL Editor에서 실행
-- ================================================================

-- ① 테이블 생성 (기존 테이블 제거 후 재생성)
DROP TABLE IF EXISTS public.user_login_logs CASCADE;

CREATE TABLE public.user_login_logs (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  provider     TEXT         NOT NULL,                -- 'naver' | 'kakao' | 'google' | 'local'
  email        TEXT,
  name         TEXT,                                 -- 사용자 이름
  ip_address   TEXT,
  user_agent   TEXT,
  status       TEXT         NOT NULL DEFAULT 'success', -- 'success' | 'fail' | 'logout'
  fail_reason  TEXT,                                 -- 실패/로그아웃 사유
  extra_json   TEXT,                                 -- 전체 컨텍스트 JSON (provider_id, roles 등)
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ② 인덱스
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id    ON public.user_login_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_provider   ON public.user_login_logs (provider);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON public.user_login_logs (created_at DESC);

-- ③ RLS (서비스 롤 키는 bypass, 일반 사용자는 본인 것만 조회 가능)
ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'user_login_logs'
       AND policyname = '본인 로그인 이력 조회'
  ) THEN
    CREATE POLICY "본인 로그인 이력 조회"
      ON public.user_login_logs
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ④ 로그인 기록 삽입 함수 (SECURITY DEFINER → service_role 없이도 삽입 가능)
-- 기존 오버로드 버전 전부 제거 후 재생성
DROP FUNCTION IF EXISTS public.uf_insert_login_log(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.uf_insert_login_log(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.uf_insert_login_log(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.uf_insert_login_log(
  p_user_id     UUID,
  p_provider    TEXT,
  p_email       TEXT    DEFAULT NULL,
  p_name        TEXT    DEFAULT NULL,
  p_ip          TEXT    DEFAULT NULL,
  p_user_agent  TEXT    DEFAULT NULL,
  p_status      TEXT    DEFAULT 'success',
  p_fail_reason TEXT    DEFAULT NULL,
  p_extra_json  TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_login_logs
    (user_id, provider, email, name, ip_address, user_agent, status, fail_reason, extra_json)
  VALUES
    (p_user_id, p_provider, p_email, p_name, p_ip, p_user_agent, p_status, p_fail_reason, p_extra_json);
END;
$$;

COMMENT ON TABLE  public.user_login_logs IS '로그인 이력 (소셜/사번 공통)';
COMMENT ON FUNCTION public.uf_insert_login_log IS '로그인 이력 삽입 (SECURITY DEFINER)';
