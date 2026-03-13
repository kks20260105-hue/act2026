# Node.js Serverless API 명세서

> **프로젝트명**: KKS 엔터프라이즈 포털  
> **버전**: v2.0 (TypeScript 전면 적용)  
> **작성일**: 2026-03-13  
> **기술스택**: Node.js TypeScript Serverless (Vercel /api) / Supabase PostgreSQL / Supabase Auth JWT  
> **주의**: 모든 파일 확장자 `.ts` 사용 (`.js` 절대 사용 금지)

---

## 목차

| # | 항목 |
|---|------|
| 1 | 공통 사항 (인증·응답형식·에러코드·미들웨어·타입정의) |
| 2 | 메뉴 API |
| 3 | 메뉴 업로드 API |
| 4 | Role API |
| 5 | 메뉴-Role 매핑 API |
| 6 | 사용자-Role API |
| 7 | 핵심 코드 예시 (TypeScript) |
| 8 | 환경변수 목록 |
| 9 | Vercel 배포 설정 |

---

## 1. 공통 사항

### 1.1 인증 방식

모든 보호 엔드포인트는 `Authorization: Bearer {supabase_jwt_token}` 헤더 필수.

**JWT 검증 흐름**:
```
클라이언트 Request
  │  Authorization: Bearer eyJhbGc...
  ▼
/lib/authMiddleware.ts  (verifyJWT)
  │  supabaseAdmin.auth.getUser(token)
  │  → Supabase Auth 서버에서 서명 검증 + user 조회
  │  → 실패 시 401 즉시 반환
  ▼
/lib/checkRole.ts  (withAuth)
  │  tb_user_role JOIN tb_role 에서 활성 Role 목록 조회
  │  → 허용 Role 없으면 403 반환
  ▼
실제 핸들러 실행 (req.user 주입됨)
```

**토큰 만료 처리**:
- Supabase JWT 기본 만료: `1시간`
- `getUser()` 오류 메시지 `expired` 포함 시 → `AUTH_002` 코드로 401 반환
- 프론트엔드: 401 수신 시 `supabase.auth.refreshSession()` 자동 호출
- 갱신 실패 시 `/login` 리다이렉트

```typescript
// /lib/authMiddleware.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseClient';
import { ERROR_CODES } from './errorCodes';

export interface AuthUser {
  id:    string;
  email: string;
  roles: string[];
}

export type AuthedRequest = VercelRequest & { user: AuthUser };

/**
 * verifyJWT - Supabase Auth JWT 검증 미들웨어
 * 성공 시 AuthUser 반환, 실패 시 res에 직접 오류 응답 후 null 반환
 */
export async function verifyJWT(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthUser | null> {
  const authHeader = req.headers['authorization'];

  // 1. Bearer 토큰 추출
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: ERROR_CODES.AUTH_001 });
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      error: { ...ERROR_CODES.AUTH_001, detail: '토큰 값이 비어있습니다.' },
    });
    return null;
  }

  // 2. Supabase Auth 서버로 토큰 검증
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    const isExpired =
      error?.message?.toLowerCase().includes('expired') ||
      error?.message?.toLowerCase().includes('jwt expired');
    res.status(401).json({
      success: false,
      error: isExpired ? ERROR_CODES.AUTH_002 : ERROR_CODES.AUTH_001,
    });
    return null;
  }

  // 3. 활성 Role 목록 조회 (만료일 체크 포함)
  const today = new Date().toISOString().split('T')[0];
  const { data: roleRows, error: roleErr } = await supabaseAdmin
    .from('tb_user_role')
    .select('tb_role(role_cd)')
    .eq('user_id', user.id)
    .eq('use_yn', 'Y')
    .or(`end_dt.is.null,end_dt.gte.${today}`);

  if (roleErr) {
    console.error('[verifyJWT] Role 조회 실패:', roleErr.message);
    res.status(500).json({ success: false, error: ERROR_CODES.DB_001 });
    return null;
  }

  const roles: string[] = (roleRows ?? [])
    .map((r: any) => r.tb_role?.role_cd as string | undefined)
    .filter((cd): cd is string => Boolean(cd));

  return { id: user.id, email: user.email ?? '', roles };
}
```

---

### 1.2 공통 Response 타입 정의 (TypeScript interface)

```typescript
// /lib/types.ts (Response 관련 인터페이스)

/** 공통 에러 상세 */
export interface ApiError {
  code:       string;
  message:    string;
  httpStatus: number;
  detail?:    string | Record<string, unknown>;
}

/** 성공 응답 */
export interface ApiSuccessResponse<T = unknown> {
  success:  true;
  data:     T;
  message?: string;
}

/** 실패 응답 */
export interface ApiErrorResponse {
  success: false;
  error:   ApiError;
}

/** 공통 응답 유니온 타입 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** 페이지네이션 메타 */
export interface Pagination {
  total:       number;
  page:        number;
  limit:       number;
  total_pages: number;
}

/** 페이지네이션 포함 목록 응답 */
export interface ApiListResponse<T> {
  items:      T[];
  pagination: Pagination;
}
```

**성공 응답 예시**:
```json
{
  "success": true,
  "data": { "menu_id": "uuid-...", "menu_nm": "홈" },
  "message": "메뉴가 등록되었습니다."
}
```

**실패 응답 예시**:
```json
{
  "success": false,
  "error": {
    "code": "MENU_001",
    "message": "메뉴를 찾을 수 없습니다.",
    "httpStatus": 404,
    "detail": "menuId: 00000000-0000-0000-0000-000000000099"
  }
}
```

---

### 1.3 공통 에러 코드 정의

```typescript
// /lib/errorCodes.ts
export interface ErrorCode {
  code:       string;
  message:    string;
  httpStatus: number;
}

export const ERROR_CODES = {
  // ── 인증 (AUTH) ──
  AUTH_001: { code: 'AUTH_001', message: '인증 토큰이 없거나 유효하지 않습니다.',          httpStatus: 401 },
  AUTH_002: { code: 'AUTH_002', message: '만료된 토큰입니다. 다시 로그인해주세요.',         httpStatus: 401 },
  AUTH_003: { code: 'AUTH_003', message: '접근 권한이 없습니다.',                          httpStatus: 403 },
  AUTH_004: { code: 'AUTH_004', message: '본인 계정의 Role은 변경할 수 없습니다.',          httpStatus: 403 },

  // ── 메뉴 (MENU) ──
  MENU_001: { code: 'MENU_001', message: '메뉴를 찾을 수 없습니다.',                       httpStatus: 404 },
  MENU_002: { code: 'MENU_002', message: '이미 존재하는 메뉴 URL입니다.',                  httpStatus: 409 },
  MENU_003: { code: 'MENU_003', message: '하위 메뉴가 존재하여 삭제할 수 없습니다.',       httpStatus: 422 },
  MENU_004: { code: 'MENU_004', message: '메뉴 depth는 1(GNB) 또는 2(LNB)만 허용됩니다.', httpStatus: 422 },
  MENU_005: { code: 'MENU_005', message: '상위 메뉴ID가 존재하지 않거나 GNB가 아닙니다.',  httpStatus: 422 },

  // ── Role (ROLE) ──
  ROLE_001: { code: 'ROLE_001', message: 'Role을 찾을 수 없습니다.',                       httpStatus: 404 },
  ROLE_002: { code: 'ROLE_002', message: '이미 존재하는 Role 코드입니다.',                 httpStatus: 409 },
  ROLE_003: { code: 'ROLE_003', message: '시스템 기본 Role은 삭제할 수 없습니다.',         httpStatus: 422 },
  ROLE_004: { code: 'ROLE_004', message: '사용 중인 Role입니다 (소속 사용자 존재).',       httpStatus: 422 },

  // ── 업로드 (UPLOAD) ──
  UPLOAD_001: { code: 'UPLOAD_001', message: '파일 형식이 올바르지 않습니다 (xlsx/xls만 허용).', httpStatus: 400 },
  UPLOAD_002: { code: 'UPLOAD_002', message: '파일 크기가 10MB를 초과합니다.',              httpStatus: 413 },
  UPLOAD_003: { code: 'UPLOAD_003', message: '필수 헤더가 누락되었습니다.',                httpStatus: 422 },
  UPLOAD_004: { code: 'UPLOAD_004', message: 'ALL_OR_NOTHING 모드에서 유효성 오류가 발생했습니다.', httpStatus: 400 },
  UPLOAD_005: { code: 'UPLOAD_005', message: '업로드 이력을 찾을 수 없습니다.',            httpStatus: 404 },

  // ── 사용자 (USER) ──
  USER_001: { code: 'USER_001', message: '사용자를 찾을 수 없습니다.',                     httpStatus: 404 },
  USER_002: { code: 'USER_002', message: '이미 부여된 Role입니다.',                        httpStatus: 409 },

  // ── 공통 (COMMON) ──
  COMMON_001: { code: 'COMMON_001', message: '잘못된 요청 파라미터입니다.',                httpStatus: 400 },
  COMMON_002: { code: 'COMMON_002', message: '지원하지 않는 HTTP 메서드입니다.',           httpStatus: 405 },
  COMMON_003: { code: 'COMMON_003', message: '서버 내부 오류가 발생했습니다.',             httpStatus: 500 },
  DB_001:     { code: 'DB_001',     message: '데이터베이스 오류가 발생했습니다.',           httpStatus: 500 },
} as const satisfies Record<string, ErrorCode>;

export type ErrorCodeKey = keyof typeof ERROR_CODES;

/** 에러 응답 JSON 생성 헬퍼 */
export function makeError(
  key: ErrorCodeKey,
  detail?: string | Record<string, unknown>
): { success: false; error: ErrorCode & { detail?: typeof detail } } {
  return {
    success: false,
    error: { ...ERROR_CODES[key], ...(detail !== undefined ? { detail } : {}) },
  };
}
```

**에러 코드 요약 표**:

| 코드 | HTTP | 분류 | 설명 |
|------|------|------|------|
| AUTH_001 | 401 | 인증 | 토큰 없음/유효하지 않음 |
| AUTH_002 | 401 | 인증 | 토큰 만료 |
| AUTH_003 | 403 | 권한 | Role 부족 |
| AUTH_004 | 403 | 권한 | 본인 Role 변경 시도 |
| MENU_001 | 404 | 메뉴 | 메뉴 없음 |
| MENU_002 | 409 | 메뉴 | URL 중복 |
| MENU_003 | 422 | 메뉴 | 하위 메뉴 존재로 삭제 불가 |
| MENU_004 | 422 | 메뉴 | depth 값 오류 |
| MENU_005 | 422 | 메뉴 | 상위 메뉴 오류 |
| ROLE_001 | 404 | Role | Role 없음 |
| ROLE_002 | 409 | Role | Role 코드 중복 |
| ROLE_003 | 422 | Role | 시스템 Role 삭제 시도 |
| ROLE_004 | 422 | Role | 사용 중인 Role 삭제 시도 |
| UPLOAD_001 | 400 | 업로드 | 파일 형식 오류 |
| UPLOAD_002 | 413 | 업로드 | 파일 크기 초과 |
| UPLOAD_003 | 422 | 업로드 | 헤더 누락 |
| UPLOAD_004 | 400 | 업로드 | ALL_OR_NOTHING 저장 취소 |
| UPLOAD_005 | 404 | 업로드 | 이력 없음 |
| USER_001 | 404 | 사용자 | 사용자 없음 |
| USER_002 | 409 | 사용자 | Role 중복 부여 |
| COMMON_001 | 400 | 공통 | 잘못된 파라미터 |
| COMMON_002 | 405 | 공통 | 메서드 불허 |
| COMMON_003 | 500 | 공통 | 서버 내부 오류 |
| DB_001 | 500 | DB | DB 오류 |

---

### 1.4 Role 기반 접근 제어 미들웨어

```typescript
// /lib/checkRole.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyJWT, AuthUser, AuthedRequest } from './authMiddleware';
import { ERROR_CODES, makeError } from './errorCodes';

export type AuthedHandler = (
  req: AuthedRequest,
  res: VercelResponse
) => Promise<void> | void;

/**
 * allowMethods - HTTP 메서드 허용 체크 유틸
 * @returns true면 허용, false면 405 응답 후 false 반환
 */
export function allowMethods(
  allowed: string[],
  req: VercelRequest,
  res: VercelResponse
): boolean {
  if (!allowed.includes(req.method ?? '')) {
    res.status(405).json({
      success: false,
      error: {
        ...ERROR_CODES.COMMON_002,
        detail: `허용 메서드: [${allowed.join(', ')}], 요청 메서드: ${req.method}`,
      },
    });
    return false;
  }
  return true;
}

/**
 * withAuth - JWT 검증 + Role 체크 통합 HOF (Higher-Order Function)
 *
 * @param allowedRoles null이면 인증만 체크 (Role 무관).
 *                     string[]이면 해당 Role 중 하나 필요.
 *                     SUPER_ADMIN은 항상 모든 엔드포인트 통과.
 *
 * 사용 예:
 *   export default withAuth(['ADMIN', 'SUPER_ADMIN'], async (req, res) => {
 *     const user = req.user; // AuthUser
 *     ...
 *   });
 */
export function withAuth(
  allowedRoles: string[] | null,
  handler: AuthedHandler
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    // 1. JWT 검증 (항상 수행)
    const user = await verifyJWT(req, res);
    if (!user) return; // verifyJWT 내부에서 401 응답 완료

    // 2. Role 체크 (allowedRoles 지정 시만)
    if (allowedRoles && allowedRoles.length > 0) {
      const isSuperAdmin  = user.roles.includes('SUPER_ADMIN');
      const hasAllowedRole = allowedRoles.some((r) => user.roles.includes(r));

      if (!isSuperAdmin && !hasAllowedRole) {
        res.status(403).json({
          success: false,
          error: {
            ...ERROR_CODES.AUTH_003,
            detail: `필요 Role: [${allowedRoles.join(', ')}] / 현재 Role: [${user.roles.join(', ')}]`,
          },
        });
        return;
      }
    }

    // 3. req에 user 주입 후 핸들러 실행
    (req as AuthedRequest).user = user;
    await handler(req as AuthedRequest, res);
  };
}

/**
 * checkRole - 이미 verifyJWT 완료된 상태에서 Role 단독 체크
 * @returns true면 허용, false면 403 응답 후 false 반환
 */
export function checkRole(
  allowedRoles: string[],
  user: AuthUser,
  res: VercelResponse
): boolean {
  const isSuperAdmin  = user.roles.includes('SUPER_ADMIN');
  const hasAllowedRole = allowedRoles.some((r) => user.roles.includes(r));

  if (!isSuperAdmin && !hasAllowedRole) {
    res.status(403).json({
      success: false,
      error: {
        ...ERROR_CODES.AUTH_003,
        detail: `필요 Role: [${allowedRoles.join(', ')}] / 현재 Role: [${user.roles.join(', ')}]`,
      },
    });
    return false;
  }
  return true;
}
```

---

### 1.5 Supabase 클라이언트 초기화

```typescript
// /lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY        = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[supabaseClient] 필수 환경변수 누락: SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * supabaseAdmin
 * - service_role 키 사용 → RLS 완전 우회
 * - 서버 사이드 (/api, /lib) 전용. 클라이언트에 절대 노출 금지.
 * - Serverless 모듈 레벨 싱글톤으로 선언 (같은 인스턴스 재활용 시 Cold Start 절약)
 */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false, // 서버: 토큰 갱신 불필요
      persistSession:   false, // 서버: 세션 저장 불필요
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'kks-portal-api',
      },
    },
  }
);

/**
 * supabaseAnon
 * - anon 키 사용 → RLS 정책 적용
 * - RLS 테스트 또는 공개 데이터 조회 시 사용
 */
export const supabaseAnon: SupabaseClient = createClient(
  SUPABASE_URL!,
  SUPABASE_ANON_KEY ?? ''
);
```

**환경변수 목록 (`.env.local`)**:
```bash
# ── Supabase 서버 전용 변수 (절대 프론트엔드에 노출 금지) ──
SUPABASE_URL=https://hqyfkgwyblncdohrrgii.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...  # service_role 키
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...          # anon 공개 키

# ── Vite 프론트엔드 공개 변수 (VITE_ prefix 필수) ──
VITE_SUPABASE_URL=https://hqyfkgwyblncdohrrgii.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
VITE_API_BASE_URL=https://act2026.vercel.app
```

| 변수명 | 사용 위치 | 노출 범위 | 용도 |
|--------|----------|----------|------|
| `SUPABASE_URL` | 서버 (`/api`, `/lib`) | 서버 전용 | Admin 클라이언트 초기화 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 (`/api`, `/lib`) | **절대 비공개** | RLS 우회 Admin 클라이언트, JWT 검증 |
| `SUPABASE_ANON_KEY` | 서버·프론트 | 공개 가능 | anon 클라이언트 (RLS 적용) |
| `VITE_SUPABASE_URL` | 프론트엔드 | 공개 가능 | 프론트 Supabase Auth 초기화 |
| `VITE_SUPABASE_ANON_KEY` | 프론트엔드 | 공개 가능 | 프론트 Supabase 클라이언트 초기화 |
| `VITE_API_BASE_URL` | 프론트엔드 | 공개 가능 | 배포 환경 API 호스트 분기 |

---

### 1.6 공통 TypeScript 타입 정의

```typescript
// /lib/types.ts

// ═══════════════════════════════════════════
// 공통 유틸 타입
// ═══════════════════════════════════════════

export type YN             = 'Y' | 'N';
export type UploadMode     = 'ALL_OR_NOTHING' | 'PARTIAL_SUCCESS';
export type UploadStatus   = 'SUCCESS' | 'FAIL' | 'PARTIAL';
export type PermissionAction = 'GRANT' | 'REVOKE' | 'EXPIRE';

// ═══════════════════════════════════════════
// 메뉴 (tb_menu)
// ═══════════════════════════════════════════

export interface Menu {
  menu_id:        string;
  menu_nm:        string;
  menu_url:       string;
  parent_menu_id: string | null;
  menu_depth:     1 | 2;
  menu_order:     number;
  icon_class:     string | null;
  use_yn:         YN;
  created_at:     string;
  updated_at:     string | null;
}

/** 트리 구조로 변환된 메뉴 */
export interface MenuTree extends Menu {
  children: MenuTree[];
}

/** 사용자별 권한 정보가 포함된 메뉴 트리 */
export interface MenuWithPermission extends Omit<MenuTree, 'children'> {
  read_yn:   YN;
  write_yn:  YN;
  can_write: boolean;
  children:  MenuWithPermission[];
}

/** 메뉴 등록/수정 Request Body */
export interface MenuUpsertBody {
  menu_nm:         string;
  menu_url:        string;
  parent_menu_id?: string | null;
  menu_depth:      1 | 2;
  menu_order:      number;
  icon_class?:     string;
  use_yn:          YN;
  allow_roles:     string[];
}

/** 메뉴 정렬 순서 변경 아이템 */
export interface MenuOrderItem {
  menu_id:    string;
  menu_order: number;
}

// ═══════════════════════════════════════════
// Role (tb_role)
// ═══════════════════════════════════════════

export interface Role {
  role_id:    string;
  role_cd:    string;
  role_nm:    string;
  role_desc:  string | null;
  role_color: string | null;
  sort_order: number;
  use_yn:     YN;
  is_system:  boolean;
  created_at: string;
  updated_at: string | null;
}

/** Role 목록 응답 (집계 통계 포함) */
export interface RoleWithStats extends Role {
  user_count: number;
  menu_count: number;
}

/** Role 등록/수정 Request Body */
export interface RoleUpsertBody {
  role_cd?:    string;   // 등록 시만 필수
  role_nm:     string;
  role_desc?:  string;
  role_color?: string;
  sort_order?: number;
  use_yn:      YN;
}

// ═══════════════════════════════════════════
// 메뉴-Role 매핑 (tb_menu_role)
// ═══════════════════════════════════════════

export interface MenuRole {
  id:         string;
  menu_id:    string;
  role_id:    string;
  read_yn:    YN;
  write_yn:   YN;
  created_at: string;
}

/** 매핑 일괄 저장 요청 아이템 */
export interface MenuRoleBatchItem {
  menu_id:  string;
  role_id:  string;
  read_yn:  YN;
  write_yn: YN;
}

/** 매트릭스 응답 형태 */
export interface MenuRoleMatrix {
  menu_id:     string;
  menu_nm:     string;
  menu_depth:  number;
  menu_order:  number;
  permissions: Record<string, { read_yn: YN; write_yn: YN }>;
}

// ═══════════════════════════════════════════
// 사용자-Role (tb_user_role)
// ═══════════════════════════════════════════

export interface UserRole {
  user_role_id: string;
  user_id:      string;
  role_id:      string;
  start_dt:     string;
  end_dt:       string | null;
  use_yn:       YN;
  granted_by:   string | null;
  created_at:   string;
  updated_at:   string | null;
}

/** 사용자 Role 목록 응답 (Role 정보 포함) */
export interface UserRoleWithInfo extends UserRole {
  role_cd:          string;
  role_nm:          string;
  role_color:       string | null;
  granted_by_user?: { id: string; username: string };
}

/** Role 부여 Request Body */
export interface GrantRoleBody {
  role_id:  string;
  start_dt: string;
  end_dt?:  string | null;
  remark?:  string;
}

// ═══════════════════════════════════════════
// 업로드 이력 (tb_menu_upload_log)
// ═══════════════════════════════════════════

export interface UploadLog {
  log_id:         string;
  file_nm:        string;
  upload_type:    string;
  total_cnt:      number;
  success_cnt:    number;
  fail_cnt:       number;
  skip_cnt:       number;
  status:         UploadStatus;
  upload_user_id: string;
  created_at:     string;
}

/** 업로드 이력 + 업로더 프로필 조인 */
export interface UploadLogWithUser extends UploadLog {
  uploader: {
    id:       string;
    username: string;
    email:    string;
  };
}

// ═══════════════════════════════════════════
// 업로드 오류 (tb_menu_upload_error)
// ═══════════════════════════════════════════

export interface UploadError {
  error_id:   string;
  log_id:     string;
  row_no:     number;
  column_nm:  string | null;
  error_cd:   string | null;
  error_msg:  string;
  raw_data:   Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════
// 엑셀 업로드 Row 타입
// ═══════════════════════════════════════════

export interface MenuUploadRow {
  row_no:         number;
  menu_nm:        string;
  menu_url:       string;
  parent_menu_id: string | null;
  menu_depth:     number;
  menu_order:     number;
  icon_class?:    string;
  use_yn:         string;
  allow_roles:    string[];
}

export interface UploadErrorRow {
  row_no:   number;
  raw_data: Record<string, unknown>;
  errors: {
    column_nm: string;
    error_cd:  string;
    error_msg: string;
  }[];
}

// ═══════════════════════════════════════════
// 권한 이력 (tb_permission_log)
// ═══════════════════════════════════════════

export interface PermissionLog {
  log_id:         string;
  target_user_id: string;
  action_type:    PermissionAction;
  role_id:        string;
  role_cd_snap:   string;
  before_state:   Record<string, unknown> | null;
  after_state:    Record<string, unknown> | null;
  acted_by:       string;
  remark:         string | null;
  created_at:     string;
}

// ═══════════════════════════════════════════
// API 공통 응답 타입 (재선언 - 외부 참조용)
// ═══════════════════════════════════════════

export interface ApiError {
  code:       string;
  message:    string;
  httpStatus: number;
  detail?:    string | Record<string, unknown>;
}

export interface ApiSuccessResponse<T = unknown> {
  success:  true;
  data:     T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error:   ApiError;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface Pagination {
  total:       number;
  page:        number;
  limit:       number;
  total_pages: number;
}

export interface ApiListResponse<T> {
  items:      T[];
  pagination: Pagination;
}
```

---

## 2. 메뉴 API

### 2.1 GET /api/menus — `api/menus/index.ts`

**설명**: 전체 메뉴 트리 조회 (GNB + LNB 계층 구조 반환)  
**접근 Role**: 전체 (비로그인 포함, `use_yn='Y'` 기본 필터)  
**파일**: `api/menus/index.ts` (method: GET)

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| use_yn | string | 선택 | Y | Y/N (ADMIN은 N도 조회 가능) |
| depth | number | 선택 | - | 1=GNB만, 2=LNB만, 없으면 전체 |

**Request**:
```
GET /api/menus?use_yn=Y
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "menus": [
      {
        "menu_id": "20000000-0000-0000-0000-000000000001",
        "menu_nm": "홈",
        "menu_url": "/",
        "menu_depth": 1,
        "menu_order": 1,
        "icon_class": "home",
        "use_yn": "Y",
        "parent_menu_id": null,
        "children": []
      },
      {
        "menu_id": "20000000-0000-0000-0000-000000000002",
        "menu_nm": "업무",
        "menu_url": "/work",
        "menu_depth": 1,
        "menu_order": 2,
        "icon_class": "briefcase",
        "use_yn": "Y",
        "parent_menu_id": null,
        "children": [
          {
            "menu_id": "20000000-0000-0000-0000-000000000010",
            "menu_nm": "공지사항",
            "menu_url": "/work/notice",
            "menu_depth": 2,
            "menu_order": 1,
            "icon_class": "bell",
            "use_yn": "Y",
            "parent_menu_id": "20000000-0000-0000-0000-000000000002",
            "children": []
          }
        ]
      }
    ],
    "total": 12
  }
}
```

**캐시 전략 (React Query 권장값)**:
```typescript
// 프론트엔드 React Query 설정
useQuery({
  queryKey: ['menus'],
  queryFn:  () => fetcher('/api/menus'),
  staleTime:            5 * 60 * 1000,  // 5분: 메뉴 구조 변경 빈도 낮음
  gcTime:               30 * 60 * 1000, // 30분 캐시 유지
  refetchOnWindowFocus: false,           // 포커스 재조회 불필요
})
```

**HTTP 상태코드**: 200 / 500

---

### 2.2 GET /api/menus/my — `api/menus/my.ts`

**설명**: 로그인 유저 Role 기반으로 접근 가능한 메뉴만 필터링하여 트리 반환  
**접근 Role**: 로그인 유저 전체 (JWT 필수)  
**파일**: `api/menus/my.ts` (method: GET)

**Request**:
```
GET /api/menus/my
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user_roles": ["USER"],
    "menus": [
      {
        "menu_id": "20000000-0000-0000-0000-000000000001",
        "menu_nm": "홈",
        "menu_url": "/",
        "menu_depth": 1,
        "menu_order": 1,
        "icon_class": "home",
        "read_yn": "Y",
        "write_yn": "N",
        "can_write": false,
        "children": []
      },
      {
        "menu_id": "20000000-0000-0000-0000-000000000002",
        "menu_nm": "업무",
        "menu_url": "/work",
        "menu_depth": 1,
        "menu_order": 2,
        "icon_class": "briefcase",
        "read_yn": "Y",
        "write_yn": "N",
        "can_write": false,
        "children": [
          {
            "menu_id": "20000000-0000-0000-0000-000000000010",
            "menu_nm": "공지사항",
            "menu_url": "/work/notice",
            "menu_depth": 2,
            "menu_order": 1,
            "icon_class": "bell",
            "read_yn": "Y",
            "write_yn": "Y",
            "can_write": true,
            "children": []
          }
        ]
      }
    ]
  }
}
```

**HTTP 상태코드**: 200 / 401 / 500

---

### 2.3 POST /api/menus — `api/menus/index.ts`

**설명**: 메뉴 신규 등록  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/index.ts` (method: POST)

**유효성 검사 항목**:
- `menu_nm` 필수, 1~100자
- `menu_url` 필수, `/`로 시작, 1~255자, DB 중복 불가
- `menu_depth` 필수, `1` 또는 `2`
- `menu_order` 필수, 1~999 정수
- `use_yn` 필수, `Y` 또는 `N`
- `parent_menu_id`: depth=2이면 필수, 존재하는 GNB(depth=1) menu_id여야 함
- `allow_roles` 필수, 배열 최소 1개, 각 role_cd가 `tb_role`에 존재해야 함

**Request Body**:
```json
{
  "menu_nm": "공지사항",
  "menu_url": "/work/notice",
  "parent_menu_id": "20000000-0000-0000-0000-000000000002",
  "menu_depth": 2,
  "menu_order": 1,
  "icon_class": "bell",
  "use_yn": "Y",
  "allow_roles": ["USER", "MANAGER", "ADMIN", "SUPER_ADMIN"]
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "menu_id": "20000000-0000-0000-0000-000000000099",
    "menu_nm": "공지사항",
    "menu_url": "/work/notice",
    "parent_menu_id": "20000000-0000-0000-0000-000000000002",
    "menu_depth": 2,
    "menu_order": 1,
    "icon_class": "bell",
    "use_yn": "Y",
    "created_at": "2026-03-13T09:00:00.000Z"
  },
  "message": "메뉴가 등록되었습니다."
}
```

**Response (409 Conflict - URL 중복)**:
```json
{
  "success": false,
  "error": {
    "code": "MENU_002",
    "message": "이미 존재하는 메뉴 URL입니다.",
    "httpStatus": 409,
    "detail": "menu_url: /work/notice"
  }
}
```

**HTTP 상태코드**: 201 / 400 / 401 / 403 / 409 / 422 / 500

---

### 2.4 PUT /api/menus/:menuId — `api/menus/[menuId].ts`

**설명**: 메뉴 정보 수정  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/[menuId].ts` (method: PUT)

**Request**:
```
PUT /api/menus/20000000-0000-0000-0000-000000000010
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body** (변경할 필드만 전송):
```json
{
  "menu_nm": "공지사항 (개정)",
  "menu_order": 2,
  "use_yn": "N",
  "allow_roles": ["MANAGER", "ADMIN", "SUPER_ADMIN"]
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "menu_id": "20000000-0000-0000-0000-000000000010",
    "menu_nm": "공지사항 (개정)",
    "menu_url": "/work/notice",
    "menu_depth": 2,
    "menu_order": 2,
    "use_yn": "N",
    "updated_at": "2026-03-13T10:00:00.000Z"
  },
  "message": "메뉴가 수정되었습니다."
}
```

**HTTP 상태코드**: 200 / 400 / 401 / 403 / 404 / 409 / 500

---

### 2.5 DELETE /api/menus/:menuId — `api/menus/[menuId].ts`

**설명**: 메뉴 삭제. 하위 LNB가 있으면 422 반환 (cascade 방지).  
**접근 Role**: SUPER_ADMIN  
**파일**: `api/menus/[menuId].ts` (method: DELETE)

**Request**:
```
DELETE /api/menus/20000000-0000-0000-0000-000000000002
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "deleted_menu_id": "20000000-0000-0000-0000-000000000002",
    "menu_nm": "업무"
  },
  "message": "메뉴가 삭제되었습니다."
}
```

**Response (422 - 하위 메뉴 존재)**:
```json
{
  "success": false,
  "error": {
    "code": "MENU_003",
    "message": "하위 메뉴가 존재하여 삭제할 수 없습니다.",
    "httpStatus": 422,
    "detail": "하위 LNB 메뉴 3개가 존재합니다. 먼저 하위 메뉴를 삭제해주세요."
  }
}
```

**HTTP 상태코드**: 200 / 401 / 403 / 404 / 422 / 500

---

### 2.6 PUT /api/menus/order — `api/menus/order.ts`

**설명**: 메뉴 정렬 순서 일괄 변경  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/order.ts` (method: PUT)

**Request Body**:
```json
{
  "items": [
    { "menu_id": "20000000-0000-0000-0000-000000000001", "menu_order": 3 },
    { "menu_id": "20000000-0000-0000-0000-000000000002", "menu_order": 1 },
    { "menu_id": "20000000-0000-0000-0000-000000000003", "menu_order": 2 }
  ]
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": { "updated_count": 3 },
  "message": "메뉴 순서가 변경되었습니다."
}
```

**Response (400 - 존재하지 않는 menu_id 포함)**:
```json
{
  "success": false,
  "error": {
    "code": "MENU_001",
    "message": "존재하지 않는 menu_id가 포함되어 있습니다.",
    "httpStatus": 400,
    "detail": "invalid_ids: [\"99999999-...\"]"
  }
}
```

**HTTP 상태코드**: 200 / 400 / 401 / 403 / 500

---

## 3. 메뉴 업로드 API

### 3.1 POST /api/menus/upload/preview — `api/menus/upload/preview.ts`

**설명**: 프론트에서 SheetJS로 파싱한 행 데이터를 서버에서 2차 유효성 검사 후 미리보기 결과 반환 (저장 없음)  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/upload/preview.ts`

**Request Body**:
```json
{
  "rows": [
    {
      "row_no": 2,
      "menu_nm": "홈",
      "menu_url": "/",
      "parent_menu_id": null,
      "menu_depth": 1,
      "menu_order": 1,
      "icon_class": "home",
      "use_yn": "Y",
      "allow_roles": ["USER", "ADMIN"]
    },
    {
      "row_no": 8,
      "menu_nm": "공지사항",
      "menu_url": "/work/notice",
      "parent_menu_id": "20000000-0000-0000-0000-000000000002",
      "menu_depth": 2,
      "menu_order": 1,
      "icon_class": "bell",
      "use_yn": "Y",
      "allow_roles": ["USER"]
    }
  ],
  "upload_type": "MENU"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_cnt": 15,
      "valid_cnt": 12,
      "error_cnt": 3
    },
    "valid_rows": [
      {
        "row_no": 2,
        "menu_nm": "홈",
        "menu_url": "/",
        "menu_depth": 1,
        "menu_order": 1
      }
    ],
    "invalid_rows": [
      {
        "row_no": 8,
        "raw_data": {
          "menu_nm": "공지사항",
          "menu_url": "/work/notice"
        },
        "errors": [
          {
            "column_nm": "menu_url",
            "error_cd": "ERR_DUPLICATE_DB",
            "error_msg": "메뉴URL(/work/notice)이 이미 등록되어 있습니다."
          }
        ]
      }
    ]
  }
}
```

**HTTP 상태코드**: 200 / 400 / 401 / 403 / 422

---

### 3.2 POST /api/menus/upload/confirm — `api/menus/upload/confirm.ts`

**설명**: 유효 행을 Supabase에 저장. `ALL_OR_NOTHING` / `PARTIAL_SUCCESS` 모드 지원.  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/upload/confirm.ts`

**Request Body**:
```json
{
  "rows": [
    {
      "row_no": 2,
      "menu_nm": "홈",
      "menu_url": "/",
      "parent_menu_id": null,
      "menu_depth": 1,
      "menu_order": 1,
      "icon_class": "home",
      "use_yn": "Y",
      "allow_roles": ["USER", "ADMIN", "MANAGER", "SUPER_ADMIN"]
    }
  ],
  "error_rows": [
    {
      "row_no": 8,
      "raw_data": { "menu_nm": "공지사항", "menu_url": "/work/notice" },
      "errors": [
        {
          "column_nm": "menu_url",
          "error_cd": "ERR_DUPLICATE_DB",
          "error_msg": "메뉴URL이 이미 등록되어 있습니다."
        }
      ]
    }
  ],
  "mode": "PARTIAL_SUCCESS",
  "file_nm": "menu_batch_20260313.xlsx",
  "upload_type": "MENU",
  "total_cnt": 15
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "log_id": "30000000-0000-0000-0000-000000000010",
    "summary": {
      "total_cnt": 15,
      "success_cnt": 12,
      "fail_cnt": 3,
      "skip_cnt": 0,
      "status": "PARTIAL"
    },
    "errors": [
      {
        "row_no": 8,
        "column_nm": "menu_url",
        "error_cd": "ERR_DUPLICATE_DB",
        "error_msg": "메뉴URL(/work/notice)이 이미 등록되어 있습니다."
      }
    ]
  },
  "message": "업로드 완료. 12건 성공, 3건 실패."
}
```

**Response (400 - ALL_OR_NOTHING 전체 취소)**:
```json
{
  "success": false,
  "error": {
    "code": "UPLOAD_004",
    "message": "ALL_OR_NOTHING 모드에서 유효성 오류가 발견되어 전체 저장이 취소되었습니다.",
    "httpStatus": 400,
    "detail": {
      "error_cnt": 3,
      "errors": [
        {
          "row_no": 8,
          "error_cd": "ERR_DUPLICATE_DB",
          "error_msg": "메뉴URL(/work/notice)이 이미 등록되어 있습니다."
        }
      ]
    }
  }
}
```

> **Supabase 트랜잭션 처리 방법**  
> Supabase JS SDK는 클라이언트 레벨 `BEGIN/COMMIT` 미지원.  
> - **ALL_OR_NOTHING**: `supabase.rpc('fn_bulk_insert_menus', { rows_json })` 단일 PostgreSQL 함수로 원자적 처리.  
> - **PARTIAL_SUCCESS**: 건별 upsert 루프 실행 후 실패 행 수집.  
> - 두 모드 모두 `tb_menu_upload_log` + `tb_menu_upload_error` 이력 저장.

**HTTP 상태코드**: 200 / 400 / 401 / 403 / 500

---

### 3.3 GET /api/menus/upload/logs — `api/menus/upload/logs/index.ts`

**설명**: 엑셀 업로드 이력 목록 (페이지네이션)  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/upload/logs/index.ts`

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| page | number | 선택 | 1 | 페이지 번호 |
| limit | number | 선택 | 20 | 페이지당 건수 (최대 100) |
| status | string | 선택 | - | SUCCESS / FAIL / PARTIAL |
| from | string | 선택 | 30일전 | 시작일 (YYYY-MM-DD) |
| to | string | 선택 | 오늘 | 종료일 (YYYY-MM-DD) |

**Request**:
```
GET /api/menus/upload/logs?page=1&limit=20&status=PARTIAL
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "log_id": "30000000-0000-0000-0000-000000000010",
        "file_nm": "menu_batch_20260313.xlsx",
        "upload_type": "MENU",
        "total_cnt": 15,
        "success_cnt": 12,
        "fail_cnt": 3,
        "status": "PARTIAL",
        "uploader": {
          "id": "00000000-0000-0000-0000-000000000002",
          "username": "관리자",
          "email": "admin@company.com"
        },
        "created_at": "2026-03-13T09:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 48,
      "page": 1,
      "limit": 20,
      "total_pages": 3
    }
  }
}
```

**HTTP 상태코드**: 200 / 401 / 403 / 500

---

### 3.4 GET /api/menus/upload/logs/:logId/errors — `api/menus/upload/logs/[logId].ts`

**설명**: 특정 업로드 이력의 오류 상세 목록  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/upload/logs/[logId].ts`

**Request**:
```
GET /api/menus/upload/logs/30000000-0000-0000-0000-000000000010/errors
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "log_id": "30000000-0000-0000-0000-000000000010",
    "file_nm": "menu_batch_20260313.xlsx",
    "total_errors": 3,
    "errors": [
      {
        "error_id": "40000000-0000-0000-0000-000000000001",
        "row_no": 8,
        "column_nm": "menu_url",
        "error_cd": "ERR_DUPLICATE_DB",
        "error_msg": "메뉴URL(/work/notice)이 이미 등록되어 있습니다.",
        "raw_data": {
          "menu_nm": "공지사항",
          "menu_url": "/work/notice",
          "menu_depth": 2,
          "allow_roles": "USER"
        },
        "created_at": "2026-03-13T09:30:01.000Z"
      },
      {
        "error_id": "40000000-0000-0000-0000-000000000002",
        "row_no": 12,
        "column_nm": "allow_roles",
        "error_cd": "ERR_REF_ROLE",
        "error_msg": "허용ROLE코드 'SUPERUSER'는 존재하지 않습니다.",
        "raw_data": {
          "menu_nm": "설정",
          "menu_url": "/admin/settings",
          "allow_roles": "SUPERUSER"
        },
        "created_at": "2026-03-13T09:30:01.000Z"
      }
    ]
  }
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": {
    "code": "UPLOAD_005",
    "message": "업로드 이력을 찾을 수 없습니다.",
    "httpStatus": 404,
    "detail": "logId: 30000000-0000-0000-0000-000000000099"
  }
}
```

**HTTP 상태코드**: 200 / 401 / 403 / 404 / 500

---

### 3.5 GET /api/menus/upload/template — `api/menus/upload/template.ts`

**설명**: 메뉴 업로드용 엑셀 템플릿 동적 생성 후 다운로드  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menus/upload/template.ts`

**Request**:
```
GET /api/menus/upload/template
Authorization: Bearer {jwt_token}
```

**Response**:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="menu_upload_template.xlsx"`
- Body: xlsx Binary Buffer

```typescript
// api/menus/upload/template.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';
import { withAuth, allowMethods } from '../../../lib/checkRole';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default withAuth(['SUPER_ADMIN', 'ADMIN'], async (req, res) => {
  if (!allowMethods(['GET'], req, res)) return;

  // DB에서 현재 활성 Role 목록 동적 조회 (시트 3에 표시)
  const { data: roles } = await supabaseAdmin
    .from('tb_role')
    .select('role_cd, role_nm')
    .eq('use_yn', 'Y')
    .order('sort_order');

  const wb = XLSX.utils.book_new();

  // ── 시트 1: 메뉴 등록 양식 ──
  const HEADER = [
    'menu_id', 'menu_nm', 'menu_url', 'parent_menu_id',
    'menu_depth', 'menu_order', 'icon_class', 'use_yn', 'allow_roles',
  ];
  const EXAMPLE_ROWS = [
    ['',  '홈',       '/',              '',               1, 1, 'home',      'Y', 'USER,ADMIN'],
    ['',  '업무',     '/work',          '',               1, 2, 'briefcase', 'Y', 'USER,ADMIN'],
    ['',  '공지사항', '/work/notice',   '(상위GNB UUID)', 2, 1, 'bell',      'Y', 'USER'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([HEADER, ...EXAMPLE_ROWS]);
  ws1['!cols'] = [
    { wch: 36 }, { wch: 20 }, { wch: 30 }, { wch: 36 },
    { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 8  }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '메뉴등록양식');

  // ── 시트 2: 작성 방법 안내 ──
  const GUIDE = [
    ['컬럼명',         '필수',   '설명',                                         '예시'],
    ['menu_id',        '선택',   '수정 시 기존 UUID 입력. 신규 등록 시 빈값.',   ''],
    ['menu_nm',        '필수',   '메뉴 표시명 (최대 100자)',                     '공지사항'],
    ['menu_url',       '필수',   '/로 시작 (최대 255자). 중복 불가.',            '/work/notice'],
    ['parent_menu_id', '조건부', 'depth=2(LNB)이면 상위 GNB의 menu_id 필수.',   ''],
    ['menu_depth',     '필수',   '1=GNB, 2=LNB',                                '2'],
    ['menu_order',     '필수',   '정렬 순서 정수 (1~999)',                       '1'],
    ['icon_class',     '선택',   '아이콘 클래스명 (최대 100자)',                 'bell'],
    ['use_yn',         '필수',   'Y 또는 N',                                    'Y'],
    ['allow_roles',    '필수',   '콤마 구분 Role 코드. 최소 1개.',               'USER,ADMIN'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(GUIDE);
  ws2['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 50 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, '작성방법안내');

  // ── 시트 3: Role 코드 목록 (DB 동적 로드) ──
  const ROLE_DATA = [
    ['role_cd', 'role_nm'],
    ...(roles ?? []).map((r: any) => [r.role_cd, r.role_nm]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(ROLE_DATA);
  ws3['!cols'] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Role코드목록');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="menu_upload_template.xlsx"'
  );
  res.status(200).send(buf);
});
```

**HTTP 상태코드**: 200 / 401 / 403 / 500

---

## 4. Role API

### 4.1 GET /api/roles — `api/roles/index.ts`

**설명**: 전체 Role 목록 조회 (사용자 수·메뉴 수 집계 포함)  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/roles/index.ts` (method: GET)

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| use_yn | string | 선택 | - | Y/N 필터 (없으면 전체) |

**Request**:
```
GET /api/roles
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "role_id": "10000000-0000-0000-0000-000000000001",
        "role_cd": "SUPER_ADMIN",
        "role_nm": "슈퍼관리자",
        "role_desc": "시스템 전체 관리 권한",
        "role_color": "#E74C3C",
        "sort_order": 1,
        "use_yn": "Y",
        "is_system": true,
        "user_count": 2,
        "menu_count": 48,
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": null
      },
      {
        "role_id": "10000000-0000-0000-0000-000000000002",
        "role_cd": "ADMIN",
        "role_nm": "관리자",
        "role_desc": "운영 관리 권한",
        "role_color": "#E67E22",
        "sort_order": 2,
        "use_yn": "Y",
        "is_system": true,
        "user_count": 15,
        "menu_count": 36,
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": null
      },
      {
        "role_id": "10000000-0000-0000-0000-000000000003",
        "role_cd": "MANAGER",
        "role_nm": "매니저",
        "role_desc": "부서 관리 권한",
        "role_color": "#2980B9",
        "sort_order": 3,
        "use_yn": "Y",
        "is_system": false,
        "user_count": 42,
        "menu_count": 24,
        "created_at": "2026-01-15T09:00:00.000Z",
        "updated_at": null
      },
      {
        "role_id": "10000000-0000-0000-0000-000000000004",
        "role_cd": "USER",
        "role_nm": "일반사용자",
        "role_desc": "기본 사용 권한",
        "role_color": "#27AE60",
        "sort_order": 99,
        "use_yn": "Y",
        "is_system": true,
        "user_count": 9842,
        "menu_count": 12,
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": null
      }
    ]
  }
}
```

**HTTP 상태코드**: 200 / 401 / 403 / 500

---

### 4.2 POST /api/roles — `api/roles/index.ts`

**설명**: 신규 Role 등록  
**접근 Role**: SUPER_ADMIN  
**파일**: `api/roles/index.ts` (method: POST)

**유효성 검사 항목**:
- `role_cd` 필수, 영대문자+언더스코어만 허용 (`^[A-Z_]+$`), 최대 50자, DB 중복 불가
- `role_nm` 필수, 최대 100자
- `use_yn` 필수, `Y` 또는 `N`
- `sort_order` 선택, 1~999 정수 (없으면 자동 max+1)
- `role_color` 선택, HEX 컬러 형식 (`#RRGGBB`)

**Request Body**:
```json
{
  "role_cd": "DEPT_LEAD",
  "role_nm": "부서장",
  "role_desc": "부서장 이상 접근 가능",
  "role_color": "#8E44AD",
  "sort_order": 4,
  "use_yn": "Y"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "role_id": "10000000-0000-0000-0000-000000000010",
    "role_cd": "DEPT_LEAD",
    "role_nm": "부서장",
    "role_desc": "부서장 이상 접근 가능",
    "role_color": "#8E44AD",
    "sort_order": 4,
    "use_yn": "Y",
    "is_system": false,
    "created_at": "2026-03-13T11:00:00.000Z"
  },
  "message": "Role이 등록되었습니다."
}
```

**Response (409 Conflict - role_cd 중복)**:
```json
{
  "success": false,
  "error": {
    "code": "ROLE_002",
    "message": "이미 존재하는 Role 코드입니다.",
    "httpStatus": 409,
    "detail": "role_cd: DEPT_LEAD"
  }
}
```

**HTTP 상태코드**: 201 / 400 / 401 / 403 / 409 / 500

---

### 4.3 PUT /api/roles/:roleId — `api/roles/[roleId].ts`

**설명**: Role 정보 수정 (`role_cd`는 수정 불가 — 시스템 코드로 참조됨)  
**접근 Role**: SUPER_ADMIN  
**파일**: `api/roles/[roleId].ts` (method: PUT)

**Request**:
```
PUT /api/roles/10000000-0000-0000-0000-000000000010
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "role_nm": "부서장·팀장",
  "role_desc": "부서장 및 팀장 역할 통합",
  "role_color": "#7D3C98",
  "sort_order": 3,
  "use_yn": "Y"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "role_id": "10000000-0000-0000-0000-000000000010",
    "role_cd": "DEPT_LEAD",
    "role_nm": "부서장·팀장",
    "role_desc": "부서장 및 팀장 역할 통합",
    "role_color": "#7D3C98",
    "sort_order": 3,
    "use_yn": "Y",
    "updated_at": "2026-03-13T12:00:00.000Z"
  },
  "message": "Role이 수정되었습니다."
}
```

**HTTP 상태코드**: 200 / 400 / 401 / 403 / 404 / 500

---

### 4.4 DELETE /api/roles/:roleId — `api/roles/[roleId].ts`

**설명**: Role 삭제. 시스템 Role(`is_system=true`) 또는 사용 중인 Role(소속 사용자 존재)은 삭제 불가.  
**접근 Role**: SUPER_ADMIN  
**파일**: `api/roles/[roleId].ts` (method: DELETE)

**Request**:
```
DELETE /api/roles/10000000-0000-0000-0000-000000000010
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "deleted_role_id": "10000000-0000-0000-0000-000000000010",
    "role_cd": "DEPT_LEAD",
    "role_nm": "부서장·팀장"
  },
  "message": "Role이 삭제되었습니다."
}
```

**Response (422 - 시스템 Role 삭제 시도)**:
```json
{
  "success": false,
  "error": {
    "code": "ROLE_003",
    "message": "시스템 기본 Role은 삭제할 수 없습니다.",
    "httpStatus": 422,
    "detail": "role_cd: SUPER_ADMIN (is_system: true)"
  }
}
```

**Response (422 - 사용 중인 Role)**:
```json
{
  "success": false,
  "error": {
    "code": "ROLE_004",
    "message": "사용 중인 Role입니다 (소속 사용자 존재).",
    "httpStatus": 422,
    "detail": "소속 사용자 42명이 있습니다. 먼저 해당 사용자의 Role을 회수해주세요."
  }
}
```

**HTTP 상태코드**: 200 / 401 / 403 / 404 / 422 / 500

---

## 5. 메뉴-Role 매핑 API

### 5.1 GET /api/menu-roles — `api/menu-roles/index.ts`

**설명**: 메뉴 × Role 권한 매트릭스 조회 (관리 화면용 전체 매핑 현황)  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/menu-roles/index.ts` (method: GET)

**Request**:
```
GET /api/menu-roles
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "roles": [
      { "role_id": "10000000-0000-0000-0000-000000000001", "role_cd": "SUPER_ADMIN", "role_nm": "슈퍼관리자" },
      { "role_id": "10000000-0000-0000-0000-000000000002", "role_cd": "ADMIN",       "role_nm": "관리자" },
      { "role_id": "10000000-0000-0000-0000-000000000004", "role_cd": "USER",        "role_nm": "일반사용자" }
    ],
    "matrix": [
      {
        "menu_id": "20000000-0000-0000-0000-000000000001",
        "menu_nm": "홈",
        "menu_depth": 1,
        "menu_order": 1,
        "permissions": {
          "10000000-0000-0000-0000-000000000001": { "read_yn": "Y", "write_yn": "Y" },
          "10000000-0000-0000-0000-000000000002": { "read_yn": "Y", "write_yn": "Y" },
          "10000000-0000-0000-0000-000000000004": { "read_yn": "Y", "write_yn": "N" }
        }
      },
      {
        "menu_id": "20000000-0000-0000-0000-000000000002",
        "menu_nm": "업무",
        "menu_depth": 1,
        "menu_order": 2,
        "permissions": {
          "10000000-0000-0000-0000-000000000001": { "read_yn": "Y", "write_yn": "Y" },
          "10000000-0000-0000-0000-000000000002": { "read_yn": "Y", "write_yn": "Y" },
          "10000000-0000-0000-0000-000000000004": { "read_yn": "Y", "write_yn": "N" }
        }
      },
      {
        "menu_id": "20000000-0000-0000-0000-000000000010",
        "menu_nm": "공지사항",
        "menu_depth": 2,
        "menu_order": 1,
        "permissions": {
          "10000000-0000-0000-0000-000000000001": { "read_yn": "Y", "write_yn": "Y" },
          "10000000-0000-0000-0000-000000000002": { "read_yn": "Y", "write_yn": "Y" },
          "10000000-0000-0000-0000-000000000004": { "read_yn": "Y", "write_yn": "N" }
        }
      }
    ]
  }
}
```

> `permissions` 키: `role_id`  
> 해당 role_id 매핑 없으면 해당 키 자체 누락 (= 접근 불가)

**HTTP 상태코드**: 200 / 401 / 403 / 500

---

### 5.2 POST /api/menu-roles/batch — `api/menu-roles/batch.ts`

**설명**: 메뉴-Role 매핑 일괄 저장 (UPSERT). 기존 매핑 전체 삭제 후 재삽입 방식이 아닌, 전달된 항목만 UPSERT 처리.  
**접근 Role**: SUPER_ADMIN  
**파일**: `api/menu-roles/batch.ts` (method: POST)

**Request Body**:
```json
{
  "items": [
    {
      "menu_id": "20000000-0000-0000-0000-000000000001",
      "role_id": "10000000-0000-0000-0000-000000000004",
      "read_yn": "Y",
      "write_yn": "N"
    },
    {
      "menu_id": "20000000-0000-0000-0000-000000000010",
      "role_id": "10000000-0000-0000-0000-000000000002",
      "read_yn": "Y",
      "write_yn": "Y"
    }
  ],
  "delete_items": [
    {
      "menu_id": "20000000-0000-0000-0000-000000000099",
      "role_id": "10000000-0000-0000-0000-000000000004"
    }
  ]
}
```

> `delete_items`: 권한 제거할 항목 배열 (선택)  
> UPSERT 기준: `(menu_id, role_id)` UNIQUE KEY

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "upserted_count": 2,
    "deleted_count": 1
  },
  "message": "메뉴-Role 매핑이 저장되었습니다."
}
```

**Response (422 - 존재하지 않는 menu_id/role_id)**:
```json
{
  "success": false,
  "error": {
    "code": "COMMON_001",
    "message": "잘못된 요청 파라미터입니다.",
    "httpStatus": 400,
    "detail": "존재하지 않는 role_id: [\"10000000-0000-0000-0000-000000000099\"]"
  }
}
```

**HTTP 상태코드**: 200 / 400 / 401 / 403 / 500

---

## 6. 사용자-Role API

### 6.1 GET /api/users/:userId/roles — `api/users/[userId]/roles/index.ts`

**설명**: 특정 사용자의 Role 목록 조회 (현재 활성 + 만료 포함)  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/users/[userId]/roles/index.ts` (method: GET)

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| active_only | boolean | 선택 | false | true이면 만료·비활성 제외 |

**Request**:
```
GET /api/users/00000000-0000-0000-0000-000000000005/roles
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user_id": "00000000-0000-0000-0000-000000000005",
    "username": "홍길동",
    "email": "hong@company.com",
    "roles": [
      {
        "user_role_id": "50000000-0000-0000-0000-000000000001",
        "role_id": "10000000-0000-0000-0000-000000000003",
        "role_cd": "MANAGER",
        "role_nm": "매니저",
        "role_color": "#2980B9",
        "start_dt": "2026-01-01",
        "end_dt": null,
        "use_yn": "Y",
        "granted_by": {
          "id": "00000000-0000-0000-0000-000000000001",
          "username": "슈퍼관리자"
        },
        "created_at": "2026-01-01T09:00:00.000Z"
      },
      {
        "user_role_id": "50000000-0000-0000-0000-000000000002",
        "role_id": "10000000-0000-0000-0000-000000000004",
        "role_cd": "USER",
        "role_nm": "일반사용자",
        "role_color": "#27AE60",
        "start_dt": "2026-01-01",
        "end_dt": "2026-12-31",
        "use_yn": "Y",
        "granted_by": {
          "id": "00000000-0000-0000-0000-000000000002",
          "username": "관리자"
        },
        "created_at": "2026-01-01T09:00:00.000Z"
      }
    ]
  }
}
```

**HTTP 상태코드**: 200 / 401 / 403 / 404 / 500

---

### 6.2 POST /api/users/:userId/roles — `api/users/[userId]/roles/index.ts`

**설명**: 사용자에게 Role 부여. 중복 부여 불가. `tb_permission_log`에 GRANT 이력 저장.  
**접근 Role**: SUPER_ADMIN, ADMIN  
**파일**: `api/users/[userId]/roles/index.ts` (method: POST)

**Request Body**:
```json
{
  "role_id": "10000000-0000-0000-0000-000000000003",
  "start_dt": "2026-03-13",
  "end_dt": null,
  "remark": "부서 이동으로 인한 MANAGER Role 부여"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "user_role_id": "50000000-0000-0000-0000-000000000010",
    "user_id": "00000000-0000-0000-0000-000000000005",
    "role_id": "10000000-0000-0000-0000-000000000003",
    "role_cd": "MANAGER",
    "role_nm": "매니저",
    "start_dt": "2026-03-13",
    "end_dt": null,
    "use_yn": "Y",
    "granted_by": "00000000-0000-0000-0000-000000000002",
    "created_at": "2026-03-13T14:00:00.000Z"
  },
  "message": "Role이 부여되었습니다."
}
```

**Response (409 - 이미 활성 상태로 부여된 Role)**:
```json
{
  "success": false,
  "error": {
    "code": "USER_002",
    "message": "이미 부여된 Role입니다.",
    "httpStatus": 409,
    "detail": "role_cd: MANAGER (유효기간: 2026-01-01 ~ 무기한)"
  }
}
```

> **`tb_permission_log` GRANT 이력 저장**:
> ```typescript
> await supabaseAdmin.from('tb_permission_log').insert({
>   target_user_id: userId,
>   action_type:    'GRANT',
>   role_id:        body.role_id,
>   role_cd_snap:   role.role_cd,         // 삭제 후에도 이력 보존
>   before_state:   null,
>   after_state: {
>     user_role_id: newUserRole.user_role_id,
>     start_dt:     body.start_dt,
>     end_dt:       body.end_dt ?? null,
>   },
>   acted_by: req.user.id,
>   remark:   body.remark ?? null,
> });
> ```

**HTTP 상태코드**: 201 / 400 / 401 / 403 / 404 / 409 / 500

---

### 6.3 DELETE /api/users/:userId/roles/:roleId — `api/users/[userId]/roles/[roleId].ts`

**설명**: 사용자 Role 회수 (논리 삭제: `use_yn='N'` + `end_dt=오늘`). `tb_permission_log`에 REVOKE 이력 저장. 본인 Role 회수 불가.  
**접근 Role**: SUPER_ADMIN  
**파일**: `api/users/[userId]/roles/[roleId].ts` (method: DELETE)

**Request**:
```
DELETE /api/users/00000000-0000-0000-0000-000000000005/roles/50000000-0000-0000-0000-000000000010
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "revoked_user_role_id": "50000000-0000-0000-0000-000000000010",
    "user_id": "00000000-0000-0000-0000-000000000005",
    "role_cd": "MANAGER",
    "revoked_at": "2026-03-13"
  },
  "message": "Role이 회수되었습니다."
}
```

**Response (403 - 본인 Role 회수 시도)**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "본인 계정의 Role은 변경할 수 없습니다.",
    "httpStatus": 403
  }
}
```

> **`tb_permission_log` REVOKE 이력 저장**:
> ```typescript
> await supabaseAdmin.from('tb_permission_log').insert({
>   target_user_id: userId,
>   action_type:    'REVOKE',
>   role_id:        userRoleRow.role_id,
>   role_cd_snap:   userRoleRow.tb_role.role_cd,
>   before_state: {
>     user_role_id: userRoleRow.user_role_id,
>     start_dt:     userRoleRow.start_dt,
>     end_dt:       userRoleRow.end_dt,
>     use_yn:       'Y',
>   },
>   after_state: {
>     use_yn: 'N',
>     end_dt:  today,
>   },
>   acted_by: req.user.id,
>   remark:   null,
> });
> ```

**HTTP 상태코드**: 200 / 401 / 403 / 404 / 500

---

## 7. 핵심 코드 예시 (TypeScript)

### 7.1 `/lib/supabaseClient.ts` — 전체 코드

```typescript
// /lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabaseClient] 필수 환경변수 누락');
}

/** Admin 클라이언트 (service_role — RLS 우회, 서버 전용) */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth:   { autoRefreshToken: false, persistSession: false },
    db:     { schema: 'public' },
    global: { headers: { 'x-application-name': 'kks-portal-api' } },
  }
);

/** Anon 클라이언트 (RLS 정책 적용) */
export const supabaseAnon: SupabaseClient = createClient(
  SUPABASE_URL!,
  SUPABASE_ANON_KEY ?? ''
);
```

---

### 7.2 `/lib/authMiddleware.ts` — 전체 코드

```typescript
// /lib/authMiddleware.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseClient';
import { ERROR_CODES } from './errorCodes';

export interface AuthUser {
  id:    string;
  email: string;
  roles: string[];
}

export type AuthedRequest = VercelRequest & { user: AuthUser };

export async function verifyJWT(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthUser | null> {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: ERROR_CODES.AUTH_001 });
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      error: { ...ERROR_CODES.AUTH_001, detail: '토큰 값이 비어있습니다.' },
    });
    return null;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    const isExpired =
      error?.message?.toLowerCase().includes('expired') ||
      error?.message?.toLowerCase().includes('jwt expired');
    res.status(401).json({
      success: false,
      error: isExpired ? ERROR_CODES.AUTH_002 : ERROR_CODES.AUTH_001,
    });
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const { data: roleRows, error: roleErr } = await supabaseAdmin
    .from('tb_user_role')
    .select('tb_role(role_cd)')
    .eq('user_id', user.id)
    .eq('use_yn', 'Y')
    .or(`end_dt.is.null,end_dt.gte.${today}`);

  if (roleErr) {
    console.error('[verifyJWT] Role 조회 실패:', roleErr.message);
    res.status(500).json({ success: false, error: ERROR_CODES.DB_001 });
    return null;
  }

  const roles = (roleRows ?? [])
    .map((r: any) => r.tb_role?.role_cd as string | undefined)
    .filter((cd): cd is string => Boolean(cd));

  return { id: user.id, email: user.email ?? '', roles };
}
```

---

### 7.3 `/lib/checkRole.ts` — 전체 코드

```typescript
// /lib/checkRole.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyJWT, AuthUser, AuthedRequest } from './authMiddleware';
import { ERROR_CODES } from './errorCodes';

export type AuthedHandler = (
  req: AuthedRequest,
  res: VercelResponse
) => Promise<void> | void;

export function allowMethods(
  allowed: string[],
  req: VercelRequest,
  res: VercelResponse
): boolean {
  if (!allowed.includes(req.method ?? '')) {
    res.status(405).json({
      success: false,
      error: {
        ...ERROR_CODES.COMMON_002,
        detail: `허용: [${allowed.join(', ')}] / 요청: ${req.method}`,
      },
    });
    return false;
  }
  return true;
}

/**
 * withAuth - JWT 검증 + Role 체크 통합 HOF
 * @param allowedRoles null이면 인증만 체크 (모든 로그인 유저 허용)
 */
export function withAuth(
  allowedRoles: string[] | null,
  handler: AuthedHandler
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const user = await verifyJWT(req, res);
    if (!user) return;

    if (allowedRoles && allowedRoles.length > 0) {
      const isSuperAdmin   = user.roles.includes('SUPER_ADMIN');
      const hasAllowedRole = allowedRoles.some((r) => user.roles.includes(r));
      if (!isSuperAdmin && !hasAllowedRole) {
        res.status(403).json({
          success: false,
          error: {
            ...ERROR_CODES.AUTH_003,
            detail: `필요: [${allowedRoles.join(', ')}] / 현재: [${user.roles.join(', ')}]`,
          },
        });
        return;
      }
    }

    (req as AuthedRequest).user = user;
    await handler(req as AuthedRequest, res);
  };
}

export function checkRole(
  allowedRoles: string[],
  user: AuthUser,
  res: VercelResponse
): boolean {
  const isSuperAdmin   = user.roles.includes('SUPER_ADMIN');
  const hasAllowedRole = allowedRoles.some((r) => user.roles.includes(r));
  if (!isSuperAdmin && !hasAllowedRole) {
    res.status(403).json({
      success: false,
      error: {
        ...ERROR_CODES.AUTH_003,
        detail: `필요: [${allowedRoles.join(', ')}] / 현재: [${user.roles.join(', ')}]`,
      },
    });
    return false;
  }
  return true;
}
```

---

### 7.4 `/lib/types.ts` — 전체 코드

> 섹션 **1.6** 에 전체 코드 수록되어 있습니다. (중복 생략)

---

### 7.5 `/api/menus/my.ts` — 핵심 구현 코드

Role 기반 메뉴 필터링 로직 전체 흐름:

```typescript
// /api/menus/my.ts
import type { VercelResponse } from '@vercel/node';
import { withAuth, allowMethods } from '../../lib/checkRole';
import { supabaseAdmin }           from '../../lib/supabaseClient';
import type { AuthedRequest }      from '../../lib/authMiddleware';
import type { MenuWithPermission } from '../../lib/types';

export default withAuth(null, async (req: AuthedRequest, res: VercelResponse) => {
  if (!allowMethods(['GET'], req, res)) return;

  const { user } = req;

  try {
    // 1. 사용자 활성 Role ID 목록 조회
    const today = new Date().toISOString().split('T')[0];
    const { data: userRoles, error: urErr } = await supabaseAdmin
      .from('tb_user_role')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('use_yn', 'Y')
      .or(`end_dt.is.null,end_dt.gte.${today}`);

    if (urErr) throw urErr;

    const roleIds = (userRoles ?? []).map((r: any) => r.role_id as string);

    if (roleIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: { user_roles: [], menus: [] },
      });
    }

    // 2. 해당 Role의 메뉴-권한 조회 (tb_menu JOIN tb_menu_role)
    const { data: menuRoles, error: mrErr } = await supabaseAdmin
      .from('tb_menu_role')
      .select(`
        read_yn,
        write_yn,
        tb_menu!inner (
          menu_id, menu_nm, menu_url, parent_menu_id,
          menu_depth, menu_order, icon_class, use_yn
        )
      `)
      .in('role_id', roleIds)
      .eq('tb_menu.use_yn', 'Y');

    if (mrErr) throw mrErr;

    // 3. menu_id 기준으로 최대 권한 병합 (여러 Role 소지 시 OR 병합)
    const permMap = new Map<string, {
      menu: any;
      read_yn: 'Y' | 'N';
      write_yn: 'Y' | 'N';
    }>();

    for (const row of (menuRoles ?? [])) {
      const menu = row.tb_menu as any;
      const existing = permMap.get(menu.menu_id);
      if (!existing) {
        permMap.set(menu.menu_id, {
          menu,
          read_yn:  row.read_yn  as 'Y' | 'N',
          write_yn: row.write_yn as 'Y' | 'N',
        });
      } else {
        // OR 병합: 어느 Role이라도 Y이면 Y
        if (row.read_yn  === 'Y') existing.read_yn  = 'Y';
        if (row.write_yn === 'Y') existing.write_yn = 'Y';
      }
    }

    // 4. 트리 구조 변환 (GNB → LNB)
    const allItems = Array.from(permMap.values());

    const buildTree = (parentId: string | null): MenuWithPermission[] => {
      return allItems
        .filter((i) => i.menu.parent_menu_id === parentId)
        .sort((a, b) => a.menu.menu_order - b.menu.menu_order)
        .map((i) => ({
          ...i.menu,
          read_yn:   i.read_yn,
          write_yn:  i.write_yn,
          can_write: i.write_yn === 'Y',
          children:  buildTree(i.menu.menu_id),
        }));
    };

    const menus = buildTree(null);

    return res.status(200).json({
      success: true,
      data: { user_roles: user.roles, menus },
    });
  } catch (err: any) {
    console.error('[GET /api/menus/my]', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'DB_001', message: '데이터베이스 오류', httpStatus: 500 },
    });
  }
});
```

---

### 7.6 `/api/menus/upload/confirm.ts` — 트랜잭션 처리 코드

ALL_OR_NOTHING / PARTIAL_SUCCESS 완전 분기 구현:

```typescript
// /api/menus/upload/confirm.ts
import type { VercelResponse } from '@vercel/node';
import { withAuth, allowMethods } from '../../../lib/checkRole';
import { supabaseAdmin }          from '../../../lib/supabaseClient';
import { makeError }              from '../../../lib/errorCodes';
import type { AuthedRequest }     from '../../../lib/authMiddleware';
import type {
  MenuUploadRow, UploadErrorRow, UploadMode,
} from '../../../lib/types';

interface ConfirmBody {
  rows:        MenuUploadRow[];
  error_rows:  UploadErrorRow[];
  mode:        UploadMode;
  file_nm:     string;
  upload_type: string;
  total_cnt:   number;
}

export default withAuth(['SUPER_ADMIN', 'ADMIN'], async (req: AuthedRequest, res: VercelResponse) => {
  if (!allowMethods(['POST'], req, res)) return;

  const body = req.body as ConfirmBody;
  const { rows, error_rows = [], mode, file_nm, total_cnt } = body;

  // ── ALL_OR_NOTHING: 오류 행 존재 시 전체 취소 ──
  if (mode === 'ALL_OR_NOTHING' && error_rows.length > 0) {
    return res.status(400).json(
      makeError('UPLOAD_004', {
        error_cnt: error_rows.length,
        errors: error_rows.map((e) => ({
          row_no:   e.row_no,
          error_cd: e.errors[0]?.error_cd,
          error_msg: e.errors[0]?.error_msg,
        })),
      })
    );
  }

  // ── 업로드 이력 생성 (진행 중 상태로 선 저장) ──
  const { data: logRow, error: logErr } = await supabaseAdmin
    .from('tb_menu_upload_log')
    .insert({
      file_nm,
      upload_type:    body.upload_type ?? 'MENU',
      total_cnt,
      success_cnt:    0,
      fail_cnt:       error_rows.length,
      skip_cnt:       0,
      status:         'FAIL', // 완료 후 UPDATE
      upload_user_id: req.user.id,
    })
    .select('log_id')
    .single();

  if (logErr || !logRow) {
    return res.status(500).json(makeError('DB_001'));
  }

  const logId = logRow.log_id as string;

  // ── 오류 행 저장 ──
  if (error_rows.length > 0) {
    const errorInserts = error_rows.flatMap((e) =>
      e.errors.map((err) => ({
        log_id:    logId,
        row_no:    e.row_no,
        column_nm: err.column_nm,
        error_cd:  err.error_cd,
        error_msg: err.error_msg,
        raw_data:  e.raw_data,
      }))
    );
    await supabaseAdmin.from('tb_menu_upload_error').insert(errorInserts);
  }

  // ── ALL_OR_NOTHING: 단일 RPC로 원자적 저장 ──
  if (mode === 'ALL_OR_NOTHING') {
    const { error: rpcErr } = await supabaseAdmin.rpc('fn_bulk_upsert_menus', {
      rows_json: JSON.stringify(rows),
    });

    if (rpcErr) {
      await supabaseAdmin
        .from('tb_menu_upload_log')
        .update({ status: 'FAIL', fail_cnt: total_cnt })
        .eq('log_id', logId);
      return res.status(500).json(makeError('DB_001', rpcErr.message));
    }

    await supabaseAdmin
      .from('tb_menu_upload_log')
      .update({ status: 'SUCCESS', success_cnt: rows.length, fail_cnt: 0 })
      .eq('log_id', logId);

    return res.status(200).json({
      success: true,
      data: {
        log_id:  logId,
        summary: { total_cnt, success_cnt: rows.length, fail_cnt: 0, skip_cnt: 0, status: 'SUCCESS' },
        errors:  [],
      },
      message: `업로드 완료. ${rows.length}건 성공.`,
    });
  }

  // ── PARTIAL_SUCCESS: 건별 upsert 루프 ──
  let successCnt = 0;
  const runtimeErrors: { row_no: number; error_cd: string; error_msg: string }[] = [];

  for (const row of rows) {
    try {
      // 메뉴 UPSERT (menu_url 기준)
      const { data: menuRow, error: menuErr } = await supabaseAdmin
        .from('tb_menu')
        .upsert(
          {
            menu_id:        row.menu_id ?? undefined,
            menu_nm:        row.menu_nm,
            menu_url:       row.menu_url,
            parent_menu_id: row.parent_menu_id ?? null,
            menu_depth:     row.menu_depth,
            menu_order:     row.menu_order,
            icon_class:     row.icon_class ?? null,
            use_yn:         row.use_yn ?? 'Y',
          },
          { onConflict: 'menu_url', ignoreDuplicates: false }
        )
        .select('menu_id')
        .single();

      if (menuErr || !menuRow) throw new Error(menuErr?.message ?? 'upsert failed');

      // menu_role UPSERT (Role 권한 매핑)
      if (row.allow_roles?.length > 0) {
        const { data: roleRows } = await supabaseAdmin
          .from('tb_role')
          .select('role_id, role_cd')
          .in('role_cd', row.allow_roles)
          .eq('use_yn', 'Y');

        if (roleRows && roleRows.length > 0) {
          await supabaseAdmin.from('tb_menu_role').upsert(
            roleRows.map((r: any) => ({
              menu_id:  menuRow.menu_id,
              role_id:  r.role_id,
              read_yn:  'Y',
              write_yn: 'N',
            })),
            { onConflict: 'menu_id,role_id', ignoreDuplicates: false }
          );
        }
      }

      successCnt++;
    } catch (e: any) {
      runtimeErrors.push({
        row_no:    row.row_no,
        error_cd:  'ERR_RUNTIME',
        error_msg: e.message,
      });
      // 런타임 오류도 tb_menu_upload_error 추가 저장
      await supabaseAdmin.from('tb_menu_upload_error').insert({
        log_id:    logId,
        row_no:    row.row_no,
        column_nm: null,
        error_cd:  'ERR_RUNTIME',
        error_msg: e.message,
        raw_data:  row as unknown as Record<string, unknown>,
      });
    }
  }

  const totalFailCnt = error_rows.length + runtimeErrors.length;
  const finalStatus  =
    totalFailCnt === 0 ? 'SUCCESS' :
    successCnt   === 0 ? 'FAIL'    : 'PARTIAL';

  await supabaseAdmin
    .from('tb_menu_upload_log')
    .update({ status: finalStatus, success_cnt: successCnt, fail_cnt: totalFailCnt })
    .eq('log_id', logId);

  const allErrors = [
    ...error_rows.flatMap((e) => e.errors.map(
      (err) => ({ row_no: e.row_no, error_cd: err.error_cd, error_msg: err.error_msg })
    )),
    ...runtimeErrors,
  ];

  return res.status(200).json({
    success: true,
    data: {
      log_id:  logId,
      summary: { total_cnt, success_cnt: successCnt, fail_cnt: totalFailCnt, skip_cnt: 0, status: finalStatus },
      errors:  allErrors,
    },
    message: `업로드 완료. ${successCnt}건 성공, ${totalFailCnt}건 실패.`,
  });
});
```

---

## 8. 환경변수 목록 (`.env.local`)

```bash
# ─────────────────────────────────────────────────────────────
# 서버(Node.js Serverless) 전용 — 절대 브라우저에 노출 금지
# ─────────────────────────────────────────────────────────────

# Supabase 프로젝트 URL
SUPABASE_URL=https://hqyfkgwyblncdohrrgii.supabase.co

# service_role 키 (RLS 완전 우회, JWT 검증 — 절대 비공개)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# anon 키 (서버에서 RLS 테스트 시 사용)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ─────────────────────────────────────────────────────────────
# 프론트엔드(Vite) 공개 변수 — VITE_ prefix 필수
# ─────────────────────────────────────────────────────────────

# Supabase URL (Vite 빌드 시 번들에 포함)
VITE_SUPABASE_URL=https://hqyfkgwyblncdohrrgii.supabase.co

# anon 키 (브라우저 노출 허용 — RLS 정책으로 보호)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 배포 환경 API 호스트 (로컬: http://localhost:3000, 배포: https://act2026.vercel.app)
VITE_API_BASE_URL=https://act2026.vercel.app
```

**환경변수 상세 설명**:

| 변수명 | 노출 범위 | 필수 | 용도 |
|--------|----------|------|------|
| `SUPABASE_URL` | 서버 전용 | ✅ | `supabaseAdmin` / `supabaseAnon` 클라이언트 초기화 |
| `SUPABASE_SERVICE_ROLE_KEY` | **절대 비공개** | ✅ | Admin 클라이언트 초기화 (RLS 우회), `supabaseAdmin.auth.getUser()` JWT 검증 |
| `SUPABASE_ANON_KEY` | 공개 가능 | 선택 | Anon 클라이언트 초기화 (서버 RLS 테스트) |
| `VITE_SUPABASE_URL` | 공개 가능 | ✅ | 프론트엔드 Supabase Auth 초기화 |
| `VITE_SUPABASE_ANON_KEY` | 공개 가능 | ✅ | 프론트엔드 Supabase 클라이언트 초기화 (Vite 빌드 시 번들 포함) |
| `VITE_API_BASE_URL` | 공개 가능 | ✅ | 프론트 API 호출 기본 URL (로컬/배포 환경 분기) |

> **보안 주의사항**:  
> - `SUPABASE_SERVICE_ROLE_KEY`는 DB 전체 접근 권한 → GitHub, 클라이언트 번들에 절대 포함 금지  
> - Vercel 대시보드 → Settings → Environment Variables에서 `VITE_` prefix 없는 변수는 "Server" 스코프로만 설정

---

## 9. Vercel 배포 설정

### 9.1 `vercel.json` 설정

```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm install --prefix frontend && npm install --prefix api",
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 10
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)",     "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin",  "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Authorization,Content-Type" },
        { "key": "Cache-Control",                "value": "no-store" }
      ]
    },
    {
      "source": "/api/menus",
      "headers": [
        { "key": "Cache-Control", "value": "public, s-maxage=300, stale-while-revalidate=600" }
      ]
    }
  ]
}
```

> - `/api/menus` (전체 메뉴 트리): CDN Edge 5분 캐시 (`s-maxage=300`)  
> - `/api/menus/my` (사용자별 메뉴): 캐시 금지 (`no-store`)  
> - `maxDuration: 10`: Hobby 플랜 상한 10초, Pro 플랜 최대 300초

---

### 9.2 `tsconfig.json` 설정 (Vercel Serverless + Node.js 기준)

프로젝트 루트 `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target":        "ES2020",
    "module":        "CommonJS",
    "lib":           ["ES2020"],
    "strict":        true,
    "esModuleInterop": true,
    "skipLibCheck":  true,
    "outDir":        "./dist",
    "rootDir":       "./",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "declaration":   false,
    "noEmit":        true,
    "paths": {
      "@lib/*": ["./lib/*"]
    }
  },
  "include": ["api/**/*", "lib/**/*"],
  "exclude": ["node_modules", "frontend", "dist"]
}
```

루트 `package.json` (API 의존성):

```json
{
  "name": "kks-portal-api",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@supabase/supabase-js": "^2.46.0",
    "@vercel/node": "^3.2.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0"
  }
}
```

---

### 9.3 Serverless Function 제한사항

| 항목 | Hobby 플랜 | Pro 플랜 | 비고 |
|------|-----------|---------|------|
| 최대 실행 시간 | **10초** | **300초** | `vercel.json`의 `maxDuration`으로 설정 |
| 함수 메모리 | **1,024 MB** | **3,008 MB** | Node.js 프로세스 RSS 기준 |
| 요청 본문 크기 | **4.5 MB** | **4.5 MB** | API Route 기본값 |
| 응답 본문 크기 | **4.5 MB** | **4.5 MB** | Edge Function은 4MB |
| 동시 실행 수 | 최대 12 | 최대 1,000 | 트래픽 스파이크 주의 |
| Cold Start | 500ms~2s | 200ms~1s | Supabase 커넥션 포함 |
| 환경변수 개수 | 100개 | 100개 | 값 크기: 4KB 이하 |

**100만 유저 기준 성능 고려 사항**:

```
1. 메뉴 트리 API (GET /api/menus)
   → Vercel Edge Cache (s-maxage=300) + Supabase SQL 인덱스 (menu_depth, use_yn)
   → 트래픽 스파이크 시 DB 직접 호출 최소화

2. 유저별 메뉴 API (GET /api/menus/my)
   → 캐시 불가(개인화) → Supabase 커넥션 풀링 필수
   → Supabase Pro 이상에서 PgBouncer 커넥션 풀 사용 권장

3. Role 조회 최적화
   → verifyJWT에서 Role 조회 쿼리 → tb_user_role(user_id) 복합 인덱스 필수
   → end_dt GIN 인덱스 추가 권장

4. 업로드 API (POST /api/menus/upload/confirm)
   → 대용량 처리 시 Hobby 10초 제한 주의 (섹션 9.4 참고)
```

---

### 9.4 대용량 엑셀 업로드 시 제한 우회 방법

**문제**: 엑셀 파일 수백 행 처리 시 10초 타임아웃 / 4.5MB 본문 크기 초과

#### 방법 1. 프론트엔드 청크 분할 전송 (권장)

```typescript
// frontend/src/services/uploadService.ts
const CHUNK_SIZE = 100; // 100행씩 분할

async function uploadInChunks(rows: MenuUploadRow[], logId: string) {
  const chunks: MenuUploadRow[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE));
  }

  let totalSuccess = 0;
  let totalErrors: UploadErrorRow[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const response = await fetch('/api/menus/upload/confirm', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        rows:        chunks[idx],
        error_rows:  [],
        mode:        'PARTIAL_SUCCESS',
        file_nm:     fileName,
        upload_type: 'MENU',
        total_cnt:   rows.length,
        chunk_no:    idx + 1,        // 청크 번호 전달
        log_id:      logId,          // 첫 청크 응답의 log_id 재사용
      }),
    });

    const data = await response.json();
    if (data.success) {
      totalSuccess += data.data.summary.success_cnt;
      totalErrors  = [...totalErrors, ...data.data.errors];
    }
  }

  return { totalSuccess, totalErrors };
}
```

#### 방법 2. Supabase Storage 경유 (파일 직접 업로드)

```
프론트엔드                     Supabase Storage          Serverless API
    │                               │                          │
    │── PUT /storage/v1/object ──▶ │                          │
    │   (xlsx 파일 직접 업로드)      │                          │
    │◀────────── bucket_path ──────│                          │
    │                               │                          │
    │── POST /api/menus/upload/confirm?path={bucket_path} ──▶│
    │   (bucket_path만 전달)         │                          │
    │                               │◀─ 파일 다운로드(서버) ──-│
    │                               │                          │── 파싱+저장
    │◀─────────────────── 완료 응답 ─────────────────────────│
```

```typescript
// api/menus/upload/confirm.ts (Storage 경유 버전)
import { supabaseAdmin }  from '../../../lib/supabaseClient';
import * as XLSX         from 'xlsx';

// bucket_path로 파일 직접 조회 → 서버에서 파싱
const { data: fileData, error: dlErr } = await supabaseAdmin
  .storage
  .from('uploads')
  .download(body.bucket_path);

if (dlErr || !fileData) {
  return res.status(400).json(makeError('UPLOAD_001'));
}

const arrayBuffer = await fileData.arrayBuffer();
const wb = XLSX.read(arrayBuffer, { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
// 이후 저장 로직 동일
```

#### 방법 3. Vercel Pro 플랜 maxDuration 확장

```json
// vercel.json (Pro 플랜 전용)
{
  "functions": {
    "api/menus/upload/confirm.ts": {
      "runtime":     "nodejs20.x",
      "maxDuration": 60
    }
  }
}
```

| 방법 | 구현 난이도 | 비용 | 추천 상황 |
|------|-----------|------|---------|
| 청크 분할 전송 | 낮음 | 무료 | 기본 권장 (500행 이하) |
| Storage 경유 | 중간 | Supabase Storage 사용량 | 대용량 파일 (500행 초과) |
| Pro 플랜 확장 | 낮음 | Pro 플랜 비용 | 실시간 처리 필요 시 |
