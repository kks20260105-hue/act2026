-- delete_revoked_user_roles.sql
-- 삭제 처리된(tb_user_role.use_yn = 'N') 레코드를 완전 삭제합니다.
-- 주의: 실행 전 반드시 백업하세요.

BEGIN;

-- 모든 회수된(Role 회수되어 use_yn='N'인) 레코드 삭제
DELETE FROM public.tb_user_role
WHERE use_yn = 'N';

COMMIT;

-- 특정 사용자에 대해 삭제하려면 아래를 사용하세요:
-- DELETE FROM public.tb_user_role WHERE user_id = '<USER_ID>' AND use_yn = 'N';

-- 특정 사용자·역할 조합만 삭제하려면:
-- DELETE FROM public.tb_user_role WHERE user_id = '<USER_ID>' AND role_id = '<ROLE_ID>' AND use_yn = 'N';
