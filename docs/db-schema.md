# Supabase PostgreSQL DB 스키마 설계서

> **프로젝트명**: KKS 엔터프라이즈 포털  
> **버전**: v1.0  
> **DB**: Supabase (PostgreSQL 15+) / 100만 유저 대용량 기준

---

## 목차

| # | 테이블명 | 용도 |
|---|----------|------|
| 1 | `public.profiles` | Supabase auth.users 확장 프로필 |
| 2 | `public.tb_role` | Role 마스터 |
| 3 | `public.tb_menu` | 메뉴 마스터 (GNB/LNB 통합) |
| 4 | `public.tb_menu_role` | 메뉴-Role 권한 매핑 |
| 5 | `public.tb_user_role` | 사용자-Role 매핑 |
| 6 | `public.tb_menu_upload_log` | 엑셀 업로드 이력 |
| 7 | `public.tb_menu_upload_error` | 업로드 오류 상세 |
| 8 | `public.tb_permission_log` | 권한 변경 감사 로그 |
| 9 | Trigger | updated_at 자동 갱신 |
| 10 | ERD | 전체 관계도 (텍스트) |
| 11 | 적용 가이드 | Supabase SQL Editor 실행 순서 |
| 12 | 인덱스 전략 | 100만 유저 대응 인덱스 해설 |

---

## 1. public.profiles

### 테이블 용도 및 관계

Supabase `auth.users` 테이블(Supabase 내부 관리)의 확장 프로필 테이블.  
`auth.users`에 행이 생성될 때 Trigger로 자동 행을 삽입하거나, 회원가입 완료 후 API에서 upsert 한다.  
`id` 는 `auth.users.id` 와 1:1 관계의 PK 이자 FK.

### DDL

```sql
CREATE TABLE public.profiles (
  id          UUID        NOT NULL,
  email       VARCHAR(255) NOT NULL,
  username    VARCHAR(100),
  avatar_url  TEXT,
  dept_nm     VARCHAR(100),
  phone       VARCHAR(30),
  use_yn      CHAR(1)     NOT NULL DEFAULT 'Y',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_email_unique UNIQUE (email),
  CONSTRAINT profiles_use_yn_check CHECK (use_yn IN ('Y', 'N'))
);

COMMENT ON TABLE  public.profiles             IS 'Supabase auth.users 확장 프로필';
COMMENT ON COLUMN public.profiles.id          IS 'auth.users.id FK (UUID)';
COMMENT ON COLUMN public.profiles.email       IS '이메일 (auth.users 동기화)';
COMMENT ON COLUMN public.profiles.username    IS '사용자 표시명';
COMMENT ON COLUMN public.profiles.avatar_url  IS '프로필 이미지 URL';
COMMENT ON COLUMN public.profiles.dept_nm     IS '부서명';
COMMENT ON COLUMN public.profiles.use_yn      IS '사용여부 Y/N';
```

### 인덱스

```sql
-- 이메일 검색 (로그인, 검색 빈번)
CREATE INDEX idx_profiles_email     ON public.profiles (email);

-- 부서별 사용자 조회
CREATE INDEX idx_profiles_dept_nm   ON public.profiles (dept_nm);

-- 사용여부 필터 (활성 사용자만 조회)
CREATE INDEX idx_profiles_use_yn    ON public.profiles (use_yn)
  WHERE use_yn = 'Y';

-- 생성일 내림차순 (최근 가입자 조회)
CREATE INDEX idx_profiles_created_at ON public.profiles (created_at DESC);
```

### RLS 정책

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필: 조회 가능
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- ADMIN/SUPER_ADMIN: 전체 조회 가능
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn = 'Y'
    )
  );

-- 본인 프로필: 수정 가능
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ADMIN: 다른 사용자 수정 가능
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn = 'Y'
    )
  );

-- INSERT: auth.users 생성 시 Trigger에서만 (service_role)
CREATE POLICY "profiles_insert_service"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### 샘플 데이터

```sql
-- ※ auth.users에 미리 사용자가 존재해야 함
-- 실제 환경에서는 auth.users의 id를 대입
INSERT INTO public.profiles (id, email, username, dept_nm, use_yn) VALUES
  ('00000000-0000-0000-0000-000000000001', 'superadmin@company.com', '슈퍼관리자', 'IT기획팀',  'Y'),
  ('00000000-0000-0000-0000-000000000002', 'admin@company.com',      '관리자',     'IT운영팀',  'Y'),
  ('00000000-0000-0000-0000-000000000003', 'manager@company.com',    '매니저',     '마케팅팀',  'Y'),
  ('00000000-0000-0000-0000-000000000004', 'user01@company.com',     '홍길동',     '개발1팀',   'Y'),
  ('00000000-0000-0000-0000-000000000005', 'user02@company.com',     '김철수',     '인사팀',    'Y');
```

---

## 2. public.tb_role

### 테이블 용도 및 관계

Role(역할) 마스터 테이블. `tb_menu_role`(메뉴-Role 매핑), `tb_user_role`(사용자-Role 매핑)에서 FK로 참조.  
`role_cd`는 코드 기반 참조를 위한 유니크 컬럼 (예: `SUPER_ADMIN`, `ADMIN`).

### DDL

```sql
CREATE TABLE public.tb_role (
  role_id    UUID        NOT NULL DEFAULT gen_random_uuid(),
  role_cd    VARCHAR(50) NOT NULL,
  role_nm    VARCHAR(100) NOT NULL,
  role_desc  TEXT,
  role_color VARCHAR(20),
  sort_order SMALLINT    NOT NULL DEFAULT 99,
  use_yn     CHAR(1)     NOT NULL DEFAULT 'Y',
  is_system  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tb_role_pkey    PRIMARY KEY (role_id),
  CONSTRAINT tb_role_cd_uq   UNIQUE (role_cd),
  CONSTRAINT tb_role_use_yn_check CHECK (use_yn IN ('Y', 'N'))
);

COMMENT ON TABLE  public.tb_role             IS 'Role 마스터';
COMMENT ON COLUMN public.tb_role.role_cd     IS 'Role 코드 (영문 대문자, 유니크)';
COMMENT ON COLUMN public.tb_role.role_nm     IS 'Role 표시명';
COMMENT ON COLUMN public.tb_role.role_color  IS '뱃지 색상 코드 (#RRGGBB)';
COMMENT ON COLUMN public.tb_role.sort_order  IS '정렬 순서';
COMMENT ON COLUMN public.tb_role.is_system   IS '시스템 기본 Role 여부 (삭제 불가)';
```

### 인덱스

```sql
-- role_cd 조회 (가장 빈번한 권한 체크 경로)
CREATE UNIQUE INDEX idx_tb_role_role_cd ON public.tb_role (role_cd);

-- 활성 Role만 조회
CREATE INDEX idx_tb_role_use_yn ON public.tb_role (use_yn)
  WHERE use_yn = 'Y';

-- 정렬 순서
CREATE INDEX idx_tb_role_sort_order ON public.tb_role (sort_order);
```

### RLS 정책

```sql
ALTER TABLE public.tb_role ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자: 전체 Role 조회 가능 (메뉴 렌더링에 필요)
CREATE POLICY "tb_role_select_auth"
  ON public.tb_role FOR SELECT
  USING (auth.role() = 'authenticated');

-- ADMIN+: 등록/수정
CREATE POLICY "tb_role_insert_admin"
  ON public.tb_role FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn = 'Y'
    )
  );

CREATE POLICY "tb_role_update_admin"
  ON public.tb_role FOR UPDATE
  USING (
    is_system = FALSE
    AND EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r2 ON ur.role_id = r2.role_id
      WHERE ur.user_id = auth.uid()
        AND r2.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn = 'Y'
    )
  );

-- SUPER_ADMIN만 삭제 가능, 시스템 Role 삭제 불가
CREATE POLICY "tb_role_delete_superadmin"
  ON public.tb_role FOR DELETE
  USING (
    is_system = FALSE
    AND EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd = 'SUPER_ADMIN'
        AND ur.use_yn = 'Y'
    )
  );
```

### 샘플 데이터

```sql
INSERT INTO public.tb_role (role_id, role_cd, role_nm, role_desc, role_color, sort_order, use_yn, is_system) VALUES
  ('10000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', '슈퍼 관리자', '시스템 전체 관리 권한',    '#DC2626', 1, 'Y', TRUE),
  ('10000000-0000-0000-0000-000000000002', 'ADMIN',       '관리자',     '메뉴·권한·사용자 관리',   '#D97706', 2, 'Y', FALSE),
  ('10000000-0000-0000-0000-000000000003', 'MANAGER',     '매니저',     '컨텐츠 관리 및 업로드',   '#059669', 3, 'Y', FALSE),
  ('10000000-0000-0000-0000-000000000004', 'USER',        '일반 사용자', '기본 포털 접근 권한',     '#2563EB', 4, 'Y', FALSE),
  ('10000000-0000-0000-0000-000000000005', 'GUEST',       '게스트',     '비로그인/제한 접근',      '#6B7280', 5, 'Y', TRUE);
```

---

## 3. public.tb_menu

### 테이블 용도 및 관계

GNB(1depth)와 LNB(2depth) 메뉴를 단일 테이블로 관리하는 계층형 메뉴 테이블.  
`parent_menu_id` Self FK로 계층 구조를 표현. `tb_menu_role`에서 FK로 참조.

### DDL

```sql
CREATE TABLE public.tb_menu (
  menu_id        UUID         NOT NULL DEFAULT gen_random_uuid(),
  menu_nm        VARCHAR(100) NOT NULL,
  menu_url       VARCHAR(255),
  parent_menu_id UUID,
  menu_depth     SMALLINT     NOT NULL DEFAULT 1,
  menu_order     SMALLINT     NOT NULL DEFAULT 99,
  icon_class     VARCHAR(100),
  target_type    VARCHAR(10)  NOT NULL DEFAULT '_self',
  use_yn         CHAR(1)      NOT NULL DEFAULT 'Y',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT tb_menu_pkey          PRIMARY KEY (menu_id),
  CONSTRAINT tb_menu_parent_fkey
    FOREIGN KEY (parent_menu_id) REFERENCES public.tb_menu(menu_id)
    ON DELETE CASCADE,
  CONSTRAINT tb_menu_depth_check   CHECK (menu_depth BETWEEN 1 AND 2),
  CONSTRAINT tb_menu_target_check  CHECK (target_type IN ('_self', '_blank')),
  CONSTRAINT tb_menu_use_yn_check  CHECK (use_yn IN ('Y', 'N'))
);

COMMENT ON TABLE  public.tb_menu                IS '메뉴 마스터 (GNB/LNB 통합)';
COMMENT ON COLUMN public.tb_menu.menu_depth     IS '메뉴 깊이: 1=GNB, 2=LNB';
COMMENT ON COLUMN public.tb_menu.parent_menu_id IS '상위 메뉴 ID (GNB이면 NULL)';
COMMENT ON COLUMN public.tb_menu.menu_order     IS '동일 depth 내 정렬 순서';
COMMENT ON COLUMN public.tb_menu.target_type    IS '링크 타겟 _self/_blank';
```

### 인덱스

```sql
-- GNB 목록 조회 (depth=1, 활성, 순서정렬)
CREATE INDEX idx_tb_menu_depth_order
  ON public.tb_menu (menu_depth, menu_order)
  WHERE use_yn = 'Y';

-- LNB 조회 (상위 메뉴 ID 기준)
CREATE INDEX idx_tb_menu_parent_id
  ON public.tb_menu (parent_menu_id, menu_order)
  WHERE use_yn = 'Y';

-- URL 중복 체크
CREATE UNIQUE INDEX idx_tb_menu_url
  ON public.tb_menu (menu_url)
  WHERE menu_url IS NOT NULL AND use_yn = 'Y';
```

### RLS 정책

```sql
ALTER TABLE public.tb_menu ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자: 자신의 Role에 매핑된 메뉴만 조회
CREATE POLICY "tb_menu_select_by_role"
  ON public.tb_menu FOR SELECT
  USING (
    use_yn = 'Y'
    AND (
      -- SUPER_ADMIN은 전체
      EXISTS (
        SELECT 1 FROM public.tb_user_role ur
        JOIN public.tb_role r ON ur.role_id = r.role_id
        WHERE ur.user_id = auth.uid()
          AND r.role_cd = 'SUPER_ADMIN'
          AND ur.use_yn = 'Y'
      )
      OR
      -- 일반 사용자: 매핑된 메뉴만
      EXISTS (
        SELECT 1 FROM public.tb_menu_role mr
        JOIN public.tb_user_role ur ON mr.role_id = ur.role_id
        WHERE mr.menu_id = tb_menu.menu_id
          AND ur.user_id = auth.uid()
          AND mr.read_yn = 'Y'
          AND ur.use_yn  = 'Y'
      )
    )
  );

-- ADMIN+: 전체 메뉴 관리 (비활성 포함)
CREATE POLICY "tb_menu_all_admin"
  ON public.tb_menu FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn  = 'Y'
    )
  );
```

### 샘플 데이터

```sql
INSERT INTO public.tb_menu (menu_id, menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn) VALUES
  ('20000000-0000-0000-0000-000000000001', '홈',      '/',             NULL,                                  1, 1, 'home',    'Y'),
  ('20000000-0000-0000-0000-000000000002', '업무',    '/work',         NULL,                                  1, 2, 'briefcase','Y'),
  ('20000000-0000-0000-0000-000000000003', '게시판',  '/board',        NULL,                                  1, 3, 'pin',     'Y'),
  ('20000000-0000-0000-0000-000000000004', '공지사항','/work/notice',  '20000000-0000-0000-0000-000000000002', 2, 1, 'bell',    'Y'),
  ('20000000-0000-0000-0000-000000000005', '관리',    '/admin',        NULL,                                  1, 4, 'settings','Y');
```

---

## 4. public.tb_menu_role

### 테이블 용도 및 관계

메뉴와 Role 간의 N:M 권한 매핑 테이블.  
`menu_id` → `tb_menu`, `role_id` → `tb_role` FK.  
`read_yn`, `write_yn`으로 조회/쓰기 권한을 분리 관리.

### DDL

```sql
CREATE TABLE public.tb_menu_role (
  map_id     UUID        NOT NULL DEFAULT gen_random_uuid(),
  menu_id    UUID        NOT NULL,
  role_id    UUID        NOT NULL,
  read_yn    CHAR(1)     NOT NULL DEFAULT 'Y',
  write_yn   CHAR(1)     NOT NULL DEFAULT 'N',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tb_menu_role_pkey     PRIMARY KEY (map_id),
  CONSTRAINT tb_menu_role_menu_fk
    FOREIGN KEY (menu_id) REFERENCES public.tb_menu(menu_id) ON DELETE CASCADE,
  CONSTRAINT tb_menu_role_role_fk
    FOREIGN KEY (role_id) REFERENCES public.tb_role(role_id) ON DELETE CASCADE,
  CONSTRAINT tb_menu_role_uq       UNIQUE (menu_id, role_id),
  CONSTRAINT tb_menu_role_read_check  CHECK (read_yn  IN ('Y', 'N')),
  CONSTRAINT tb_menu_role_write_check CHECK (write_yn IN ('Y', 'N'))
);

COMMENT ON TABLE  public.tb_menu_role          IS '메뉴-Role 권한 매핑';
COMMENT ON COLUMN public.tb_menu_role.read_yn  IS '조회 권한 Y/N';
COMMENT ON COLUMN public.tb_menu_role.write_yn IS '쓰기 권한 Y/N';
```

### 인덱스

```sql
-- 메뉴별 허용 Role 조회 (메뉴 렌더링 시 가장 빈번)
CREATE INDEX idx_tb_menu_role_menu_id
  ON public.tb_menu_role (menu_id, role_id);

-- Role별 접근 가능 메뉴 조회
CREATE INDEX idx_tb_menu_role_role_id
  ON public.tb_menu_role (role_id, menu_id)
  WHERE read_yn = 'Y';
```

### RLS 정책

```sql
ALTER TABLE public.tb_menu_role ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자: 자신의 Role 매핑 조회 가능
CREATE POLICY "tb_menu_role_select_auth"
  ON public.tb_menu_role FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      WHERE ur.role_id = tb_menu_role.role_id
        AND ur.user_id = auth.uid()
        AND ur.use_yn  = 'Y'
    )
  );

-- ADMIN+: 전체 조회
CREATE POLICY "tb_menu_role_select_admin"
  ON public.tb_menu_role FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn  = 'Y'
    )
  );

-- ADMIN+: 등록/수정/삭제
CREATE POLICY "tb_menu_role_write_admin"
  ON public.tb_menu_role FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn  = 'Y'
    )
  );
```

### 샘플 데이터

```sql
INSERT INTO public.tb_menu_role (menu_id, role_id, read_yn, write_yn) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Y', 'N'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'Y', 'N'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 'Y', 'Y'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Y', 'Y'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Y', 'Y');
```

---

## 5. public.tb_user_role

### 테이블 용도 및 관계

사용자와 Role을 N:M 매핑하는 테이블. 유효기간(`start_dt`, `end_dt`) 컬럼으로 임시 권한 부여 지원.  
`user_id` → `auth.users`, `role_id` → `tb_role` FK.

### DDL

```sql
CREATE TABLE public.tb_user_role (
  user_role_id UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL,
  role_id      UUID        NOT NULL,
  start_dt     DATE        NOT NULL DEFAULT CURRENT_DATE,
  end_dt       DATE,
  use_yn       CHAR(1)     NOT NULL DEFAULT 'Y',
  granted_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tb_user_role_pkey    PRIMARY KEY (user_role_id),
  CONSTRAINT tb_user_role_user_fk
    FOREIGN KEY (user_id)    REFERENCES auth.users(id)       ON DELETE CASCADE,
  CONSTRAINT tb_user_role_role_fk
    FOREIGN KEY (role_id)    REFERENCES public.tb_role(role_id) ON DELETE RESTRICT,
  CONSTRAINT tb_user_role_gran_fk
    FOREIGN KEY (granted_by) REFERENCES auth.users(id)       ON DELETE SET NULL,
  CONSTRAINT tb_user_role_uq      UNIQUE (user_id, role_id),
  CONSTRAINT tb_user_role_use_yn_check CHECK (use_yn IN ('Y', 'N')),
  CONSTRAINT tb_user_role_dt_check
    CHECK (end_dt IS NULL OR end_dt >= start_dt)
);

COMMENT ON TABLE  public.tb_user_role             IS '사용자-Role 매핑';
COMMENT ON COLUMN public.tb_user_role.start_dt    IS 'Role 유효 시작일';
COMMENT ON COLUMN public.tb_user_role.end_dt      IS 'Role 유효 종료일 (NULL=무기한)';
COMMENT ON COLUMN public.tb_user_role.granted_by  IS 'Role을 부여한 관리자 ID';
COMMENT ON COLUMN public.tb_user_role.use_yn      IS '사용여부 (N=회수 상태)';
```

### 인덱스

```sql
-- 사용자의 현재 활성 Role 조회 (가장 빈번한 권한 체크)
CREATE INDEX idx_tb_user_role_user_active
  ON public.tb_user_role (user_id, role_id)
  WHERE use_yn = 'Y';

-- Role별 소속 사용자 조회 (관리 화면)
CREATE INDEX idx_tb_user_role_role_id
  ON public.tb_user_role (role_id)
  WHERE use_yn = 'Y';

-- 유효기간 만료 배치 처리
CREATE INDEX idx_tb_user_role_end_dt
  ON public.tb_user_role (end_dt)
  WHERE end_dt IS NOT NULL AND use_yn = 'Y';

-- 권한 부여자 추적
CREATE INDEX idx_tb_user_role_granted_by
  ON public.tb_user_role (granted_by);
```

### RLS 정책

```sql
ALTER TABLE public.tb_user_role ENABLE ROW LEVEL SECURITY;

-- 본인 Role 조회
CREATE POLICY "tb_user_role_select_own"
  ON public.tb_user_role FOR SELECT
  USING (auth.uid() = user_id);

-- ADMIN+: 전체 조회 및 관리
CREATE POLICY "tb_user_role_all_admin"
  ON public.tb_user_role FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn  = 'Y'
    )
  );
```

### 샘플 데이터

```sql
INSERT INTO public.tb_user_role (user_id, role_id, start_dt, end_dt, use_yn, granted_by) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-01-01', NULL,         'Y', NULL),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-01-01', NULL,         'Y', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '2026-01-01', NULL,         'Y', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '2026-01-01', '2026-12-31', 'Y', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', '2026-03-01', NULL,         'Y', '00000000-0000-0000-0000-000000000002');
```

---

## 6. public.tb_menu_upload_log

### 테이블 용도 및 관계

엑셀 파일 대량 업로드의 요청 이력을 기록하는 테이블.  
`upload_user_id` → `auth.users` FK. 상세 오류는 `tb_menu_upload_error`에서 참조.

### DDL

```sql
CREATE TABLE public.tb_menu_upload_log (
  log_id         UUID        NOT NULL DEFAULT gen_random_uuid(),
  file_nm        VARCHAR(255) NOT NULL,
  upload_type    VARCHAR(50) NOT NULL,
  total_cnt      INTEGER     NOT NULL DEFAULT 0,
  success_cnt    INTEGER     NOT NULL DEFAULT 0,
  fail_cnt       INTEGER     NOT NULL DEFAULT 0,
  skip_cnt       INTEGER     NOT NULL DEFAULT 0,
  status         VARCHAR(10) NOT NULL DEFAULT 'PARTIAL',
  error_summary  TEXT,
  upload_user_id UUID        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tb_upload_log_pkey         PRIMARY KEY (log_id),
  CONSTRAINT tb_upload_log_user_fk
    FOREIGN KEY (upload_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tb_upload_log_status_check
    CHECK (status IN ('SUCCESS', 'FAIL', 'PARTIAL')),
  CONSTRAINT tb_upload_log_cnt_check
    CHECK (total_cnt >= 0 AND success_cnt >= 0 AND fail_cnt >= 0)
);

COMMENT ON TABLE  public.tb_menu_upload_log              IS '엑셀 업로드 이력';
COMMENT ON COLUMN public.tb_menu_upload_log.upload_type  IS '업로드 데이터 종류 (USER/MENU/ROLE 등)';
COMMENT ON COLUMN public.tb_menu_upload_log.skip_cnt     IS '오류 무시하고 건너뛴 행 수';
COMMENT ON COLUMN public.tb_menu_upload_log.status       IS '처리 상태: SUCCESS/FAIL/PARTIAL';
COMMENT ON COLUMN public.tb_menu_upload_log.error_summary IS '오류 요약 텍스트';
```

### 인덱스

```sql
-- 업로더별 이력 조회
CREATE INDEX idx_upload_log_user_id
  ON public.tb_menu_upload_log (upload_user_id, created_at DESC);

-- 날짜 범위 조회 (관리 화면 필터)
CREATE INDEX idx_upload_log_created_at
  ON public.tb_menu_upload_log (created_at DESC);

-- 상태별 조회
CREATE INDEX idx_upload_log_status
  ON public.tb_menu_upload_log (status, created_at DESC);

-- 업로드 타입 필터
CREATE INDEX idx_upload_log_type
  ON public.tb_menu_upload_log (upload_type, created_at DESC);
```

### RLS 정책

```sql
ALTER TABLE public.tb_menu_upload_log ENABLE ROW LEVEL SECURITY;

-- 업로더 본인: 자신이 올린 이력 조회
CREATE POLICY "upload_log_select_own"
  ON public.tb_menu_upload_log FOR SELECT
  USING (auth.uid() = upload_user_id);

-- ADMIN+: 전체 이력 조회 및 관리
CREATE POLICY "upload_log_all_admin"
  ON public.tb_menu_upload_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER')
        AND ur.use_yn  = 'Y'
    )
  );

-- 업로드 기록: 인증된 사용자면 INSERT 가능
CREATE POLICY "upload_log_insert_auth"
  ON public.tb_menu_upload_log FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = upload_user_id
  );
```

### 샘플 데이터

```sql
INSERT INTO public.tb_menu_upload_log (log_id, file_nm, upload_type, total_cnt, success_cnt, fail_cnt, skip_cnt, status, upload_user_id) VALUES
  ('30000000-0000-0000-0000-000000000001', 'users_batch_20260313.xlsx', 'USER', 1200, 1176, 24,  0,  'PARTIAL', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000002', 'menu_batch_20260310.xlsx',  'MENU', 45,   45,   0,   0,  'SUCCESS', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', 'roles_20260228.xlsx',       'ROLE', 15,   0,    15,  0,  'FAIL',    '00000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000004', 'users_batch_20260301.xlsx', 'USER', 500,  498,  2,   0,  'PARTIAL', '00000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000005', 'menu_batch_20260201.xlsx',  'MENU', 20,   20,   0,   0,  'SUCCESS', '00000000-0000-0000-0000-000000000002');
```

---

## 7. public.tb_menu_upload_error

### 테이블 용도 및 관계

엑셀 업로드에서 발생한 행별 오류 상세를 저장하는 테이블.  
`log_id` → `tb_menu_upload_log` FK. `raw_data`는 오류 행 원본 데이터를 JSONB로 저장.

### DDL

```sql
CREATE TABLE public.tb_menu_upload_error (
  error_id   UUID        NOT NULL DEFAULT gen_random_uuid(),
  log_id     UUID        NOT NULL,
  row_no     INTEGER     NOT NULL,
  column_nm  VARCHAR(100),
  error_cd   VARCHAR(50),
  error_msg  TEXT        NOT NULL,
  raw_data   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tb_upload_error_pkey   PRIMARY KEY (error_id),
  CONSTRAINT tb_upload_error_log_fk
    FOREIGN KEY (log_id) REFERENCES public.tb_menu_upload_log(log_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE  public.tb_menu_upload_error           IS '업로드 오류 상세';
COMMENT ON COLUMN public.tb_menu_upload_error.row_no    IS '엑셀 행 번호 (1-based)';
COMMENT ON COLUMN public.tb_menu_upload_error.column_nm IS '오류 발생 컬럼명';
COMMENT ON COLUMN public.tb_menu_upload_error.error_cd  IS '오류 코드 (DUPLICATE/REQUIRED/FORMAT 등)';
COMMENT ON COLUMN public.tb_menu_upload_error.raw_data  IS '오류 행 원본 데이터 (JSONB)';
```

### 인덱스

```sql
-- 업로드 이력별 오류 조회 (가장 빈번)
CREATE INDEX idx_upload_error_log_id
  ON public.tb_menu_upload_error (log_id, row_no);

-- JSONB raw_data GIN 인덱스 (원본 데이터 내 필드 검색)
CREATE INDEX idx_upload_error_raw_data
  ON public.tb_menu_upload_error USING gin (raw_data);

-- 오류 코드별 통계
CREATE INDEX idx_upload_error_cd
  ON public.tb_menu_upload_error (error_cd);
```

### RLS 정책

```sql
ALTER TABLE public.tb_menu_upload_error ENABLE ROW LEVEL SECURITY;

-- 업로더(log 소유자) 또는 ADMIN+: 조회 가능
CREATE POLICY "upload_error_select"
  ON public.tb_menu_upload_error FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_menu_upload_log l
      WHERE l.log_id = tb_menu_upload_error.log_id
        AND (
          l.upload_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.tb_user_role ur
            JOIN public.tb_role r ON ur.role_id = r.role_id
            WHERE ur.user_id = auth.uid()
              AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN', 'MANAGER')
              AND ur.use_yn  = 'Y'
          )
        )
    )
  );

-- 서버(service_role)에서만 INSERT 가능 (RLS 우회 INSERT)
CREATE POLICY "upload_error_insert_service"
  ON public.tb_menu_upload_error FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### 샘플 데이터

```sql
INSERT INTO public.tb_menu_upload_error (log_id, row_no, column_nm, error_cd, error_msg, raw_data) VALUES
  ('30000000-0000-0000-0000-000000000001', 5,  'email',  'DUPLICATE', '이미 존재하는 이메일입니다',       '{"name":"박민준","email":"park@company.com","dept":"개발1팀"}'),
  ('30000000-0000-0000-0000-000000000001', 12, 'email',  'DUPLICATE', '이미 존재하는 사용자입니다',        '{"name":"최수진","email":"choi@company.com","dept":"마케팅팀"}'),
  ('30000000-0000-0000-0000-000000000001', 23, 'dept',   'REQUIRED',  '부서명은 필수값입니다',             '{"name":"홍민수","email":"hong2@company.com","dept":null}'),
  ('30000000-0000-0000-0000-000000000001', 45, 'email',  'FORMAT',    '올바른 이메일 형식이 아닙니다',     '{"name":"김영수","email":"invalid-email","dept":"인사팀"}'),
  ('30000000-0000-0000-0000-000000000003', 1,  'role_cd', 'NOT_FOUND', '존재하지 않는 Role 코드입니다',   '{"role_cd":"SUPERUSER","role_nm":"슈퍼유저"}');
```

---

## 8. public.tb_permission_log

### 테이블 용도 및 관계

권한 부여/회수 변경 이력을 모두 기록하는 감사(Audit) 로그 테이블.  
삭제·수정 없이 INSERT ONLY 설계. 규제·컴플라이언스 대응용.

### DDL

```sql
CREATE TABLE public.tb_permission_log (
  log_id         UUID        NOT NULL DEFAULT gen_random_uuid(),
  target_user_id UUID        NOT NULL,
  action_type    VARCHAR(10) NOT NULL,
  role_id        UUID        NOT NULL,
  role_cd_snap   VARCHAR(50),
  before_state   JSONB,
  after_state    JSONB,
  acted_by       UUID        NOT NULL,
  acted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  remark         TEXT,

  CONSTRAINT tb_perm_log_pkey          PRIMARY KEY (log_id),
  CONSTRAINT tb_perm_log_actor_fk
    FOREIGN KEY (acted_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tb_perm_log_action_check
    CHECK (action_type IN ('GRANT', 'REVOKE', 'MODIFY', 'EXPIRE'))
);

COMMENT ON TABLE  public.tb_permission_log                IS '권한 변경 감사 로그 (INSERT ONLY)';
COMMENT ON COLUMN public.tb_permission_log.action_type    IS '변경 유형: GRANT/REVOKE/MODIFY/EXPIRE';
COMMENT ON COLUMN public.tb_permission_log.role_cd_snap   IS '변경 시점의 role_cd 스냅샷 (비정규화)';
COMMENT ON COLUMN public.tb_permission_log.before_state   IS '변경 전 상태 JSONB';
COMMENT ON COLUMN public.tb_permission_log.after_state    IS '변경 후 상태 JSONB';
COMMENT ON COLUMN public.tb_permission_log.acted_by       IS '변경을 실행한 관리자 ID';
```

### 인덱스

```sql
-- 특정 사용자의 권한 변경 이력 조회
CREATE INDEX idx_perm_log_target_user
  ON public.tb_permission_log (target_user_id, acted_at DESC);

-- 관리자별 작업 이력
CREATE INDEX idx_perm_log_acted_by
  ON public.tb_permission_log (acted_by, acted_at DESC);

-- 날짜 범위 조회 (감사 보고서)
CREATE INDEX idx_perm_log_acted_at
  ON public.tb_permission_log (acted_at DESC);

-- 액션 타입별 조회
CREATE INDEX idx_perm_log_action_type
  ON public.tb_permission_log (action_type, acted_at DESC);

-- JSONB 상태 검색
CREATE INDEX idx_perm_log_before_state
  ON public.tb_permission_log USING gin (before_state);
CREATE INDEX idx_perm_log_after_state
  ON public.tb_permission_log USING gin (after_state);
```

### RLS 정책

```sql
ALTER TABLE public.tb_permission_log ENABLE ROW LEVEL SECURITY;

-- ADMIN+: 전체 감사 로그 조회
CREATE POLICY "perm_log_select_admin"
  ON public.tb_permission_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn  = 'Y'
    )
  );

-- 본인 권한 변경 이력 조회
CREATE POLICY "perm_log_select_own"
  ON public.tb_permission_log FOR SELECT
  USING (auth.uid() = target_user_id);

-- INSERT ONLY: service_role 또는 ADMIN+
CREATE POLICY "perm_log_insert_admin"
  ON public.tb_permission_log FOR INSERT
  WITH CHECK (
    auth.uid() = acted_by
    AND EXISTS (
      SELECT 1 FROM public.tb_user_role ur
      JOIN public.tb_role r ON ur.role_id = r.role_id
      WHERE ur.user_id = auth.uid()
        AND r.role_cd IN ('ADMIN', 'SUPER_ADMIN')
        AND ur.use_yn  = 'Y'
    )
  );

-- UPDATE/DELETE 완전 차단 (감사 로그 불변성)
CREATE POLICY "perm_log_no_update"
  ON public.tb_permission_log FOR UPDATE
  USING (FALSE);

CREATE POLICY "perm_log_no_delete"
  ON public.tb_permission_log FOR DELETE
  USING (FALSE);
```

### 샘플 데이터

```sql
INSERT INTO public.tb_permission_log (target_user_id, action_type, role_id, role_cd_snap, before_state, after_state, acted_by, remark) VALUES
  ('00000000-0000-0000-0000-000000000004', 'GRANT',  '10000000-0000-0000-0000-000000000004', 'USER',    NULL,                          '{"role_cd":"USER","start_dt":"2026-01-01"}',   '00000000-0000-0000-0000-000000000002', '신규 입사자 권한 부여'),
  ('00000000-0000-0000-0000-000000000004', 'MODIFY', '10000000-0000-0000-0000-000000000004', 'USER',    '{"end_dt":null}',              '{"end_dt":"2026-12-31"}',                     '00000000-0000-0000-0000-000000000002', '계약직 기간 설정'),
  ('00000000-0000-0000-0000-000000000005', 'GRANT',  '10000000-0000-0000-0000-000000000003', 'MANAGER', NULL,                          '{"role_cd":"MANAGER","start_dt":"2026-03-01"}','00000000-0000-0000-0000-000000000001', '마케팅팀 매니저 승격'),
  ('00000000-0000-0000-0000-000000000003', 'REVOKE', '10000000-0000-0000-0000-000000000003', 'MANAGER', '{"use_yn":"Y","role_cd":"MANAGER"}', '{"use_yn":"N"}',                        '00000000-0000-0000-0000-000000000001', '퇴직 처리'),
  ('00000000-0000-0000-0000-000000000005', 'EXPIRE', '10000000-0000-0000-0000-000000000004', 'USER',    '{"end_dt":"2026-02-28"}',      '{"use_yn":"N"}',                              '00000000-0000-0000-0000-000000000001', '유효기간 만료 자동처리');
```

---

## 9. updated_at 자동 갱신 Trigger

### Trigger 함수 정의

```sql
-- updated_at 자동 갱신 공용 함수
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_updated_at IS
  'updated_at 컬럼을 현재 시각으로 자동 갱신하는 공용 Trigger 함수';
```

### 각 테이블에 Trigger 적용

```sql
-- 1. profiles
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 2. tb_role
CREATE TRIGGER trg_tb_role_updated_at
  BEFORE UPDATE ON public.tb_role
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 3. tb_menu
CREATE TRIGGER trg_tb_menu_updated_at
  BEFORE UPDATE ON public.tb_menu
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 4. tb_user_role
CREATE TRIGGER trg_tb_user_role_updated_at
  BEFORE UPDATE ON public.tb_user_role
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### auth.users 신규 가입 시 profiles 자동 생성 Trigger

```sql
-- auth.users INSERT 시 profiles 행 자동 생성
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER        -- auth 스키마 접근을 위해 DEFINER 권한 필요
SET search_path = public
AS $$
DECLARE
  v_default_role_id UUID;
BEGIN
  -- 기본 USER Role ID 조회
  SELECT role_id INTO v_default_role_id
  FROM public.tb_role
  WHERE role_cd = 'USER' AND use_yn = 'Y'
  LIMIT 1;

  -- profiles 행 생성
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- 기본 USER Role 부여
  IF v_default_role_id IS NOT NULL THEN
    INSERT INTO public.tb_user_role (user_id, role_id, start_dt, use_yn)
    VALUES (NEW.id, v_default_role_id, CURRENT_DATE, 'Y')
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

COMMENT ON FUNCTION public.fn_handle_new_user IS
  'auth.users 신규 생성 시 profiles + 기본 USER Role 자동 부여';
```

### Role 유효기간 만료 자동 처리 함수 (Cron 연동)

```sql
-- Supabase pg_cron 또는 Edge Function Cron으로 매일 실행
CREATE OR REPLACE FUNCTION public.fn_expire_user_roles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  -- 만료된 Role을 use_yn = 'N'으로 변경
  WITH expired AS (
    UPDATE public.tb_user_role
    SET use_yn = 'N', updated_at = NOW()
    WHERE end_dt < CURRENT_DATE
      AND use_yn = 'Y'
    RETURNING user_role_id, user_id, role_id
  ),
  -- 감사 로그 기록
  log_insert AS (
    INSERT INTO public.tb_permission_log
      (target_user_id, action_type, role_id, role_cd_snap, after_state, acted_by)
    SELECT
      e.user_id,
      'EXPIRE',
      e.role_id,
      r.role_cd,
      jsonb_build_object('use_yn', 'N', 'expired_at', CURRENT_DATE::text),
      e.user_id   -- 시스템 처리이므로 본인 ID 기록
    FROM expired e
    JOIN public.tb_role r ON e.role_id = r.role_id
    RETURNING log_id
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;

  RETURN v_expired_count;
END;
$$;

COMMENT ON FUNCTION public.fn_expire_user_roles IS
  '유효기간 만료된 User Role을 비활성화하고 감사 로그를 기록 (매일 실행 권장)';
```

---

## 10. 전체 ERD 관계도 (텍스트)

```
auth.users (Supabase 내부 관리)
  │  id (UUID, PK)
  │  email
  │  ...
  │
  ├──[ 1:1 ]──▶ public.profiles
  │               id (UUID, PK, FK→auth.users)
  │               email
  │               username
  │               dept_nm
  │               use_yn
  │               created_at / updated_at
  │
  ├──[ 1:N ]──▶ public.tb_user_role
  │               user_role_id (UUID, PK)
  │               user_id (FK→auth.users)  ──────────────────┐
  │               role_id (FK→tb_role)     ──────┐           │
  │               start_dt / end_dt              │           │
  │               use_yn                         │           │
  │               granted_by (FK→auth.users)     │           │
  │                                              │           │
  ├──[ 1:N ]──▶ public.tb_menu_upload_log        │           │
  │               log_id (UUID, PK)              │           │
  │               upload_user_id (FK→auth.users) │           │
  │               status (SUCCESS/FAIL/PARTIAL)  │           │
  │               │                              │           │
  │               └──[ 1:N ]──▶ public.tb_menu_upload_error  │
  │                               error_id (UUID, PK)        │
  │                               log_id (FK→upload_log)     │
  │                               row_no / column_nm         │
  │                               error_cd / error_msg       │
  │                               raw_data (JSONB)           │
  │                                                          │
  └──[ 1:N ]──▶ public.tb_permission_log         │           │
                  log_id (UUID, PK)              │           │
                  target_user_id                 │           │
                  acted_by (FK→auth.users)       │           │
                  action_type (GRANT/REVOKE/...)  │           │
                  role_id                       ─┘           │
                                                             │
public.tb_role ◀────────────────────────────────────────────┘
  role_id (UUID, PK)
  role_cd (VARCHAR, UNIQUE)
  role_nm
  is_system
  │
  ├──[ 1:N ]──▶ public.tb_user_role
  │               (위에서 설명)
  │
  └──[ 1:N ]──▶ public.tb_menu_role
                  map_id (UUID, PK)
                  menu_id (FK→tb_menu) ────┐
                  role_id (FK→tb_role)     │
                  read_yn / write_yn       │
                                           │
public.tb_menu ◀───────────────────────────┘
  menu_id (UUID, PK)
  parent_menu_id (FK→tb_menu, Self FK)
  menu_nm / menu_url
  menu_depth (1=GNB, 2=LNB)
  menu_order / use_yn
  │
  └──[ Self 1:N ]──▶ public.tb_menu (계층형 Self FK)
                       GNB (depth=1)
                         └── LNB (depth=2, parent_menu_id=GNB.menu_id)
```

### 관계 요약표

| 부모 테이블 | 자식 테이블 | 관계 | FK 컬럼 | ON DELETE |
|------------|------------|------|---------|----------|
| auth.users | profiles | 1:1 | profiles.id | CASCADE |
| auth.users | tb_user_role | 1:N | user_id | CASCADE |
| auth.users | tb_menu_upload_log | 1:N | upload_user_id | SET NULL |
| auth.users | tb_permission_log | 1:N | acted_by | SET NULL |
| tb_role | tb_user_role | 1:N | role_id | RESTRICT |
| tb_role | tb_menu_role | 1:N | role_id | CASCADE |
| tb_menu | tb_menu_role | 1:N | menu_id | CASCADE |
| tb_menu | tb_menu (Self) | 1:N | parent_menu_id | CASCADE |
| tb_menu_upload_log | tb_menu_upload_error | 1:N | log_id | CASCADE |

---

## 11. Supabase 적용 순서 가이드

### SQL Editor 실행 순서 (의존성 기준)

의존성이 없는 테이블부터 순서대로 실행해야 FK 오류가 발생하지 않습니다.

```
STEP 1 ─── 공용 Trigger 함수 생성
           → fn_set_updated_at()

STEP 2 ─── 독립 마스터 테이블 생성
           → public.tb_role
           → public.tb_menu (Self FK이므로 선행 생성 필수)

STEP 3 ─── auth.users 의존 테이블 생성
           → public.profiles
           → public.tb_user_role
           → public.tb_menu_upload_log
           → public.tb_permission_log

STEP 4 ─── 복합 FK 테이블 생성
           → public.tb_menu_role          (tb_menu + tb_role 모두 존재 후)
           → public.tb_menu_upload_error  (tb_menu_upload_log 존재 후)

STEP 5 ─── 인덱스 생성 (테이블 생성 후 일괄)
           → 각 테이블의 CREATE INDEX 문 실행

STEP 6 ─── RLS 활성화 및 정책 등록
           → ALTER TABLE ... ENABLE ROW LEVEL SECURITY
           → CREATE POLICY ...

STEP 7 ─── Trigger 등록
           → 각 테이블 Trigger 생성
           → fn_handle_new_user Trigger 등록 (auth.users)

STEP 8 ─── 샘플 데이터 INSERT
           → tb_role → profiles → tb_user_role → tb_menu → tb_menu_role 순서
```

### 각 STEP SQL 파일 구조 (권장)

```
infra/sql/
  ├── 01_functions.sql        ← Trigger 함수
  ├── 02_tables_master.sql    ← tb_role, tb_menu
  ├── 03_tables_user.sql      ← profiles, tb_user_role
  ├── 04_tables_log.sql       ← upload_log, upload_error, permission_log
  ├── 05_tables_mapping.sql   ← tb_menu_role
  ├── 06_indexes.sql          ← 전체 인덱스
  ├── 07_rls_policies.sql     ← 전체 RLS 정책
  ├── 08_triggers.sql         ← 전체 Trigger
  └── 09_sample_data.sql      ← 샘플 데이터
```

### Supabase Dashboard에서 RLS 확인 방법

```
1. Supabase Dashboard → 좌측 메뉴 [Table Editor]
2. 테이블 클릭 → 상단 [RLS 활성화 여부] 자물쇠 아이콘 확인
   ● 🔒 자물쇠 잠김 = RLS 활성화 ✅
   ○ 🔓 자물쇠 열림 = RLS 비활성화 ⚠️

3. Authentication → Policies 메뉴에서 전체 정책 목록 확인
   - 테이블별 정책 이름, 대상 작업(SELECT/INSERT 등), 조건 확인 가능

4. SQL Editor에서 검증 쿼리 실행:
```

```sql
-- 특정 테이블의 RLS 활성화 여부 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 등록된 RLS 정책 전체 목록
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Node.js Serverless에서 Supabase 접근 방식

```javascript
// /api/auth/login.js 등에서 service_role 키로 RLS 우회
import { createClient } from '@supabase/supabase-js';

// service_role: RLS 우회, 서버에서만 사용
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role 키
);

// anon key: RLS 적용, 프론트에서 사용
const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY     // anon 키
);
```

---

## 12. 100만 유저 대응 인덱스 전략 요약

### 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Partial Index 우선** | `WHERE use_yn = 'Y'` 조건부 인덱스로 인덱스 크기 최소화 |
| **Composite Index 활용** | 자주 같이 쓰이는 컬럼 묶음 (user_id + role_id 등) |
| **GIN Index (JSONB)** | `raw_data`, `before_state` 등 JSONB 필드 고속 검색 |
| **DESC 정렬 인덱스** | 최신 데이터 조회가 많은 로그 테이블에 `created_at DESC` |

### 테이블별 핵심 인덱스 해설

| 테이블 | 인덱스 컬럼 | 이유 |
|--------|------------|------|
| `profiles` | `email` (UNIQUE) | 로그인, 검색에서 매번 호출되는 컬럼. 100만 행에서 Full Scan 방지. |
| `profiles` | `use_yn = 'Y'` (Partial) | 활성 사용자만 조회하는 패턴 최적화. 탈퇴 사용자 제외. |
| `tb_role` | `role_cd` (UNIQUE) | RLS 정책에서 `role_cd IN ('ADMIN', 'SUPER_ADMIN')` 조건이 모든 API 요청마다 실행됨. |
| `tb_menu` | `(menu_depth, menu_order)` (Partial `use_yn='Y'`) | GNB 렌더링 시 depth=1 전체 조회 + 정렬. 복합 인덱스로 Index Only Scan 가능. |
| `tb_menu` | `parent_menu_id` (Partial) | LNB 조회는 항상 GNB ID로 필터. 복합 FK+정렬 인덱스. |
| `tb_menu_role` | `(menu_id, role_id)` | 메뉴 렌더링 시 해당 메뉴의 허용 Role 확인. N:M 매핑 테이블 핵심 인덱스. |
| `tb_menu_role` | `(role_id, menu_id)` (Partial `read_yn='Y'`) | 반대 방향 조회 (Role로 메뉴 목록 조회). 양방향 인덱스 필수. |
| `tb_user_role` | `(user_id, role_id)` (Partial `use_yn='Y'`) | **가장 빈번한 쿼리**: 모든 RLS 정책이 사용자의 활성 Role 체크. 요청당 1회 이상 실행. |
| `tb_user_role` | `end_dt` (Partial `use_yn='Y'`) | 만료 배치 처리 성능. 전체 스캔 없이 만료 대상만 추출. |
| `tb_menu_upload_log` | `(upload_user_id, created_at DESC)` | 업로더의 최근 이력 조회. 복합 인덱스로 Covering Index 효과. |
| `tb_menu_upload_error` | `(log_id, row_no)` | 이력 1건의 오류 상세 전체 조회. log_id로 파티셔닝 효과. |
| `tb_menu_upload_error` | `raw_data` (GIN) | 오류 원본 데이터에서 특정 필드 검색. JSONB → GIN 필수. |
| `tb_permission_log` | `(target_user_id, acted_at DESC)` | 특정 사용자의 권한 이력 시계열 조회. |
| `tb_permission_log` | `acted_at DESC` | 감사 보고서 날짜 범위 조회. 대용량 로그 테이블 필수. |
| `tb_permission_log` | `before/after_state` (GIN) | JSONB 필드에서 특정 role_cd 변경 이력 전문 검색. |

### 파티셔닝 전략 (1억 건 이상 대비)

```sql
-- tb_permission_log: 연도별 파티셔닝 권장 (감사 로그는 시간이 지날수록 급증)
-- tb_menu_upload_error: log_id 기준 파티셔닝 (이력당 수백 행 집중)

-- 예시: 연도별 파티셔닝
CREATE TABLE public.tb_permission_log (
  ...
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (acted_at);

CREATE TABLE public.tb_permission_log_2026
  PARTITION OF public.tb_permission_log
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE public.tb_permission_log_2027
  PARTITION OF public.tb_permission_log
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
```

### VACUUM/AUTOVACUUM 권장 설정

```sql
-- 업로드 오류 테이블: 대량 삽입 후 Dead Tuple 조기 정리
ALTER TABLE public.tb_menu_upload_error
  SET (autovacuum_vacuum_scale_factor = 0.01,
       autovacuum_analyze_scale_factor = 0.005);

-- 권한 로그: INSERT ONLY이므로 VACUUM 필요성 낮음
ALTER TABLE public.tb_permission_log
  SET (autovacuum_vacuum_scale_factor = 0.1);
```

---

> **문서 종료** | 8개 테이블 + Trigger + ERD + 가이드 + 인덱스 전략  
> **버전**: v1.0 | **작성일**: 2026-03-13  
> **다음 단계**: `infra/sql/` 폴더에 STEP별 SQL 파일 분리 후 Supabase SQL Editor 순서대로 실행
