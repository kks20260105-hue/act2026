-- ================================================================
-- Supabase DB: free2026db
-- 파일: users_auth_setup.sql
-- 설명: public.users 확장 (password_hash), 샘플 데이터, CRUD 프로시저/함수
-- 규칙: 프로시저(DML) → up_ / 함수(SELECT) → uf_
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣기 후 RUN
-- ================================================================

-- pgcrypto 확장 (password 해싱)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------
-- 1. public.users 에 password_hash 컬럼 추가
--    암호화: crypt(평문, gen_salt('bf', 10))  → bcrypt 10 rounds
-- ----------------------------------------------------------------
alter table public.users
  add column if not exists password_hash text;

alter table public.users
  add column if not exists display_name text;

comment on column public.users.password_hash is '비밀번호 해시 (bcrypt, pgcrypto)';
comment on column public.users.display_name  is '화면 표시 이름';

-- ----------------------------------------------------------------
-- 2. 암호화 유틸 함수
--    uf_hash_password(plain) → bcrypt 해시 반환
--    uf_verify_password(plain, hash) → boolean
-- ----------------------------------------------------------------
create or replace function public.uf_hash_password(p_plain text)
returns text
language sql
security definer
as $$
  select crypt(p_plain, gen_salt('bf', 10));
$$;

comment on function public.uf_hash_password is '평문 비밀번호 → bcrypt 해시 반환';

create or replace function public.uf_verify_password(p_plain text, p_hash text)
returns boolean
language sql
security definer
as $$
  select (p_hash = crypt(p_plain, p_hash));
$$;

comment on function public.uf_verify_password is '비밀번호 검증 (평문 vs 해시)';

-- ----------------------------------------------------------------
-- 3. 샘플 사용자 데이터
--    ※ auth.users 없이 public.users 직접 삽입 (테스트 전용)
--    기본 비밀번호: Portal@1234
-- ----------------------------------------------------------------
do $$
declare
  v_hash text := public.uf_hash_password('Portal@1234');
begin
  insert into public.users (id, email, username, display_name, password_hash, is_active)
  values
    (gen_random_uuid(), 'admin@portal.com',   'admin',   '관리자',      v_hash, true),
    (gen_random_uuid(), 'user1@portal.com',   'user1',   '홍길동',      v_hash, true),
    (gen_random_uuid(), 'user2@portal.com',   'user2',   '김철수',      v_hash, true),
    (gen_random_uuid(), 'user3@portal.com',   'user3',   '이영희',      v_hash, true),
    (gen_random_uuid(), 'test@portal.com',    'tester',  '테스트계정',  v_hash, false)
  on conflict (email) do update
    set password_hash = excluded.password_hash,
        display_name  = excluded.display_name,
        updated_at    = timezone('utc', now());

  raise notice '[샘플] users 5건 입력 완료 (기본 비밀번호: Portal@1234)';
end;
$$;

-- ================================================================
-- CRUD 함수 (uf_) / 프로시저 (up_)
-- ================================================================

-- ----------------------------------------------------------------
-- [READ] uf_get_users() → 전체 사용자 목록
-- ----------------------------------------------------------------
create or replace function public.uf_get_users()
returns table (
  id           uuid,
  email        text,
  username     text,
  display_name text,
  is_active    boolean,
  created_at   timestamptz,
  updated_at   timestamptz
)
language sql
security definer
as $$
  select id, email, username, display_name, is_active, created_at, updated_at
  from public.users
  order by created_at desc;
$$;

comment on function public.uf_get_users is '[READ] 전체 사용자 목록 조회';

-- ----------------------------------------------------------------
-- [READ] uf_get_user(p_id) → 단일 사용자 조회 (UUID)
-- ----------------------------------------------------------------
create or replace function public.uf_get_user(p_id uuid)
returns table (
  id           uuid,
  email        text,
  username     text,
  display_name text,
  is_active    boolean,
  created_at   timestamptz,
  updated_at   timestamptz
)
language sql
security definer
as $$
  select id, email, username, display_name, is_active, created_at, updated_at
  from public.users
  where id = p_id;
$$;

comment on function public.uf_get_user is '[READ] UUID로 단일 사용자 조회';

-- ----------------------------------------------------------------
-- [READ] uf_get_user_by_email(p_email) → 이메일로 사용자 조회
-- ----------------------------------------------------------------
create or replace function public.uf_get_user_by_email(p_email text)
returns table (
  id           uuid,
  email        text,
  username     text,
  display_name text,
  password_hash text,
  is_active    boolean,
  created_at   timestamptz,
  updated_at   timestamptz
)
language sql
security definer
as $$
  select id, email, username, display_name, password_hash, is_active, created_at, updated_at
  from public.users
  where lower(email) = lower(p_email);
$$;

comment on function public.uf_get_user_by_email is '[READ] 이메일로 사용자 조회 (password_hash 포함)';

-- ----------------------------------------------------------------
-- [AUTH] uf_login(p_email, p_password) → 로그인 검증
--   반환: id, email, username, display_name (비밀번호 불일치 시 0 rows)
-- ----------------------------------------------------------------
create or replace function public.uf_login(p_email text, p_password text)
returns table (
  id           uuid,
  email        text,
  username     text,
  display_name text,
  is_active    boolean
)
language plpgsql
security definer
as $$
begin
  return query
  select u.id, u.email, u.username, u.display_name, u.is_active
  from public.users u
  where lower(u.email) = lower(p_email)
    and u.is_active = true
    and public.uf_verify_password(p_password, u.password_hash);
end;
$$;

comment on function public.uf_login is '[AUTH] 이메일+비밀번호 검증 → 사용자 정보 반환 (불일치 시 0 rows)';

-- ----------------------------------------------------------------
-- [CREATE] up_insert_user(email, username, display_name, password, is_active)
-- ----------------------------------------------------------------
create or replace procedure public.up_insert_user(
  p_email        text,
  p_username     text,
  p_display_name text,
  p_password     text,
  p_is_active    boolean default true
)
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, username, display_name, password_hash, is_active)
  values (
    gen_random_uuid(),
    lower(p_email),
    p_username,
    p_display_name,
    public.uf_hash_password(p_password),
    p_is_active
  );
end;
$$;

comment on procedure public.up_insert_user is '[CREATE] 신규 사용자 등록';

-- ----------------------------------------------------------------
-- [UPDATE] up_update_user(p_id, p_username, p_display_name, p_is_active)
-- ----------------------------------------------------------------
create or replace procedure public.up_update_user(
  p_id           uuid,
  p_username     text     default null,
  p_display_name text     default null,
  p_is_active    boolean  default null
)
language plpgsql
security definer
as $$
begin
  update public.users
  set
    username     = coalesce(p_username,     username),
    display_name = coalesce(p_display_name, display_name),
    is_active    = coalesce(p_is_active,    is_active),
    updated_at   = timezone('utc', now())
  where id = p_id;

  if not found then
    raise exception '사용자를 찾을 수 없습니다. id=%', p_id;
  end if;
end;
$$;

comment on procedure public.up_update_user is '[UPDATE] 사용자 정보 수정';

-- ----------------------------------------------------------------
-- [UPDATE] up_update_password(p_id, p_new_password)
-- ----------------------------------------------------------------
create or replace procedure public.up_update_password(
  p_id           uuid,
  p_new_password text
)
language plpgsql
security definer
as $$
begin
  update public.users
  set
    password_hash = public.uf_hash_password(p_new_password),
    updated_at    = timezone('utc', now())
  where id = p_id;

  if not found then
    raise exception '사용자를 찾을 수 없습니다. id=%', p_id;
  end if;
end;
$$;

comment on procedure public.up_update_password is '[UPDATE] 비밀번호 변경 (bcrypt 재해싱)';

-- ----------------------------------------------------------------
-- [DELETE] up_delete_user(p_id)  → 물리 삭제
-- ----------------------------------------------------------------
create or replace procedure public.up_delete_user(p_id uuid)
language plpgsql
security definer
as $$
begin
  delete from public.users where id = p_id;

  if not found then
    raise exception '사용자를 찾을 수 없습니다. id=%', p_id;
  end if;
end;
$$;

comment on procedure public.up_delete_user is '[DELETE] 사용자 물리 삭제';

-- ----------------------------------------------------------------
-- [DELETE] up_deactivate_user(p_id)  → 논리 삭제 (is_active=false)
-- ----------------------------------------------------------------
create or replace procedure public.up_deactivate_user(p_id uuid)
language plpgsql
security definer
as $$
begin
  update public.users
  set is_active  = false,
      updated_at = timezone('utc', now())
  where id = p_id;

  if not found then
    raise exception '사용자를 찾을 수 없습니다. id=%', p_id;
  end if;
end;
$$;

comment on procedure public.up_deactivate_user is '[DELETE-논리] 사용자 비활성화';

-- ----------------------------------------------------------------
-- [LOG] up_insert_login_log(p_user_id, p_ip, p_agent, p_success)
-- ----------------------------------------------------------------
create or replace procedure public.up_insert_login_log(
  p_user_id  uuid,
  p_ip       text    default null,
  p_agent    text    default null,
  p_success  boolean default true
)
language plpgsql
security definer
as $$
begin
  insert into public.user_login_logs (user_id, ip_address, user_agent, is_success)
  values (p_user_id, p_ip, p_agent, p_success);
end;
$$;

comment on procedure public.up_insert_login_log is '[LOG] 로그인 이력 기록';

-- ----------------------------------------------------------------
-- RLS: uf_ 함수는 service_role 에서 호출하므로 정책 확인
-- public.users insert 정책 (password_hash 포함 직접 삽입 허용)
-- ----------------------------------------------------------------
drop policy if exists "users_insert_service" on public.users;
create policy "users_insert_service"
  on public.users for insert
  with check (true);

-- ----------------------------------------------------------------
-- 완료
-- ----------------------------------------------------------------
do $$
begin
  raise notice '[users_auth_setup] 완료';
  raise notice '  - pgcrypto 확장, password_hash 컬럼, 샘플 5건';
  raise notice '  - uf_hash_password, uf_verify_password, uf_login';
  raise notice '  - uf_get_users, uf_get_user, uf_get_user_by_email';
  raise notice '  - up_insert_user, up_update_user, up_update_password';
  raise notice '  - up_delete_user, up_deactivate_user, up_insert_login_log';
  raise notice '  기본 비밀번호: Portal@1234';
end;
$$;
