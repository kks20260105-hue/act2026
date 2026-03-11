-- ================================================================
-- Supabase DB: free2026db
-- 설명: 포털 서비스 초기 DB 스키마
-- 규칙: DB명, 테이블명, 컬럼명 모두 소문자 (snake_case)
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣기 후 RUN
-- ================================================================

-- ----------------------------------------------------------------
-- 1. users 테이블 (auth.users와 연동)
-- ----------------------------------------------------------------
create table if not exists public.users (
  id          uuid        references auth.users(id) on delete cascade not null primary key,
  email       text        unique not null,
  username    text        unique not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

comment on table  public.users              is '포털 서비스 사용자 프로필';
comment on column public.users.id          is 'auth.users FK (UUID)';
comment on column public.users.email       is '이메일 (고유)';
comment on column public.users.username    is '사용자명 (고유)';
comment on column public.users.is_active   is '계정 활성 여부';
comment on column public.users.created_at  is '생성일시 (UTC)';
comment on column public.users.updated_at  is '수정일시 (UTC)';

-- ----------------------------------------------------------------
-- 2. user_login_logs 테이블 (로그인 이력)
-- ----------------------------------------------------------------
create table if not exists public.user_login_logs (
  id          bigserial   primary key,
  user_id     uuid        references public.users(id) on delete cascade not null,
  login_at    timestamptz not null default timezone('utc', now()),
  ip_address  text,
  user_agent  text,
  is_success  boolean     not null default true
);

comment on table  public.user_login_logs             is '사용자 로그인 이력';
comment on column public.user_login_logs.user_id    is '사용자 UUID (FK)';
comment on column public.user_login_logs.login_at   is '로그인 시도 일시 (UTC)';
comment on column public.user_login_logs.ip_address is '접속 IP';
comment on column public.user_login_logs.user_agent is '브라우저 정보';
comment on column public.user_login_logs.is_success is '로그인 성공 여부';

-- ----------------------------------------------------------------
-- 3. user_sessions 테이블 (세션 관리)
-- ----------------------------------------------------------------
create table if not exists public.user_sessions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references public.users(id) on delete cascade not null,
  token_hash  text        not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default timezone('utc', now()),
  is_revoked  boolean     not null default false
);

comment on table  public.user_sessions              is '사용자 세션 관리';
comment on column public.user_sessions.user_id     is '사용자 UUID (FK)';
comment on column public.user_sessions.token_hash  is '액세스 토큰 해시';
comment on column public.user_sessions.expires_at  is '만료 일시 (UTC)';
comment on column public.user_sessions.is_revoked  is '토큰 폐기 여부';

-- ----------------------------------------------------------------
-- 4. RLS (Row Level Security) 활성화
-- ----------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.user_login_logs  enable row level security;
alter table public.user_sessions    enable row level security;

-- ----------------------------------------------------------------
-- 5. RLS 정책 설정 (users 테이블)
-- ----------------------------------------------------------------
-- 본인의 프로필만 조회 가능
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

-- 본인의 프로필만 수정 가능
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 삽입은 트리거를 통해 처리 (서비스키 사용)
create policy "users_insert_service"
  on public.users for insert
  with check (true);

-- ----------------------------------------------------------------
-- 6. RLS 정책 설정 (user_login_logs 테이블)
-- ----------------------------------------------------------------
create policy "login_logs_select_own"
  on public.user_login_logs for select
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 7. updated_at 자동 업데이트 트리거
-- ----------------------------------------------------------------
create or replace function public.fn_update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.fn_update_updated_at();

-- ----------------------------------------------------------------
-- 8. auth.users 신규 가입 시 users 테이블 자동 생성 트리거
-- ----------------------------------------------------------------
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ----------------------------------------------------------------
-- 9. 인덱스 생성
-- ----------------------------------------------------------------
create index if not exists idx_users_email              on public.users(email);
create index if not exists idx_users_username           on public.users(username);
create index if not exists idx_login_logs_user_id       on public.user_login_logs(user_id);
create index if not exists idx_login_logs_login_at      on public.user_login_logs(login_at desc);
create index if not exists idx_sessions_user_id         on public.user_sessions(user_id);
create index if not exists idx_sessions_expires_at      on public.user_sessions(expires_at);

-- ----------------------------------------------------------------
-- 완료 메시지
-- ----------------------------------------------------------------
do $$
begin
  raise notice '[free2026db] 스키마 초기화 완료';
end;
$$;
