-- ============================================================
-- 마이그레이션: tb_menu.menu_depth CHECK 제약 확장
-- 기존: check (menu_depth in (1, 2))  → GNB/LNB 2단계만 허용
-- 변경: check (menu_depth >= 1)       → 무제한 depth 허용
-- 실행 환경: Supabase SQL Editor
-- ============================================================

-- 1. 기존 제약 제거
ALTER TABLE public.tb_menu
  DROP CONSTRAINT IF EXISTS tb_menu_menu_depth_check;

-- 2. 새 제약 추가 (depth 1 이상, 상한 없음)
ALTER TABLE public.tb_menu
  ADD CONSTRAINT tb_menu_menu_depth_check
  CHECK (menu_depth >= 1);

-- 3. 컬럼 코멘트 업데이트
COMMENT ON COLUMN public.tb_menu.menu_depth
  IS '1=GNB(상단), 2=LNB(사이드), 3+=하위메뉴 (무제한 depth)';
