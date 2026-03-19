-- ================================================================
-- 마이그레이션: public.users 확장
-- 설명: 소셜 OAuth(네이버/카카오/Google) + 사번 가입을 public.users 에 통합
-- 실행: Supabase Dashboard → SQL Editor에서 순서대로 실행
-- ================================================================

-- ----------------------------------------------------------------
-- Step 1. public.users 컬럼 추가
--   - provider      : 가입 유형 (local=사번, naver, kakao, google)
--   - provider_id   : 소셜 고유 ID (local이면 NULL)
--   - employee_id   : 사번 (사번가입일 때만 사용)
--   - name          : 실제 이름 (username 은 닉네임)
--   - department    : 부서
--   - position      : 직급
--   - profile_image : 소셜 프로필 이미지
--   - status        : active(정상), pending(승인대기), blocked(차단)
--   - password_hash : 사번 가입자 bcrypt 해시 (소셜은 NULL)
-- ----------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS provider       TEXT        NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS provider_id    TEXT,
  ADD COLUMN IF NOT EXISTS employee_id    TEXT,
  ADD COLUMN IF NOT EXISTS name           TEXT,
  ADD COLUMN IF NOT EXISTS department     TEXT,
  ADD COLUMN IF NOT EXISTS position_nm    TEXT,
  ADD COLUMN IF NOT EXISTS profile_image  TEXT,
  ADD COLUMN IF NOT EXISTS status         TEXT        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS password_hash  TEXT;

-- 제약 조건 (IF NOT EXISTS 미지원 → DO 블록으로 안전하게 처리)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_provider_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_provider_check
        CHECK (provider IN ('local', 'naver', 'kakao', 'google'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_status_check
        CHECK (status IN ('active', 'pending', 'blocked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_provider_id_unique'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_provider_id_unique
        UNIQUE (provider, provider_id);
  END IF;
END $$;

-- 사번은 중복 불가
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id
  ON public.users (employee_id)
  WHERE employee_id IS NOT NULL;

COMMENT ON COLUMN public.users.provider      IS '가입 유형: local(사번)/naver/kakao/google';
COMMENT ON COLUMN public.users.provider_id   IS '소셜 provider 고유 ID';
COMMENT ON COLUMN public.users.employee_id   IS '사번 (local 가입자 전용)';
COMMENT ON COLUMN public.users.name          IS '실제 이름';
COMMENT ON COLUMN public.users.department    IS '부서';
COMMENT ON COLUMN public.users.position_nm   IS '직급';
COMMENT ON COLUMN public.users.profile_image IS '소셜 프로필 이미지 URL';
COMMENT ON COLUMN public.users.status        IS 'active/pending(승인대기)/blocked';
COMMENT ON COLUMN public.users.password_hash IS 'bcrypt 해시 (local 가입자 전용)';

-- ----------------------------------------------------------------
-- Step 2. 소셜 로그인용 함수: uf_upsert_social_user
--   provider + provider_id 로 기존 사용자 조회
--   없으면 INSERT, 있으면 기존 row 반환
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uf_upsert_social_user(
  p_provider      TEXT,
  p_provider_id   TEXT,
  p_email         TEXT,
  p_name          TEXT,
  p_profile_image TEXT DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users;
BEGIN
  -- 기존 소셜 사용자 조회
  SELECT * INTO v_user
    FROM public.users
   WHERE provider = p_provider AND provider_id = p_provider_id
   LIMIT 1;

  IF FOUND THEN
    -- ✅ 기존 사용자: 이름/프로필이미지를 최신 정보로 업데이트
    UPDATE public.users
       SET name          = COALESCE(NULLIF(p_name, ''), name),
           profile_image = COALESCE(NULLIF(p_profile_image, ''), profile_image),
           email         = COALESCE(NULLIF(p_email, ''), email),
           updated_at    = NOW()
     WHERE id = v_user.id
    RETURNING * INTO v_user;

    RETURN NEXT v_user;
    RETURN;
  END IF;

  -- 신규 가입: auth.users 없이 직접 삽입 (UUID 자동 생성)
  INSERT INTO public.users (
    id, email, username, provider, provider_id,
    name, profile_image, status, is_active
  )
  VALUES (
    gen_random_uuid(),
    p_email,
    COALESCE(NULLIF(p_name, ''), split_part(p_email, '@', 1)),
    p_provider,
    p_provider_id,
    p_name,
    p_profile_image,
    'active',
    true
  )
  ON CONFLICT (email) DO UPDATE
    SET provider_id    = EXCLUDED.provider_id,
        provider       = EXCLUDED.provider,
        name           = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
        profile_image  = COALESCE(NULLIF(EXCLUDED.profile_image, ''), public.users.profile_image),
        updated_at     = NOW()
  RETURNING * INTO v_user;

  RETURN NEXT v_user;
END;
$$;

COMMENT ON FUNCTION public.uf_upsert_social_user IS
  '소셜 로그인: provider+provider_id 로 사용자 조회 또는 자동 생성';

-- ----------------------------------------------------------------
-- Step 3. 사번 가입 함수: uf_register_employee
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uf_register_employee(
  p_employee_id TEXT,
  p_name        TEXT,
  p_email       TEXT,
  p_department  TEXT,
  p_position    TEXT,
  p_password    TEXT   -- bcrypt 해시 (백엔드에서 hash 후 전달)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  -- 이메일 중복 체크
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RETURN json_build_object('ok', false, 'message', '이미 사용 중인 이메일입니다.');
  END IF;

  -- 사번 중복 체크
  IF EXISTS (SELECT 1 FROM public.users WHERE employee_id = p_employee_id) THEN
    RETURN json_build_object('ok', false, 'message', '이미 등록된 사번입니다.');
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO public.users (
    id, email, username, provider, employee_id,
    name, department, position_nm, password_hash,
    status, is_active
  )
  VALUES (
    v_new_id, p_email,
    split_part(p_email, '@', 1),
    'local',
    p_employee_id, p_name,
    p_department, p_position, p_password,
    'pending',   -- 관리자 승인 대기
    false
  );

  RETURN json_build_object('ok', true, 'id', v_new_id, 'status', 'pending');
END;
$$;

COMMENT ON FUNCTION public.uf_register_employee IS
  '사번 가입: 이메일/사번 중복 검사 후 pending 상태로 등록';

-- ----------------------------------------------------------------
-- Step 4. 인덱스 추가
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_provider        ON public.users (provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_id     ON public.users (provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_status          ON public.users (status);
