-- ================================================================
-- Supabase DB: KKS 엔터프라이즈 포털
-- 파일명: portal_menu_role_schema.sql
-- 설명: GNB/LNB 메뉴 + Role 권한 관리 시스템 전체 스키마
-- 실행: Supabase Dashboard → SQL Editor에 붙여넣기 → Run
-- 순서: 이 파일은 init.sql(users 테이블) 실행 후 실행
-- ================================================================

-- ================================================================
-- 1. tb_role (Role 마스터)
-- ================================================================
create table if not exists public.tb_role (
  role_id     uuid          primary key default gen_random_uuid(),
  role_cd     text          unique not null,            -- 'SUPER_ADMIN', 'ADMIN', 'USER'
  role_nm     text          not null,                   -- '슈퍼관리자'
  role_desc   text,
  role_color  text,                                     -- HEX 컬러 '#E74C3C'
  sort_order  integer       not null default 99,
  use_yn      char(1)       not null default 'Y',       -- Y/N
  is_system   boolean       not null default false,     -- 시스템 기본 Role (삭제 불가)
  created_at  timestamptz   not null default timezone('utc', now()),
  updated_at  timestamptz
);

comment on table  public.tb_role            is 'Role(권한그룹) 마스터';
comment on column public.tb_role.role_id    is 'Role UUID PK';
comment on column public.tb_role.role_cd    is 'Role 코드 (UPPER_SNAKE_CASE, 유니크)';
comment on column public.tb_role.role_nm    is 'Role 표시명';
comment on column public.tb_role.role_color is 'UI 배지 HEX 컬러';
comment on column public.tb_role.is_system  is '시스템 기본 Role (true이면 삭제 불가)';

-- 시스템 기본 Role 삽입
insert into public.tb_role (role_cd, role_nm, role_desc, role_color, sort_order, use_yn, is_system)
values
  ('SUPER_ADMIN', '슈퍼관리자', '시스템 전체 관리 권한',   '#E74C3C', 1,  'Y', true),
  ('ADMIN',       '관리자',     '운영 관리 권한',           '#E67E22', 2,  'Y', true),
  ('MANAGER',     '매니저',     '부서 관리 권한',           '#2980B9', 3,  'Y', false),
  ('USER',        '일반사용자', '기본 사용 권한',           '#27AE60', 99, 'Y', true)
on conflict (role_cd) do nothing;

-- ================================================================
-- 2. tb_user_role (사용자-Role 매핑)
-- ================================================================
create table if not exists public.tb_user_role (
  user_role_id  uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.users(id) on delete cascade,
  role_id       uuid        not null references public.tb_role(role_id) on delete cascade,
  start_dt      date        not null default current_date,
  end_dt        date,                                   -- null = 무기한
  use_yn        char(1)     not null default 'Y',
  granted_by    uuid        references public.users(id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz,
  constraint uq_user_role unique (user_id, role_id, use_yn)
);

create index idx_tb_user_role_user_id  on public.tb_user_role(user_id);
create index idx_tb_user_role_role_id  on public.tb_user_role(role_id);
create index idx_tb_user_role_end_dt   on public.tb_user_role(end_dt);

comment on table  public.tb_user_role            is '사용자-Role 매핑';
comment on column public.tb_user_role.end_dt     is 'null=무기한, 날짜=만료일';
comment on column public.tb_user_role.granted_by is 'Role 부여자 user_id';

-- ================================================================
-- 3. tb_menu (GNB/LNB 메뉴 마스터)
-- ================================================================
create table if not exists public.tb_menu (
  menu_id         uuid        primary key default gen_random_uuid(),
  menu_nm         text        not null,
  menu_url        text        unique not null,
  parent_menu_id  uuid        references public.tb_menu(menu_id) on delete set null,
  menu_depth      smallint    not null check (menu_depth >= 1),  -- 1=GNB, 2=LNB, 3+=하위 (무제한 depth)
  menu_order      integer     not null default 1,
  icon_class      text,
  use_yn          char(1)     not null default 'Y',
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz
);

create index idx_tb_menu_parent    on public.tb_menu(parent_menu_id);
create index idx_tb_menu_depth     on public.tb_menu(menu_depth, use_yn, menu_order);

comment on table  public.tb_menu               is 'GNB/LNB 메뉴 마스터';
comment on column public.tb_menu.menu_url      is '메뉴 URL 경로 (유니크, / 시작)';
comment on column public.tb_menu.menu_depth    is '1=GNB(상단), 2=LNB(사이드), 3+=하위메뉴 (무제한 depth)';
comment on column public.tb_menu.parent_menu_id is 'GNB의 menu_id (depth=2일 때 필수)';

-- 기본 메뉴 삽입
insert into public.tb_menu (menu_nm, menu_url, menu_depth, menu_order, icon_class, use_yn)
values
  ('홈',   '/',      1, 1, 'home',      'Y'),
  ('업무', '/work',  1, 2, 'briefcase', 'Y'),
  ('관리', '/admin', 1, 9, 'setting',   'Y')
on conflict (menu_url) do nothing;

-- ================================================================
-- 4. tb_menu_role (메뉴-Role 매핑)
-- ================================================================
create table if not exists public.tb_menu_role (
  id          uuid      primary key default gen_random_uuid(),
  menu_id     uuid      not null references public.tb_menu(menu_id) on delete cascade,
  role_id     uuid      not null references public.tb_role(role_id) on delete cascade,
  read_yn     char(1)   not null default 'Y',
  write_yn    char(1)   not null default 'N',
  created_at  timestamptz not null default timezone('utc', now()),
  constraint uq_menu_role unique (menu_id, role_id)
);

create index idx_tb_menu_role_menu_id on public.tb_menu_role(menu_id);
create index idx_tb_menu_role_role_id on public.tb_menu_role(role_id);

comment on table  public.tb_menu_role           is '메뉴-Role 접근 권한 매핑';
comment on column public.tb_menu_role.read_yn   is '읽기 권한';
comment on column public.tb_menu_role.write_yn  is '쓰기 권한';

-- ================================================================
-- 5. tb_menu_upload_log (메뉴 엑셀 업로드 이력)
-- ================================================================
create table if not exists public.tb_menu_upload_log (
  log_id          uuid        primary key default gen_random_uuid(),
  file_nm         text        not null,
  upload_type     text        not null default 'MENU',
  total_cnt       integer     not null default 0,
  success_cnt     integer     not null default 0,
  fail_cnt        integer     not null default 0,
  skip_cnt        integer     not null default 0,
  status          text        not null default 'FAIL'
    check (status in ('SUCCESS', 'FAIL', 'PARTIAL')),
  upload_user_id  uuid        references public.users(id) on delete set null,
  created_at      timestamptz not null default timezone('utc', now())
);

create index idx_tb_menu_upload_log_user   on public.tb_menu_upload_log(upload_user_id);
create index idx_tb_menu_upload_log_status on public.tb_menu_upload_log(status, created_at desc);

comment on table  public.tb_menu_upload_log   is '메뉴 엑셀 업로드 이력';
comment on column public.tb_menu_upload_log.status is 'SUCCESS/FAIL/PARTIAL';

-- ================================================================
-- 6. tb_menu_upload_error (업로드 오류 상세)
-- ================================================================
create table if not exists public.tb_menu_upload_error (
  error_id    uuid        primary key default gen_random_uuid(),
  log_id      uuid        not null references public.tb_menu_upload_log(log_id) on delete cascade,
  row_no      integer     not null,
  column_nm   text,
  error_cd    text,
  error_msg   text        not null,
  raw_data    jsonb       not null default '{}',
  created_at  timestamptz not null default timezone('utc', now())
);

create index idx_tb_menu_upload_error_log on public.tb_menu_upload_error(log_id);

comment on table  public.tb_menu_upload_error           is '업로드 오류 행 상세';
comment on column public.tb_menu_upload_error.row_no    is '엑셀 행 번호 (헤더=1, 데이터 2행부터)';
comment on column public.tb_menu_upload_error.raw_data  is '오류 원본 행 JSON';

-- ================================================================
-- 7. tb_permission_log (사용자 Role 변경 감사 이력)
-- ================================================================
create table if not exists public.tb_permission_log (
  log_id          uuid        primary key default gen_random_uuid(),
  target_user_id  uuid        not null references public.users(id) on delete cascade,
  action_type     text        not null check (action_type in ('GRANT', 'REVOKE', 'EXPIRE')),
  role_id         uuid        references public.tb_role(role_id) on delete set null,
  role_cd_snap    text        not null,   -- 삭제된 Role도 이력 보존
  before_state    jsonb,
  after_state     jsonb,
  acted_by        uuid        references public.users(id) on delete set null,
  remark          text,
  created_at      timestamptz not null default timezone('utc', now())
);

create index idx_tb_permission_log_target on public.tb_permission_log(target_user_id, created_at desc);
create index idx_tb_permission_log_actor  on public.tb_permission_log(acted_by);

comment on table  public.tb_permission_log              is 'Role 부여/회수 감사 이력';
comment on column public.tb_permission_log.action_type  is 'GRANT=부여, REVOKE=회수, EXPIRE=만료';
comment on column public.tb_permission_log.role_cd_snap is '이력 시점의 role_cd 스냅샷';

-- ================================================================
-- 8. RLS (Row Level Security) 설정
-- ================================================================
alter table public.tb_role              enable row level security;
alter table public.tb_user_role         enable row level security;
alter table public.tb_menu              enable row level security;
alter table public.tb_menu_role         enable row level security;
alter table public.tb_menu_upload_log   enable row level security;
alter table public.tb_menu_upload_error enable row level security;
alter table public.tb_permission_log    enable row level security;

-- tb_menu: 공개 읽기 (use_yn=Y)
create policy "menu_public_read"
  on public.tb_menu for select
  using (use_yn = 'Y');

-- tb_role: 로그인 유저 읽기
create policy "role_authenticated_read"
  on public.tb_role for select
  to authenticated
  using (use_yn = 'Y');

-- tb_user_role: 본인 Role만 조회
create policy "user_role_self_read"
  on public.tb_user_role for select
  to authenticated
  using (user_id = auth.uid());

-- tb_menu_role: 로그인 유저 읽기
create policy "menu_role_authenticated_read"
  on public.tb_menu_role for select
  to authenticated
  using (true);

-- 나머지 Write 권한: service_role 키만 허용 (API 서버 전용)
-- SUPER_ADMIN 쓰기는 service_role 키로만 처리

-- ================================================================
-- 9. Trigger: tb_role updated_at 자동 갱신
-- ================================================================
create or replace function public.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger tg_tb_role_updated_at
  before update on public.tb_role
  for each row execute function public.fn_set_updated_at();

create trigger tg_tb_menu_updated_at
  before update on public.tb_menu
  for each row execute function public.fn_set_updated_at();

create trigger tg_tb_user_role_updated_at
  before update on public.tb_user_role
  for each row execute function public.fn_set_updated_at();

-- ================================================================
-- 10. PostgreSQL Function: Role 기반 원자적 메뉴 일괄 UPSERT (ALL_OR_NOTHING)
-- ================================================================
create or replace function public.fn_bulk_upsert_menus(rows_json text)
returns void language plpgsql security definer as $$
declare
  v_row json;
  v_menu_id uuid;
  v_role_cd text;
  v_role_id uuid;
  v_allow_roles text[];
begin
  for v_row in select * from json_array_elements(rows_json::json)
  loop
    -- 메뉴 UPSERT
    insert into public.tb_menu (
      menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn
    )
    values (
      v_row->>'menu_nm',
      v_row->>'menu_url',
      case when (v_row->>'parent_menu_id') = '' then null
           else (v_row->>'parent_menu_id')::uuid end,
      (v_row->>'menu_depth')::smallint,
      (v_row->>'menu_order')::integer,
      nullif(v_row->>'icon_class', ''),
      coalesce(v_row->>'use_yn', 'Y')
    )
    on conflict (menu_url) do update set
      menu_nm        = excluded.menu_nm,
      parent_menu_id = excluded.parent_menu_id,
      menu_depth     = excluded.menu_depth,
      menu_order     = excluded.menu_order,
      icon_class     = excluded.icon_class,
      use_yn         = excluded.use_yn,
      updated_at     = timezone('utc', now())
    returning menu_id into v_menu_id;

    -- allow_roles 처리 (콤마 구분 문자열 → 배열)
    v_allow_roles := string_to_array(v_row->>'allow_roles', ',');

    foreach v_role_cd in array v_allow_roles
    loop
      v_role_cd := trim(v_role_cd);
      if v_role_cd = '' then continue; end if;

      select role_id into v_role_id
        from public.tb_role
       where role_cd = v_role_cd and use_yn = 'Y';

      if v_role_id is not null then
        insert into public.tb_menu_role (menu_id, role_id, read_yn, write_yn)
        values (v_menu_id, v_role_id, 'Y', 'N')
        on conflict (menu_id, role_id) do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

comment on function public.fn_bulk_upsert_menus is
  '메뉴 일괄 UPSERT - ALL_OR_NOTHING 업로드 모드. 트랜잭션 내에서 실행됨.';

-- ================================================================
-- 완료 메시지
-- ================================================================
do $$ begin
  raise notice '✅ portal_menu_role_schema.sql 실행 완료';
  raise notice '   - tb_role          : Role 마스터 (기본 4개 삽입)';
  raise notice '   - tb_user_role     : 사용자-Role 매핑';
  raise notice '   - tb_menu          : GNB/LNB 메뉴 마스터 (기본 3개 삽입)';
  raise notice '   - tb_menu_role     : 메뉴-Role 권한 매핑';
  raise notice '   - tb_menu_upload_log   : 업로드 이력';
  raise notice '   - tb_menu_upload_error : 업로드 오류 상세';
  raise notice '   - tb_permission_log    : Role 변경 감사 이력';
end $$;
