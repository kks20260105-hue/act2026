-- ================================================================
-- Verify: display_name 반영 점검 쿼리
-- 사용법: 20260318_social_auth_migration.sql 실행 후 순서대로 확인
-- ================================================================

-- 1) 누락 건수 확인 (0 이면 정상)
SELECT COUNT(*) AS missing_display_name_count
FROM public.users
WHERE display_name IS NULL OR btrim(display_name) = '';

-- 2) provider별 누락 현황
SELECT
  provider,
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE display_name IS NULL OR btrim(display_name) = '') AS missing_display_name
FROM public.users
GROUP BY provider
ORDER BY provider;

-- 3) 최근 사용자 샘플 확인
SELECT
  id,
  provider,
  email,
  username,
  name,
  display_name,
  updated_at
FROM public.users
ORDER BY updated_at DESC NULLS LAST
LIMIT 30;

-- 4) name은 있는데 display_name이 다른/비어있는 케이스 점검
SELECT
  id,
  provider,
  email,
  name,
  display_name,
  updated_at
FROM public.users
WHERE NULLIF(name, '') IS NOT NULL
  AND (display_name IS NULL OR btrim(display_name) = '' OR display_name <> name)
ORDER BY updated_at DESC NULLS LAST
LIMIT 50;

-- 5) 네이버 사용자 점검 (원하면 provider 값 변경해 재사용)
SELECT
  id,
  provider,
  provider_id,
  email,
  name,
  display_name,
  profile_image,
  updated_at
FROM public.users
WHERE provider = 'naver'
ORDER BY updated_at DESC NULLS LAST
LIMIT 50;
