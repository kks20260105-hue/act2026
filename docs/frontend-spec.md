# React 프론트엔드 컴포넌트 설계 명세서

> **프로젝트명**: KKS 엔터프라이즈 포털  
> **버전**: v1.0  
> **작성일**: 2026-03-13  
> **기술스택**: React 18 + TypeScript + Ant Design v5 + Zustand + TanStack Query v5 + Supabase Auth  
> **주의**: 모든 파일 확장자 `.tsx` / `.ts` 사용 (`.js` / `.jsx` 절대 사용 금지)

---

## 목차

| # | 항목 |
|---|------|
| 1 | 전체 폴더/파일 구조 |
| 2 | 핵심 컴포넌트 Props 인터페이스 |
| 3 | Zustand 스토어 전체 코드 |
| 4 | TanStack Query 커스텀 훅 전체 코드 |
| 5 | axios 인스턴스 설정 |
| 6 | Role 기반 메뉴 렌더링 로직 |
| 7 | 엑셀 업로드 플로우 |
| 8 | 라우터 설정 |
| 9 | 성능 최적화 전략 |
| 10 | 환경변수 및 설정 파일 |

---

## 1. 전체 폴더/파일 구조

```
frontend/src/
├── api/
│   ├── axiosInstance.ts        → axios 공통 인스턴스 (JWT 인터셉터)
│   ├── menuApi.ts              → 메뉴 관련 API 함수
│   ├── roleApi.ts              → Role 관련 API 함수
│   ├── uploadApi.ts            → 업로드 관련 API 함수
│   └── userRoleApi.ts          → 사용자-Role API 함수
│
├── components/
│   ├── layout/
│   │   ├── GNBLayout.tsx       → 전체 레이아웃 + 상단 GNB
│   │   ├── LNBLayout.tsx       → 좌측 LNB 사이드바
│   │   └── PageLayout.tsx      → 페이지 공통 래퍼 (breadcrumb 포함)
│   ├── menu/
│   │   ├── MenuTreeTable.tsx   → 메뉴 목록 트리 테이블
│   │   ├── MenuFormModal.tsx   → 메뉴 등록/수정 모달
│   │   └── MenuOrderDnD.tsx    → 드래그앤드롭 순서 변경
│   ├── upload/
│   │   ├── ExcelUploadModal.tsx     → 업로드 전체 플로우 모달
│   │   ├── UploadFileSelector.tsx   → 파일 선택 + SheetJS 파싱
│   │   ├── UploadPreviewTable.tsx   → 미리보기 테이블 (오류행 하이라이트)
│   │   ├── UploadErrorDrawer.tsx    → 오류 상세 드로어
│   │   ├── UploadResultSummary.tsx  → 업로드 결과 요약
│   │   └── UploadLogTable.tsx       → 업로드 이력 목록
│   ├── role/
│   │   ├── RoleTable.tsx       → Role 목록 테이블
│   │   └── RoleFormModal.tsx   → Role 등록/수정 모달
│   ├── menuRole/
│   │   └── MenuRoleMapper.tsx  → 메뉴-Role 매핑 체크박스 매트릭스
│   ├── userRole/
│   │   └── UserRoleManager.tsx → 사용자 Role 부여/회수 UI
│   └── common/
│       ├── PermissionGuard.tsx → Role 기반 접근 제어 래퍼
│       ├── LoadingSpinner.tsx  → 공통 로딩 컴포넌트
│       ├── ErrorBoundary.tsx   → 에러 바운더리
│       └── ConfirmModal.tsx    → 공통 확인 모달
│
├── hooks/
│   ├── useMenuTree.ts          → 전체 메뉴 트리 조회
│   ├── useMyMenus.ts           → 로그인 유저 메뉴 조회
│   ├── useMenuPermission.ts    → 메뉴 접근 권한 체크
│   ├── useUploadPreview.ts     → 업로드 미리보기
│   ├── useUploadConfirm.ts     → 업로드 확정 저장
│   ├── useRoles.ts             → Role 목록 조회
│   ├── useMenuRoles.ts         → 메뉴-Role 매핑 조회
│   ├── useUserRoles.ts         → 사용자 Role 조회
│   └── useAuth.ts              → Supabase Auth 인증 상태
│
├── stores/
│   ├── authStore.ts            → Zustand 인증 상태
│   ├── menuStore.ts            → Zustand 메뉴 선택 상태
│   └── uploadStore.ts          → Zustand 업로드 플로우 상태
│
├── pages/
│   ├── HomePage.tsx            → 포털 메인
│   ├── LoginPage.tsx           → 로그인
│   ├── ForbiddenPage.tsx       → 403 권한 없음
│   ├── NotFoundPage.tsx        → 404
│   └── admin/
│       ├── Menu01_ManagePage.tsx  → GNB/LNB 메뉴 관리
│       ├── RoleManagePage.tsx  → Role 관리
│       ├── MenuRolePage.tsx    → 메뉴-Role 매핑
│       └── UserRolePage.tsx    → 사용자 Role 관리
│       ├── MenuUploadPage.tsx  → 엑셀 업로드 관리
│
├── types/
│   ├── auth.ts                 → Auth 관련 타입
│   ├── common.ts               → 공통 타입 (ApiResponse, Pagination)
│   ├── menu.ts                 → Menu 관련 타입
│   ├── role.ts                 → Role 관련 타입
│   └── upload.ts               → Upload 관련 타입
│
├── utils/
│   ├── excelParser.ts          → SheetJS 파싱 유틸
│   ├── excelExporter.ts        → SheetJS 내보내기 유틸
│   ├── roleChecker.ts          → Role 체크 유틸
│   └── dateFormatter.ts        → 날짜 포맷 유틸
│
├── lib/
│   ├── supabaseClient.ts       → Supabase 브라우저 클라이언트
│   └── queryClient.ts          → TanStack Query 클라이언트 설정
│
├── router/
│   ├── index.tsx               → 라우트 정의
│   ├── PrivateRoute.tsx        → 인증 보호 라우트
│   └── RoleRoute.tsx           → Role 기반 보호 라우트
│
├── constants/
│   ├── roles.ts                → Role 코드 상수
│   ├── menuDepth.ts            → 메뉴 depth 상수
│   └── uploadConfig.ts         → 업로드 설정 상수
│
├── App.tsx
└── main.tsx
```

---

## 2. 핵심 컴포넌트 Props 인터페이스

```typescript
// ─────────────────────────────────────────────
// 2.1 GNBLayout.tsx
// ─────────────────────────────────────────────
export interface GNBLayoutProps {
  /** GNB 메뉴 목록 (depth=1) */
  gnbMenus: MenuWithPermission[];
  /** 현재 선택된 GNB menu_id */
  activeGNBId: string | null;
  /** GNB 클릭 핸들러 */
  onGNBClick: (menu: MenuWithPermission) => void;
  /** 우측 사용자 프로필 (이름·역할 표시) */
  userProfile: {
    username: string;
    email:    string;
    roles:    string[];
    avatarUrl?: string;
  };
  /** 로그아웃 핸들러 */
  onLogout: () => Promise<void>;
  /** 자식 컴포넌트 (페이지 콘텐츠) */
  children: React.ReactNode;
}

// ─────────────────────────────────────────────
// 2.2 LNBLayout.tsx
// ─────────────────────────────────────────────
export interface LNBLayoutProps {
  /** LNB 메뉴 목록 (depth=2, 현재 선택 GNB 하위) */
  lnbMenus: MenuWithPermission[];
  /** 현재 선택된 LNB menu_id */
  activeLNBId: string | null;
  /** LNB 클릭 핸들러 */
  onLNBClick: (menu: MenuWithPermission) => void;
  /** 사이드바 접힘 여부 */
  collapsed: boolean;
  /** 접힘 토글 핸들러 */
  onCollapse: (collapsed: boolean) => void;
  /** 자식 컴포넌트 */
  children: React.ReactNode;
}

// ─────────────────────────────────────────────
// 2.3 MenuTreeTable.tsx
// ─────────────────────────────────────────────
export interface MenuTreeTableProps {
  /** 트리 구조 메뉴 목록 */
  dataSource: MenuTree[];
  /** 로딩 여부 */
  loading: boolean;
  /** 등록 버튼 클릭 */
  onAdd: (parentMenu?: MenuTree) => void;
  /** 수정 버튼 클릭 */
  onEdit: (menu: MenuTree) => void;
  /** 삭제 버튼 클릭 */
  onDelete: (menu: MenuTree) => void;
  /** 순서 변경 버튼 클릭 */
  onReorder: () => void;
}

// ─────────────────────────────────────────────
// 2.4 MenuFormModal.tsx
// ─────────────────────────────────────────────
export interface MenuFormModalProps {
  /** 모달 오픈 여부 */
  open: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 저장 완료 콜백 */
  onSuccess: () => void;
  /** 수정 시 초기 데이터 (null이면 등록 모드) */
  initialData: MenuTree | null;
  /** 기본 상위 메뉴 (LNB 등록 시 전달) */
  defaultParent?: MenuTree;
  /** 전체 메뉴 목록 (상위 메뉴 선택 셀렉트용) */
  allMenus: MenuTree[];
  /** Role 목록 (허용 Role 선택용) */
  roles: Role[];
}

// ─────────────────────────────────────────────
// 2.5 ExcelUploadModal.tsx
// ─────────────────────────────────────────────
export interface ExcelUploadModalProps {
  /** 모달 오픈 여부 */
  open: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 업로드 완료 후 메뉴 목록 갱신 콜백 */
  onUploadComplete: () => void;
}

// ─────────────────────────────────────────────
// 2.6 UploadPreviewTable.tsx
// ─────────────────────────────────────────────
export interface UploadPreviewTableProps {
  /** 유효 행 목록 */
  validRows: MenuUploadRow[];
  /** 오류 행 목록 */
  invalidRows: UploadErrorRow[];
  /** 로딩 여부 (미리보기 API 호출 중) */
  loading: boolean;
  /** 선택한 업로드 모드 */
  uploadMode: UploadMode;
  /** 업로드 모드 변경 핸들러 */
  onModeChange: (mode: UploadMode) => void;
  /** 확정 저장 버튼 클릭 */
  onConfirm: () => void;
  /** 이전 단계로 */
  onBack: () => void;
}

// ─────────────────────────────────────────────
// 2.7 UploadErrorDrawer.tsx
// ─────────────────────────────────────────────
export interface UploadErrorDrawerProps {
  /** 드로어 오픈 여부 */
  open: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 업로드 이력 ID */
  logId: string;
  /** 파일명 (드로어 타이틀 표시용) */
  fileName: string;
}

// ─────────────────────────────────────────────
// 2.8 RoleTable.tsx
// ─────────────────────────────────────────────
export interface RoleTableProps {
  /** Role 목록 (집계 포함) */
  dataSource: RoleWithStats[];
  /** 로딩 여부 */
  loading: boolean;
  /** 등록 클릭 */
  onAdd: () => void;
  /** 수정 클릭 */
  onEdit: (role: RoleWithStats) => void;
  /** 삭제 클릭 */
  onDelete: (role: RoleWithStats) => void;
}

// ─────────────────────────────────────────────
// 2.9 RoleFormModal.tsx
// ─────────────────────────────────────────────
export interface RoleFormModalProps {
  /** 모달 오픈 여부 */
  open: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 저장 완료 콜백 */
  onSuccess: () => void;
  /** 수정 시 초기 데이터 (null이면 등록 모드) */
  initialData: Role | null;
}

// ─────────────────────────────────────────────
// 2.10 MenuRoleMapper.tsx
// ─────────────────────────────────────────────
export interface MenuRoleMapperProps {
  /** 매트릭스 데이터 */
  matrix: MenuRoleMatrix[];
  /** Role 목록 (컬럼 헤더용) */
  roles: Pick<Role, 'role_id' | 'role_cd' | 'role_nm' | 'role_color'>[];
  /** 로딩 여부 */
  loading: boolean;
  /** 저장 중 여부 */
  saving: boolean;
  /** 권한 변경 핸들러 */
  onChange: (menuId: string, roleId: string, field: 'read_yn' | 'write_yn', value: YN) => void;
  /** 일괄 저장 클릭 */
  onSave: () => void;
}

// ─────────────────────────────────────────────
// 2.11 UserRoleManager.tsx
// ─────────────────────────────────────────────
export interface UserRoleManagerProps {
  /** 대상 사용자 ID */
  userId: string;
  /** 대상 사용자 이름 (표시용) */
  username: string;
  /** 전체 Role 목록 (부여 가능 목록) */
  availableRoles: Role[];
  /** 현재 보유 Role 목록 */
  userRoles: UserRoleWithInfo[];
  /** 로딩 여부 */
  loading: boolean;
  /** Role 부여 핸들러 */
  onGrant: (body: GrantRoleBody) => void;
  /** Role 회수 핸들러 */
  onRevoke: (userRoleId: string) => void;
}

// ─────────────────────────────────────────────
// 2.12 PermissionGuard.tsx
// ─────────────────────────────────────────────
export interface PermissionGuardProps {
  /** 허용할 Role 코드 목록 */
  allowedRoles: string[];
  /** 권한 있는 경우 렌더링 */
  children: React.ReactNode;
  /** 권한 없는 경우 렌더링 (기본: null) */
  fallback?: React.ReactNode;
  /** true이면 권한 없을 때 아예 DOM에서 제거 (기본: true) */
  removeOnDenied?: boolean;
}
```

---

## 3. Zustand 스토어 전체 코드

### 3.1 `/stores/authStore.ts`

```typescript
// /src/stores/authStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthUser {
  id:        string;
  email:     string;
  username:  string;
  avatarUrl: string | null;
}

interface AuthState {
  // ── State ──
  user:            AuthUser | null;
  userRoles:       string[];          // ['ADMIN', 'MANAGER']
  accessToken:     string | null;
  isAuthenticated: boolean;
  isInitialized:   boolean;           // onAuthStateChange 최초 실행 여부

  // ── Actions ──
  setUser:       (user: AuthUser | null) => void;
  setRoles:      (roles: string[]) => void;
  setToken:      (token: string | null) => void;
  setSession:    (session: Session | null) => void;
  clearAuth:     () => void;
  setInitialized: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        // ── 초기값 ──
        user:            null,
        userRoles:       [],
        accessToken:     null,
        isAuthenticated: false,
        isInitialized:   false,

        // ── Actions ──
        setUser: (user) =>
          set({ user, isAuthenticated: user !== null }, false, 'setUser'),

        setRoles: (roles) =>
          set({ userRoles: roles }, false, 'setRoles'),

        setToken: (token) =>
          set({ accessToken: token }, false, 'setToken'),

        /**
         * Supabase Session 객체로 user + token 일괄 설정
         * onAuthStateChange 콜백에서 호출
         */
        setSession: (session) => {
          if (!session) {
            set(
              {
                user:            null,
                userRoles:       [],
                accessToken:     null,
                isAuthenticated: false,
              },
              false,
              'setSession/clear'
            );
            return;
          }

          const supaUser: User = session.user;
          const authUser: AuthUser = {
            id:        supaUser.id,
            email:     supaUser.email ?? '',
            username:  (supaUser.user_metadata?.username as string | undefined)
                       ?? supaUser.email?.split('@')[0]
                       ?? 'User',
            avatarUrl: (supaUser.user_metadata?.avatar_url as string | undefined) ?? null,
          };

          set(
            {
              user:            authUser,
              accessToken:     session.access_token,
              isAuthenticated: true,
            },
            false,
            'setSession/set'
          );
        },

        clearAuth: () =>
          set(
            {
              user:            null,
              userRoles:       [],
              accessToken:     null,
              isAuthenticated: false,
            },
            false,
            'clearAuth'
          ),

        setInitialized: (v) =>
          set({ isInitialized: v }, false, 'setInitialized'),
      }),
      {
        name:    'kks-auth',
        // accessToken만 세션스토리지에 유지 (페이지 새로고침 대응)
        partialize: (state) => ({
          user:        state.user,
          userRoles:   state.userRoles,
          accessToken: state.accessToken,
        }),
        storage: {
          getItem:    (key) => sessionStorage.getItem(key),
          setItem:    (key, val) => sessionStorage.setItem(key, val),
          removeItem: (key) => sessionStorage.removeItem(key),
        },
      }
    ),
    { name: 'AuthStore' }
  )
);
```

---

### 3.2 `/stores/menuStore.ts`

```typescript
// /src/stores/menuStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MenuWithPermission } from '../types/menu';

interface MenuState {
  // ── State ──
  selectedGNB:   MenuWithPermission | null;
  selectedLNB:   MenuWithPermission | null;
  /** useMyMenus에서 받은 전체 권한 포함 트리 */
  menuTree:      MenuWithPermission[];
  /** 사이드바 접힘 여부 */
  sidebarCollapsed: boolean;

  // ── Actions ──
  setSelectedGNB:      (menu: MenuWithPermission | null) => void;
  setSelectedLNB:      (menu: MenuWithPermission | null) => void;
  setMenuTree:         (tree: MenuWithPermission[]) => void;
  setSidebarCollapsed: (v: boolean) => void;

  /** URL 경로로 GNB/LNB 자동 선택 */
  syncMenuFromPath:    (pathname: string) => void;
}

export const useMenuStore = create<MenuState>()(
  devtools(
    (set, get) => ({
      selectedGNB:      null,
      selectedLNB:      null,
      menuTree:         [],
      sidebarCollapsed: false,

      setSelectedGNB: (menu) =>
        set({ selectedGNB: menu, selectedLNB: null }, false, 'setSelectedGNB'),

      setSelectedLNB: (menu) =>
        set({ selectedLNB: menu }, false, 'setSelectedLNB'),

      setMenuTree: (tree) =>
        set({ menuTree: tree }, false, 'setMenuTree'),

      setSidebarCollapsed: (v) =>
        set({ sidebarCollapsed: v }, false, 'setSidebarCollapsed'),

      syncMenuFromPath: (pathname) => {
        const { menuTree } = get();

        // LNB 중 URL이 일치하는 것 찾기
        for (const gnb of menuTree) {
          for (const lnb of gnb.children ?? []) {
            if (pathname.startsWith(lnb.menu_url)) {
              set(
                { selectedGNB: gnb, selectedLNB: lnb },
                false,
                'syncMenuFromPath'
              );
              return;
            }
          }
          // GNB 자체 URL 일치
          if (pathname === gnb.menu_url) {
            set(
              { selectedGNB: gnb, selectedLNB: null },
              false,
              'syncMenuFromPath/gnb'
            );
            return;
          }
        }
      },
    }),
    { name: 'MenuStore' }
  )
);
```

---

### 3.3 `/stores/uploadStore.ts`

```typescript
// /src/stores/uploadStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MenuUploadRow, UploadErrorRow, UploadMode, UploadStatus } from '../types/upload';

export type UploadStep = 'SELECT' | 'PREVIEW' | 'CONFIRM' | 'RESULT';

export interface UploadResult {
  logId:       string;
  totalCnt:    number;
  successCnt:  number;
  failCnt:     number;
  skipCnt:     number;
  status:      UploadStatus;
  errors:      { rowNo: number; errorCd: string; errorMsg: string }[];
}

interface UploadState {
  // ── Step 상태 ──
  step:         UploadStep;

  // ── SELECT 단계 ──
  file:         File | null;
  parsedRows:   MenuUploadRow[];

  // ── PREVIEW 단계 ──
  validRows:    MenuUploadRow[];
  invalidRows:  UploadErrorRow[];
  uploadMode:   UploadMode;

  // ── RESULT 단계 ──
  uploadResult: UploadResult | null;

  // ── 로딩 ──
  isPreviewLoading:  boolean;
  isConfirmLoading:  boolean;

  // ── Actions ──
  setStep:            (step: UploadStep) => void;
  setFile:            (file: File | null) => void;
  setParsedRows:      (rows: MenuUploadRow[]) => void;
  setPreviewResult:   (valid: MenuUploadRow[], invalid: UploadErrorRow[]) => void;
  setUploadMode:      (mode: UploadMode) => void;
  setUploadResult:    (result: UploadResult) => void;
  setPreviewLoading:  (v: boolean) => void;
  setConfirmLoading:  (v: boolean) => void;
  /** 전체 초기화 (모달 닫을 때) */
  reset:              () => void;
}

const initialState = {
  step:              'SELECT'  as UploadStep,
  file:              null,
  parsedRows:        [],
  validRows:         [],
  invalidRows:       [],
  uploadMode:        'PARTIAL_SUCCESS' as UploadMode,
  uploadResult:      null,
  isPreviewLoading:  false,
  isConfirmLoading:  false,
};

export const useUploadStore = create<UploadState>()(
  devtools(
    (set) => ({
      ...initialState,

      setStep:           (step)              => set({ step }, false, 'setStep'),
      setFile:           (file)              => set({ file }, false, 'setFile'),
      setParsedRows:     (parsedRows)        => set({ parsedRows }, false, 'setParsedRows'),
      setPreviewResult:  (valid, invalid)    =>
        set({ validRows: valid, invalidRows: invalid, step: 'PREVIEW' }, false, 'setPreviewResult'),
      setUploadMode:     (uploadMode)        => set({ uploadMode }, false, 'setUploadMode'),
      setUploadResult:   (uploadResult)      =>
        set({ uploadResult, step: 'RESULT' }, false, 'setUploadResult'),
      setPreviewLoading: (isPreviewLoading)  => set({ isPreviewLoading }, false, 'setPreviewLoading'),
      setConfirmLoading: (isConfirmLoading)  => set({ isConfirmLoading }, false, 'setConfirmLoading'),
      reset:             ()                  => set(initialState, false, 'reset'),
    }),
    { name: 'UploadStore' }
  )
);
```

---

## 4. TanStack Query 커스텀 훅 전체 코드

### 4.1 `useMenuTree.ts`

```typescript
// /src/hooks/useMenuTree.ts
import { useQuery } from '@tanstack/react-query';
import { menuApi }  from '../api/menuApi';
import type { MenuTree } from '../types/menu';

/** 평탄 배열 → 계층 트리 변환 */
function buildTree(menus: MenuTree[], parentId: string | null = null): MenuTree[] {
  return menus
    .filter((m) => m.parent_menu_id === parentId)
    .sort((a, b) => a.menu_order - b.menu_order)
    .map((m) => ({ ...m, children: buildTree(menus, m.menu_id) }));
}

export function useMenuTree(params?: { use_yn?: 'Y' | 'N'; depth?: 1 | 2 }) {
  return useQuery({
    queryKey: ['menus', params ?? {}],
    queryFn:  () => menuApi.getMenus(params),
    select:   (data) => buildTree(data.menus),
    staleTime:            5 * 60 * 1000,  // 5분: 메뉴 구조 거의 안 바뀜
    gcTime:               30 * 60 * 1000, // 30분 캐시 보관
    refetchOnWindowFocus: false,
    retry:                2,
  });
}
```

---

### 4.2 `useMyMenus.ts`

```typescript
// /src/hooks/useMyMenus.ts
import { useQuery }        from '@tanstack/react-query';
import { menuApi }         from '../api/menuApi';
import { useAuthStore }    from '../stores/authStore';
import { useMenuStore }    from '../stores/menuStore';
import { useCallback, useEffect } from 'react';
import type { MenuWithPermission } from '../types/menu';

export function useMyMenus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setMenuTree     = useMenuStore((s) => s.setMenuTree);

  const query = useQuery({
    queryKey: ['menus', 'my'],
    queryFn:  () => menuApi.getMyMenus(),
    enabled:  isAuthenticated,
    select:   (data) => ({
      userRoles: data.user_roles as string[],
      menus:     data.menus as MenuWithPermission[],
    }),
    staleTime:            3 * 60 * 1000, // 3분
    gcTime:               10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // menuStore 동기화
  useEffect(() => {
    if (query.data?.menus) {
      setMenuTree(query.data.menus);
    }
  }, [query.data?.menus, setMenuTree]);

  return query;
}
```

---

### 4.3 `useMenuPermission.ts`

```typescript
// /src/hooks/useMenuPermission.ts
import { useMemo }         from 'react';
import { useMenuStore }    from '../stores/menuStore';
import type { MenuWithPermission } from '../types/menu';

interface PermissionResult {
  canRead:      boolean;
  canWrite:     boolean;
  isLoading:    boolean;
  menu:         MenuWithPermission | null;
}

/** menuUrl에 해당하는 메뉴의 읽기/쓰기 권한 반환 */
export function useMenuPermission(menuUrl: string): PermissionResult {
  const menuTree = useMenuStore((s) => s.menuTree);

  return useMemo(() => {
    if (!menuTree.length) {
      return { canRead: false, canWrite: false, isLoading: true, menu: null };
    }

    // 전체 트리를 평탄화하여 URL로 검색
    const flat: MenuWithPermission[] = [];
    const flatten = (nodes: MenuWithPermission[]) => {
      for (const n of nodes) {
        flat.push(n);
        if (n.children?.length) flatten(n.children as MenuWithPermission[]);
      }
    };
    flatten(menuTree);

    const found = flat.find((m) => m.menu_url === menuUrl) ?? null;

    return {
      canRead:   found?.read_yn  === 'Y',
      canWrite:  found?.write_yn === 'Y',
      isLoading: false,
      menu:      found,
    };
  }, [menuTree, menuUrl]);
}
```

---

### 4.4 `useUploadPreview.ts`

```typescript
// /src/hooks/useUploadPreview.ts
import { useMutation }     from '@tanstack/react-query';
import { uploadApi }       from '../api/uploadApi';
import { useUploadStore }  from '../stores/uploadStore';
import { message }         from 'antd';
import type { MenuUploadRow } from '../types/upload';

export function useUploadPreview() {
  const { setPreviewResult, setPreviewLoading } = useUploadStore();

  return useMutation({
    mutationFn: (rows: MenuUploadRow[]) =>
      uploadApi.preview({ rows, upload_type: 'MENU' }),

    onMutate: () => setPreviewLoading(true),

    onSuccess: (data) => {
      setPreviewResult(data.valid_rows, data.invalid_rows);
      if (data.summary.error_cnt > 0) {
        message.warning(
          `미리보기 완료: 유효 ${data.summary.valid_cnt}건, 오류 ${data.summary.error_cnt}건`
        );
      } else {
        message.success(`미리보기 완료: 전체 ${data.summary.total_cnt}건 유효`);
      }
    },

    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message ?? '미리보기 중 오류가 발생했습니다.');
    },

    onSettled: () => setPreviewLoading(false),
  });
}
```

---

### 4.5 `useUploadConfirm.ts`

```typescript
// /src/hooks/useUploadConfirm.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadApi }                    from '../api/uploadApi';
import { useUploadStore }               from '../stores/uploadStore';
import { message }                      from 'antd';
import type { ConfirmUploadBody }       from '../types/upload';

export function useUploadConfirm() {
  const queryClient = useQueryClient();
  const { setUploadResult, setConfirmLoading } = useUploadStore();

  return useMutation({
    mutationFn: (body: ConfirmUploadBody) => uploadApi.confirm(body),

    onMutate: () => setConfirmLoading(true),

    onSuccess: (data) => {
      setUploadResult({
        logId:      data.log_id,
        totalCnt:   data.summary.total_cnt,
        successCnt: data.summary.success_cnt,
        failCnt:    data.summary.fail_cnt,
        skipCnt:    data.summary.skip_cnt,
        status:     data.summary.status,
        errors:     data.errors.map((e: any) => ({
          rowNo:    e.row_no,
          errorCd:  e.error_cd,
          errorMsg: e.error_msg,
        })),
      });

      // 메뉴 관련 캐시 전체 무효화 (새 메뉴 반영)
      queryClient.invalidateQueries({ queryKey: ['menus'] });

      message.success(
        `업로드 완료: ${data.summary.success_cnt}건 성공` +
        (data.summary.fail_cnt > 0 ? `, ${data.summary.fail_cnt}건 실패` : '')
      );
    },

    onError: (err: any) => {
      message.error(
        err?.response?.data?.error?.message ?? '업로드 저장 중 오류가 발생했습니다.'
      );
    },

    onSettled: () => setConfirmLoading(false),
  });
}
```

---

### 4.6 `useRoles.ts`

```typescript
// /src/hooks/useRoles.ts
import { useQuery }   from '@tanstack/react-query';
import { roleApi }    from '../api/roleApi';
import { useAuthStore } from '../stores/authStore';
import { ADMIN_ROLES } from '../constants/roles';

export function useRoles(params?: { use_yn?: 'Y' | 'N' }) {
  const userRoles = useAuthStore((s) => s.userRoles);
  const isAdmin   = ADMIN_ROLES.some((r) => userRoles.includes(r));

  return useQuery({
    queryKey: ['roles', params ?? {}],
    queryFn:  () => roleApi.getRoles(params),
    select:   (data) => data.items,
    enabled:  isAdmin,
    staleTime: 10 * 60 * 1000, // Role은 자주 안 바뀜 → 10분
    gcTime:    30 * 60 * 1000,
  });
}
```

---

### 4.7 `useMenuRoles.ts`

```typescript
// /src/hooks/useMenuRoles.ts
import { useQuery }  from '@tanstack/react-query';
import { roleApi }   from '../api/roleApi';
import { useMemo }   from 'react';
import type { MenuRoleMatrix, Role } from '../types/role';

interface MenuRolesData {
  matrix: MenuRoleMatrix[];
  roles:  Pick<Role, 'role_id' | 'role_cd' | 'role_nm' | 'role_color'>[];
}

export function useMenuRoles() {
  const query = useQuery({
    queryKey: ['menu-roles'],
    queryFn:  () => roleApi.getMenuRoles(),
    staleTime: 5 * 60 * 1000,
    gcTime:    20 * 60 * 1000,
  });

  /** 로컬 변경사항 추적용 dirty map (저장 전 UI 즉시 반영) */
  const matrixData = useMemo<MenuRolesData>(
    () => ({
      matrix: query.data?.matrix ?? [],
      roles:  query.data?.roles  ?? [],
    }),
    [query.data]
  );

  return { ...query, ...matrixData };
}
```

---

### 4.8 `useUserRoles.ts`

```typescript
// /src/hooks/useUserRoles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userRoleApi }  from '../api/userRoleApi';
import { message }      from 'antd';
import type { GrantRoleBody } from '../types/role';

export function useUserRoles(userId: string) {
  const queryClient = useQueryClient();
  const queryKey    = ['user-roles', userId];

  const query = useQuery({
    queryKey,
    queryFn:  () => userRoleApi.getUserRoles(userId),
    select:   (data) => data,
    enabled:  Boolean(userId),
    staleTime: 2 * 60 * 1000,
  });

  const grantMutation = useMutation({
    mutationFn: (body: GrantRoleBody) => userRoleApi.grantRole(userId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      message.success('Role이 부여되었습니다.');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message ?? 'Role 부여 실패');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userRoleId: string) => userRoleApi.revokeRole(userId, userRoleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      message.success('Role이 회수되었습니다.');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message ?? 'Role 회수 실패');
    },
  });

  return { query, grantMutation, revokeMutation };
}
```

---

### 4.9 `useAuth.ts`

```typescript
// /src/hooks/useAuth.ts
import { useEffect, useCallback } from 'react';
import { useNavigate }            from 'react-router-dom';
import { supabase }               from '../lib/supabaseClient';
import { useAuthStore }           from '../stores/authStore';
import { axiosInstance }          from '../api/axiosInstance';
import { message }                from 'antd';

export function useAuth() {
  const {
    setSession, setRoles, clearAuth,
    setInitialized, isAuthenticated, accessToken,
  } = useAuthStore();
  const navigate = useNavigate();

  // ── Supabase onAuthStateChange 구독 ──
  useEffect(() => {
    // 초기 세션 복구 (새로고침 대응)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setInitialized(true);

        if (session) {
          // 서버에서 Role 목록 조회 (토큰 유효 시)
          try {
            const res = await axiosInstance.get<{ roles: string[] }>('/auth/me');
            setRoles(res.data.roles);
          } catch {
            // Role 조회 실패는 조용히 처리
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
    message.success('로그아웃되었습니다.');
    navigate('/login');
  }, [clearAuth, navigate]);

  return {
    isAuthenticated,
    accessToken,
    login,
    logout,
  };
}
```

---

## 5. axios 인스턴스 설정

### 5.1 `/api/axiosInstance.ts` — 전체 코드

```typescript
// /src/api/axiosInstance.ts
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { supabase }      from '../lib/supabaseClient';
import { useAuthStore }  from '../stores/authStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const axiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── 요청 인터셉터: Supabase JWT 자동 주입 ──
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. 스토어에서 토큰 조회
    let token = useAuthStore.getState().accessToken;

    // 2. 토큰 없거나 갱신 필요 시 Supabase 세션에서 직접 가져오기
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token ?? null;
      if (token) {
        useAuthStore.getState().setToken(token);
      }
    }

    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── 응답 인터셉터: 401 자동 처리 + 토큰 갱신 ──
let isRefreshing      = false;
let refreshQueue: ((token: string) => void)[] = [];

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response.data, // data 레이어 언래핑

  async (error: AxiosError<{ error: { code: string; message: string } }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 처리: 토큰 갱신 시도
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 갱신 중이면 큐에 대기
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
            resolve(axiosInstance(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data: { session }, error: refreshErr } =
          await supabase.auth.refreshSession();

        if (refreshErr || !session) throw refreshErr;

        const newToken = session.access_token;
        useAuthStore.getState().setToken(newToken);
        useAuthStore.getState().setSession(session);

        // 대기 큐 처리
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];

        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return axiosInstance(originalRequest);
      } catch {
        // 갱신 실패 → 로그아웃
        useAuthStore.getState().clearAuth();
        refreshQueue = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // API 에러 응답 정규화
    const apiError = error.response?.data?.error;
    const normalizedError = {
      code:       apiError?.code    ?? 'UNKNOWN',
      message:    apiError?.message ?? error.message,
      httpStatus: error.response?.status ?? 0,
    };

    return Promise.reject(normalizedError);
  }
);

export default axiosInstance;
```

**API 함수 모듈 예시** (`menuApi.ts`):

```typescript
// /src/api/menuApi.ts
import { axiosInstance } from './axiosInstance';
import type { Menu, MenuTree, MenuUpsertBody, MenuOrderItem } from '../types/menu';
import type { ApiSuccessResponse, ApiListResponse } from '../types/common';

export const menuApi = {
  getMenus: (params?: { use_yn?: string; depth?: number }) =>
    axiosInstance.get<any, { menus: MenuTree[]; total: number }>(
      '/menus', { params }
    ),

  getMyMenus: () =>
    axiosInstance.get<any, { user_roles: string[]; menus: any[] }>('/menus/my'),

  createMenu: (body: MenuUpsertBody) =>
    axiosInstance.post<any, ApiSuccessResponse<Menu>>('/menus', body),

  updateMenu: (menuId: string, body: Partial<MenuUpsertBody>) =>
    axiosInstance.put<any, ApiSuccessResponse<Menu>>(`/menus/${menuId}`, body),

  deleteMenu: (menuId: string) =>
    axiosInstance.delete<any, ApiSuccessResponse<{ deleted_menu_id: string }>>
      (`/menus/${menuId}`),

  reorderMenus: (items: MenuOrderItem[]) =>
    axiosInstance.put<any, ApiSuccessResponse<{ updated_count: number }>>
      ('/menus/order', { items }),
};
```

---

## 6. Role 기반 메뉴 렌더링 로직

### 6.1 `PermissionGuard.tsx` — 전체 코드

```typescript
// /src/components/common/PermissionGuard.tsx
import React, { memo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import type { PermissionGuardProps } from '../../types/common';

export const PermissionGuard: React.FC<PermissionGuardProps> = memo(
  ({ allowedRoles, children, fallback = null, removeOnDenied = true }) => {
    const userRoles = useAuthStore((s) => s.userRoles);

    const isSuperAdmin  = userRoles.includes('SUPER_ADMIN');
    const hasPermission =
      isSuperAdmin || allowedRoles.some((r) => userRoles.includes(r));

    if (!hasPermission) {
      return removeOnDenied ? null : <>{fallback}</>;
    }

    return <>{children}</>;
  }
);

PermissionGuard.displayName = 'PermissionGuard';
```

**사용 예시**:
```typescript
// 관리자만 보이는 버튼
<PermissionGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
  <Button onClick={onAdd}>메뉴 등록</Button>
</PermissionGuard>

// 권한 없으면 비활성화된 버튼 표시
<PermissionGuard
  allowedRoles={['SUPER_ADMIN']}
  fallback={<Button disabled>삭제 (권한 없음)</Button>}
  removeOnDenied={false}
>
  <Button danger onClick={onDelete}>삭제</Button>
</PermissionGuard>
```

---

### 6.2 `RoleRoute.tsx` — 전체 코드

```typescript
// /src/router/RoleRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore }          from '../stores/authStore';

interface RoleRouteProps {
  /** 허용 Role 목록 */
  allowedRoles: string[];
  /** 보호할 컴포넌트 */
  children: React.ReactNode;
  /** 미인증 시 리다이렉트 (기본: /login) */
  redirectTo?: string;
  /** Role 미충족 시 리다이렉트 (기본: /forbidden) */
  forbiddenTo?: string;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({
  allowedRoles,
  children,
  redirectTo  = '/login',
  forbiddenTo = '/forbidden',
}) => {
  const { isAuthenticated, isInitialized, userRoles } = useAuthStore((s) => ({
    isAuthenticated: s.isAuthenticated,
    isInitialized:   s.isInitialized,
    userRoles:       s.userRoles,
  }));
  const location = useLocation();

  // Auth 초기화 전 로딩
  if (!isInitialized) return null;

  // 미인증 → 로그인 페이지
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Role 체크 (SUPER_ADMIN 항상 통과)
  const isSuperAdmin  = userRoles.includes('SUPER_ADMIN');
  const hasPermission = isSuperAdmin || allowedRoles.some((r) => userRoles.includes(r));

  if (!hasPermission) {
    return <Navigate to={forbiddenTo} replace />;
  }

  return <>{children}</>;
};
```

---

### 6.3 GNB/LNB Role 기반 필터링 렌더링 로직

```typescript
// /src/components/layout/GNBLayout.tsx (핵심 렌더링 부분)
import React, { memo, useCallback } from 'react';
import { Layout, Menu as AntMenu, Avatar, Dropdown } from 'antd';
import { useMenuStore } from '../../stores/menuStore';
import { useMyMenus }   from '../../hooks/useMyMenus';
import type { MenuWithPermission } from '../../types/menu';

const { Header } = Layout;

export const GNBLayout: React.FC<GNBLayoutProps> = memo(({ children, userProfile, onLogout }) => {
  const { data, isLoading } = useMyMenus();
  const { selectedGNB, setSelectedGNB } = useMenuStore();

  // GNB 메뉴 (depth=1) — useMyMenus는 이미 Role 필터 적용됨
  const gnbMenus = data?.menus ?? [];

  const antMenuItems = gnbMenus.map((menu: MenuWithPermission) => ({
    key:   menu.menu_id,
    label: menu.menu_nm,
    icon:  menu.icon_class ? <span className={`icon-${menu.icon_class}`} /> : null,
  }));

  const handleGNBSelect = useCallback(
    ({ key }: { key: string }) => {
      const selected = gnbMenus.find((m) => m.menu_id === key) ?? null;
      setSelectedGNB(selected);
    },
    [gnbMenus, setSelectedGNB]
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        {/* 로고 */}
        <div className="logo">KKS Portal</div>

        {/* GNB 메뉴 — Role 필터링된 목록만 표시 */}
        <AntMenu
          mode="horizontal"
          theme="dark"
          selectedKeys={selectedGNB ? [selectedGNB.menu_id] : []}
          items={antMenuItems}
          onSelect={handleGNBSelect}
          style={{ flex: 1 }}
        />

        {/* 사용자 프로필 */}
        <Dropdown
          menu={{
            items: [
              { key: 'profile', label: '내 정보' },
              { key: 'logout',  label: '로그아웃', danger: true, onClick: onLogout },
            ],
          }}
        >
          <Avatar>{userProfile.username[0]}</Avatar>
        </Dropdown>
      </Header>

      {/* LNB + 콘텐츠 */}
      <Layout>
        <LNBLayout />
        <Layout.Content>{children}</Layout.Content>
      </Layout>
    </Layout>
  );
});

// /src/components/layout/LNBLayout.tsx (핵심 렌더링 부분)
export const LNBLayout: React.FC = memo(() => {
  const { selectedGNB, selectedLNB, setSelectedLNB, sidebarCollapsed, setSidebarCollapsed } =
    useMenuStore();

  // 선택된 GNB의 하위 LNB 메뉴만 추출 (이미 Role 필터 적용됨)
  const lnbMenus: MenuWithPermission[] = (selectedGNB?.children ?? []) as MenuWithPermission[];

  const antLNBItems = lnbMenus.map((menu) => ({
    key:   menu.menu_id,
    label: menu.menu_nm,
    icon:  menu.icon_class ? <span className={`icon-${menu.icon_class}`} /> : null,
    // write_yn 기반 읽기전용 배지
    ...(menu.write_yn === 'N' && { className: 'lnb-readonly' }),
  }));

  return (
    <Layout.Sider
      collapsible
      collapsed={sidebarCollapsed}
      onCollapse={setSidebarCollapsed}
      width={220}
    >
      <AntMenu
        mode="inline"
        theme="dark"
        selectedKeys={selectedLNB ? [selectedLNB.menu_id] : []}
        items={antLNBItems}
        onSelect={({ key }) => {
          const menu = lnbMenus.find((m) => m.menu_id === key) ?? null;
          setSelectedLNB(menu);
        }}
      />
    </Layout.Sider>
  );
});
```

---

## 7. 엑셀 업로드 플로우

### 7.1 업로드 단계 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ExcelUploadModal                              │
│                                                                     │
│  [1] SELECT                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  UploadFileSelector                                          │   │
│  │  - Ant Design Upload 드래그앤드롭                            │   │
│  │  - SheetJS 파일 읽기 (FileReader API)                        │   │
│  │  - 헤더 검증 → 오류 시 즉시 표시                              │   │
│  │  - [다음: 미리보기] 클릭 → POST /api/menus/upload/preview    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │ 성공                                   │
│                            ▼                                        │
│  [2] PREVIEW                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  UploadPreviewTable                                          │   │
│  │  - 유효 행: 일반 흰색 배경                                    │   │
│  │  - 오류 행: 빨간색 배경 + 오류 메시지 툴팁                    │   │
│  │  - 업로드 모드 선택 (ALL_OR_NOTHING / PARTIAL_SUCCESS)       │   │
│  │  - [확정 업로드] 클릭 → POST /api/menus/upload/confirm       │   │
│  │  - [이전] 버튼 → SELECT 단계로                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │ 성공                                   │
│                            ▼                                        │
│  [3] CONFIRM (로딩 중)                                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LoadingSpinner + "업로드 저장 중..." 텍스트                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            │ 완료                                   │
│                            ▼                                        │
│  [4] RESULT                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  UploadResultSummary                                         │   │
│  │  - 총/성공/실패 건수 카드                                     │   │
│  │  - 오류 있을 시 오류 엑셀 다운로드 버튼                       │   │
│  │  - [닫기] 버튼 → reset() + onUploadComplete()               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.2 `/utils/excelParser.ts` — 전체 코드

```typescript
// /src/utils/excelParser.ts
import * as XLSX from 'xlsx';
import type { MenuUploadRow } from '../types/upload';
import { UPLOAD_REQUIRED_HEADERS } from '../constants/uploadConfig';

export interface ParseResult {
  rows:    MenuUploadRow[];
  errors:  string[];
}

/**
 * SheetJS로 엑셀 파일을 파싱하여 MenuUploadRow 배열로 변환
 * @param file - input[type=file]에서 선택된 파일
 */
export async function parseMenuExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('파일을 읽을 수 없습니다.');

        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('시트를 찾을 수 없습니다.');

        const ws = wb.Sheets[sheetName];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
          raw:    false, // 날짜/숫자 문자열 변환
        });

        if (rawRows.length === 0) {
          resolve({ rows: [], errors: ['데이터 행이 없습니다.'] });
          return;
        }

        // 헤더 검증
        const actualHeaders  = Object.keys(rawRows[0]);
        const missingHeaders = UPLOAD_REQUIRED_HEADERS.filter(
          (h) => !actualHeaders.includes(h)
        );
        if (missingHeaders.length > 0) {
          resolve({
            rows:   [],
            errors: [`필수 헤더 누락: ${missingHeaders.join(', ')}`],
          });
          return;
        }

        // 행 변환
        const rows: MenuUploadRow[] = rawRows.map((raw, idx) => ({
          row_no:         idx + 2, // 1행 = 헤더, 2행부터 데이터
          menu_id:        String(raw['menu_id'] ?? '').trim() || undefined,
          menu_nm:        String(raw['menu_nm'] ?? '').trim(),
          menu_url:       String(raw['menu_url'] ?? '').trim(),
          parent_menu_id: String(raw['parent_menu_id'] ?? '').trim() || null,
          menu_depth:     Number(raw['menu_depth']) as 1 | 2,
          menu_order:     Number(raw['menu_order']),
          icon_class:     String(raw['icon_class'] ?? '').trim() || undefined,
          use_yn:         String(raw['use_yn'] ?? 'Y').trim().toUpperCase() as 'Y' | 'N',
          // "USER,ADMIN" → ['USER','ADMIN']
          allow_roles: String(raw['allow_roles'] ?? '')
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean),
        }));

        resolve({ rows, errors: [] });
      } catch (err: any) {
        reject(new Error(err.message ?? '엑셀 파싱 중 오류'));
      }
    };

    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

/** 파일 확장자 검증 */
export function validateExcelFile(file: File): string | null {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED  = ['.xlsx', '.xls'];

  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED.includes(ext)) return `허용 파일 형식: ${ALLOWED.join(', ')}`;
  if (file.size > MAX_SIZE)    return '파일 크기가 10MB를 초과합니다.';

  return null;
}
```

---

### 7.3 `/utils/excelExporter.ts` — 전체 코드

```typescript
// /src/utils/excelExporter.ts
import * as XLSX from 'xlsx';
import type { UploadErrorRow } from '../types/upload';

/**
 * 업로드 오류 행 엑셀 다운로드
 * - 오류 행: 빨간색 배경 (#FFCCCC)
 * - 오류 메시지: 별도 컬럼 추가
 */
export function exportUploadErrors(
  errorRows: UploadErrorRow[],
  fileName:  string = 'upload_errors.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  // 헤더 + 데이터 생성
  const HEADER = [
    '행번호', '메뉴명', '메뉴URL', '상위메뉴ID', 'depth',
    '순서', '아이콘', '사용여부', '허용Role', '오류컬럼', '오류내용',
  ];

  const DATA_ROWS = errorRows.flatMap((row) => {
    if (row.errors.length === 0) {
      return [[
        row.row_no,
        row.raw_data['menu_nm']        ?? '',
        row.raw_data['menu_url']       ?? '',
        row.raw_data['parent_menu_id'] ?? '',
        row.raw_data['menu_depth']     ?? '',
        row.raw_data['menu_order']     ?? '',
        row.raw_data['icon_class']     ?? '',
        row.raw_data['use_yn']         ?? '',
        row.raw_data['allow_roles']    ?? '',
        '',
        '알 수 없는 오류',
      ]];
    }
    return row.errors.map((err) => [
      row.row_no,
      row.raw_data['menu_nm']        ?? '',
      row.raw_data['menu_url']       ?? '',
      row.raw_data['parent_menu_id'] ?? '',
      row.raw_data['menu_depth']     ?? '',
      row.raw_data['menu_order']     ?? '',
      row.raw_data['icon_class']     ?? '',
      row.raw_data['use_yn']         ?? '',
      row.raw_data['allow_roles']    ?? '',
      err.column_nm,
      err.error_msg,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...DATA_ROWS]);

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 8  }, { wch: 20 }, { wch: 30 }, { wch: 36 },
    { wch: 8  }, { wch: 8  }, { wch: 15 }, { wch: 8  },
    { wch: 30 }, { wch: 15 }, { wch: 50 },
  ];

  // 오류 행 빨간 배경 스타일 적용
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };
      ws[cellAddr].s = {
        fill: {
          patternType: 'solid',
          fgColor:     { rgb: 'FFCCCC' }, // 빨간 배경
        },
        font: { color: { rgb: '990000' } },
        border: {
          top:    { style: 'thin', color: { rgb: 'FF0000' } },
          bottom: { style: 'thin', color: { rgb: 'FF0000' } },
          left:   { style: 'thin', color: { rgb: 'FF0000' } },
          right:  { style: 'thin', color: { rgb: 'FF0000' } },
        },
      };
    }
  }

  // 헤더 행 스타일 (회색 배경)
  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    font: { bold: true },
  };
  for (let C = 0; C <= range.e.c; C++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[cellAddr]) ws[cellAddr].s = headerStyle;
  }

  XLSX.utils.book_append_sheet(wb, ws, '오류목록');

  // 다운로드
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx', cellStyles: true });
}
```

---

### 7.4 `ExcelUploadModal.tsx` — 단계별 렌더링 로직

```typescript
// /src/components/upload/ExcelUploadModal.tsx
import React, { memo, useCallback } from 'react';
import { Modal, Steps }             from 'antd';
import { useUploadStore }           from '../../stores/uploadStore';
import { UploadFileSelector }       from './UploadFileSelector';
import { UploadPreviewTable }       from './UploadPreviewTable';
import { UploadResultSummary }      from './UploadResultSummary';
import { LoadingSpinner }           from '../common/LoadingSpinner';
import type { ExcelUploadModalProps } from '../../types/upload';

const STEP_MAP = { SELECT: 0, PREVIEW: 1, CONFIRM: 2, RESULT: 3 };
const STEP_TITLES = ['파일 선택', '미리보기', '저장 중', '완료'];

export const ExcelUploadModal: React.FC<ExcelUploadModalProps> = memo(
  ({ open, onClose, onUploadComplete }) => {
    const { step, isConfirmLoading, reset } = useUploadStore();

    const handleClose = useCallback(() => {
      if (isConfirmLoading) return; // 저장 중 닫기 방지
      reset();
      onClose();
    }, [isConfirmLoading, reset, onClose]);

    const handleComplete = useCallback(() => {
      reset();
      onUploadComplete();
      onClose();
    }, [reset, onUploadComplete, onClose]);

    const renderContent = () => {
      switch (step) {
        case 'SELECT':
          return <UploadFileSelector />;
        case 'PREVIEW':
          return <UploadPreviewTable />;
        case 'CONFIRM':
          return <LoadingSpinner tip="업로드 저장 중..." fullPage={false} />;
        case 'RESULT':
          return <UploadResultSummary onComplete={handleComplete} />;
        default:
          return null;
      }
    };

    return (
      <Modal
        title="메뉴 엑셀 업로드"
        open={open}
        onCancel={handleClose}
        footer={null}
        width={900}
        maskClosable={!isConfirmLoading}
        keyboard={!isConfirmLoading}
        destroyOnClose
      >
        {/* 단계 표시 */}
        <Steps
          current={STEP_MAP[step]}
          items={STEP_TITLES.map((title) => ({ title }))}
          style={{ marginBottom: 24 }}
        />

        {/* 단계별 컴포넌트 */}
        {renderContent()}
      </Modal>
    );
  }
);

ExcelUploadModal.displayName = 'ExcelUploadModal';
```

---

### 7.5 `UploadPreviewTable.tsx` — 오류행 하이라이트

```typescript
// /src/components/upload/UploadPreviewTable.tsx
import React, { memo, useMemo } from 'react';
import { Table, Tag, Tooltip, Radio, Button, Space, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useUploadStore }   from '../../stores/uploadStore';
import { useUploadConfirm } from '../../hooks/useUploadConfirm';
import type { MenuUploadRow, UploadErrorRow } from '../../types/upload';

type PreviewRow = (MenuUploadRow | UploadErrorRow) & {
  _isError: boolean;
  _errors?: UploadErrorRow['errors'];
};

export const UploadPreviewTable: React.FC = memo(() => {
  const {
    validRows, invalidRows, uploadMode,
    setUploadMode, setStep, isConfirmLoading,
  } = useUploadStore();
  const confirmMutation = useUploadConfirm();

  // 유효/오류 행 통합 및 정렬 (row_no 기준)
  const tableData: PreviewRow[] = useMemo(() => {
    const valid:   PreviewRow[] = validRows.map(
      (r) => ({ ...r, _isError: false })
    );
    const invalid: PreviewRow[] = invalidRows.map(
      (r) => ({ ...r, _isError: true, _errors: r.errors })
    );
    return [...valid, ...invalid].sort((a, b) => a.row_no - b.row_no);
  }, [validRows, invalidRows]);

  const columns: ColumnsType<PreviewRow> = [
    {
      title:     '행',
      dataIndex: 'row_no',
      width:     60,
      fixed:     'left',
      render: (v, record) =>
        record._isError ? (
          <Tooltip
            title={record._errors?.map((e) => e.error_msg).join('\n')}
            color="red"
          >
            <Tag color="red">{v}</Tag>
          </Tooltip>
        ) : (
          <Tag color="green">{v}</Tag>
        ),
    },
    { title: '메뉴명',  dataIndex: 'menu_nm',  ellipsis: true },
    { title: '메뉴URL', dataIndex: 'menu_url', ellipsis: true },
    { title: 'Depth',  dataIndex: 'menu_depth', width: 70, align: 'center' },
    { title: '순서',   dataIndex: 'menu_order', width: 70, align: 'center' },
    {
      title:     '허용 Role',
      dataIndex: 'allow_roles',
      render: (roles: string[]) =>
        roles?.map((r) => <Tag key={r}>{r}</Tag>),
    },
    {
      title:  '상태',
      width:  80,
      align:  'center',
      render: (_, record) =>
        record._isError
          ? <Tag color="red">오류</Tag>
          : <Tag color="green">유효</Tag>,
    },
  ];

  const handleConfirm = () => {
    confirmMutation.mutate({
      rows:        validRows,
      error_rows:  invalidRows,
      mode:        uploadMode,
      file_nm:     'upload.xlsx',
      upload_type: 'MENU',
      total_cnt:   validRows.length + invalidRows.length,
    } as any);
  };

  return (
    <div>
      {/* 요약 */}
      <Alert
        type={invalidRows.length > 0 ? 'warning' : 'success'}
        message={
          `전체 ${tableData.length}행 — 유효 ${validRows.length}건 / 오류 ${invalidRows.length}건`
        }
        style={{ marginBottom: 12 }}
      />

      {/* 업로드 모드 선택 */}
      <Space style={{ marginBottom: 12 }}>
        <span>업로드 모드:</span>
        <Radio.Group
          value={uploadMode}
          onChange={(e) => setUploadMode(e.target.value)}
        >
          <Radio value="PARTIAL_SUCCESS">부분 저장 (유효 행만)</Radio>
          <Radio
            value="ALL_OR_NOTHING"
            disabled={invalidRows.length > 0}
          >
            전체 저장 (오류 시 전체 취소)
          </Radio>
        </Radio.Group>
      </Space>

      {/* 미리보기 테이블 */}
      <Table<PreviewRow>
        dataSource={tableData}
        columns={columns}
        rowKey="row_no"
        size="small"
        scroll={{ x: 900, y: 400 }}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        /**
         * Ant Design rowClassName으로 오류행 배경색 적용
         */
        rowClassName={(record) =>
          record._isError ? 'upload-preview-error-row' : ''
        }
      />

      {/* 버튼 */}
      <Space style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => setStep('SELECT')}>이전</Button>
        <Button
          type="primary"
          loading={isConfirmLoading}
          disabled={
            validRows.length === 0 ||
            (uploadMode === 'ALL_OR_NOTHING' && invalidRows.length > 0)
          }
          onClick={handleConfirm}
        >
          확정 업로드 ({validRows.length}건)
        </Button>
      </Space>

      {/* 오류행 빨간 배경 CSS */}
      <style>{`
        .upload-preview-error-row td {
          background-color: #fff2f0 !important;
        }
        .upload-preview-error-row:hover td {
          background-color: #ffebe8 !important;
        }
      `}</style>
    </div>
  );
});

UploadPreviewTable.displayName = 'UploadPreviewTable';
```

---

## 8. 라우터 설정

### 8.1 `/router/index.tsx` — 전체 코드

```typescript
// /src/router/index.tsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';
import { RoleRoute }    from './RoleRoute';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ROLES }        from '../constants/roles';

// ── Code Splitting (lazy) ──
const HomePage       = lazy(() => import('../pages/HomePage'));
const LoginPage      = lazy(() => import('../pages/LoginPage'));
const ForbiddenPage  = lazy(() => import('../pages/ForbiddenPage'));
const NotFoundPage   = lazy(() => import('../pages/NotFoundPage'));

// Admin Pages
const MenuManagePage = lazy(() => import('../pages/admin/MenuManagePage'));
const MenuUploadPage = lazy(() => import('../pages/admin/MenuUploadPage'));
const RoleManagePage = lazy(() => import('../pages/admin/RoleManagePage'));
const MenuRolePage   = lazy(() => import('../pages/admin/MenuRolePage'));
const UserRolePage   = lazy(() => import('../pages/admin/UserRolePage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner tip="페이지 로딩 중..." />}>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="/404"       element={<NotFoundPage />} />

        {/* 인증 필요 라우트 */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />

        {/* ── 관리자 전용 라우트 ── */}
        <Route
          path="/admin/menus"
          element={
            <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
              <MenuManagePage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/menus/upload"
          element={
            <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
              <MenuUploadPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <RoleManagePage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/menu-roles"
          element={
            <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <MenuRolePage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/user-roles"
          element={
            <RoleRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
              <UserRolePage />
            </RoleRoute>
          }
        />

        {/* 폴백 */}
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
```

---

### 8.2 라우트 목록 표

| 경로 | 컴포넌트 | 접근 Role | 인증 필요 | 비고 |
|------|---------|----------|----------|------|
| `/login` | `LoginPage` | 전체 | ✗ | 로그인 후 → `/` 리다이렉트 |
| `/forbidden` | `ForbiddenPage` | 전체 | ✗ | 403 페이지 |
| `/404` | `NotFoundPage` | 전체 | ✗ | 404 페이지 |
| `/` | `HomePage` | 로그인 유저 | ✅ | 포털 메인 |
| `/admin/menus` | `MenuManagePage` | SUPER_ADMIN, ADMIN | ✅ | GNB/LNB 메뉴 관리 |
| `/admin/menus/upload` | `MenuUploadPage` | SUPER_ADMIN, ADMIN | ✅ | 엑셀 업로드 이력 |
| `/admin/roles` | `RoleManagePage` | SUPER_ADMIN | ✅ | Role CRUD |
| `/admin/menu-roles` | `MenuRolePage` | SUPER_ADMIN | ✅ | 메뉴-Role 매핑 매트릭스 |
| `/admin/user-roles` | `UserRolePage` | SUPER_ADMIN, ADMIN | ✅ | 사용자 Role 부여/회수 |
| `*` | → `/404` | 전체 | ✗ | 미매칭 경로 |

---

## 9. 성능 최적화 전략

### 9.1 React.memo 적용 대상

| 컴포넌트 | 적용 이유 |
|---------|----------|
| `GNBLayout` | 프로바이더 리렌더링에도 GNB는 메뉴 변경 시에만 갱신 필요 |
| `LNBLayout` | 선택된 GNB 변경 시에만 재렌더링 필요 |
| `MenuTreeTable` | dataSource prop 동일 시 불필요한 트리 재렌더링 방지 |
| `UploadPreviewTable` | 대용량 행 목록, 재렌더링 비용 큼 |
| `MenuRoleMapper` | 매트릭스 전체 행 수 많음 (메뉴 수 × Role 수) |
| `PermissionGuard` | 전역에서 많이 사용, roles 변경 시에만 갱신 |
| `RoleTable` | dataSource prop 안 바뀌면 재렌더링 불필요 |

---

### 9.2 useMemo / useCallback 적용 위치

```typescript
// ── useMemo ──

// MenuTreeTable: 트리 변환은 비용이 높음
const treeData = useMemo(() => buildTree(rawMenus), [rawMenus]);

// MenuRoleMapper: 매트릭스 dirty 상태 감지
const hasChanges = useMemo(
  () => JSON.stringify(localMatrix) !== JSON.stringify(originalMatrix),
  [localMatrix, originalMatrix]
);

// UploadPreviewTable: 유효/오류 행 통합 정렬
const tableData = useMemo(
  () => [...validRows.map(...), ...invalidRows.map(...)].sort(...),
  [validRows, invalidRows]
);

// useMenuPermission: URL로 메뉴 탐색
const permission = useMemo(() => findMenuByUrl(menuTree, menuUrl), [menuTree, menuUrl]);

// ── useCallback ──

// GNBLayout: GNB 클릭 핸들러
const handleGNBSelect = useCallback(
  ({ key }) => setSelectedGNB(...),
  [gnbMenus, setSelectedGNB]
);

// MenuFormModal: Ant Design Form submit
const handleSubmit = useCallback(
  async (values) => { await saveMenu(values); onSuccess(); },
  [saveMenu, onSuccess]
);

// UserRoleManager: Role 부여/회수
const handleGrant  = useCallback((body) => grantMutation.mutate(body), [grantMutation]);
const handleRevoke = useCallback((id)   => revokeMutation.mutate(id),  [revokeMutation]);
```

---

### 9.3 React.lazy 코드 스플리팅 대상

| 대상 | 이유 |
|------|------|
| 모든 `pages/admin/*.tsx` | 관리자만 접근 — 일반 유저는 번들 불필요 |
| `ExcelUploadModal` + SheetJS(`xlsx`) | xlsx 라이브러리 약 1MB → 업로드 화면 최초 접근 시 로드 |
| `MenuRoleMapper` | 대형 매트릭스 컴포넌트 — 지연 로드 적합 |
| `UploadLogTable` | 관리자 세부 기능 |

```typescript
// SheetJS 동적 import (업로드 요청 시점에만 로드)
const parseExcel = async (file: File) => {
  const { parseMenuExcel } = await import('../utils/excelParser');
  return parseMenuExcel(file);
};
```

---

### 9.4 TanStack Query 캐시 전략

| queryKey | staleTime | gcTime | refetchOnWindowFocus | 이유 |
|----------|-----------|--------|---------------------|------|
| `['menus']` | **5분** | 30분 | false | 전체 메뉴 트리 변경 빈도 낮음 |
| `['menus','my']` | **3분** | 10분 | false | 사용자별 권한 필터 — 로그인 직후 신선도 필요 |
| `['roles']` | **10분** | 30분 | false | Role 등록/삭제 빈도 매우 낮음 |
| `['menu-roles']` | **5분** | 20분 | false | 매트릭스 변경 적음 |
| `['user-roles', userId]` | **2분** | 10분 | false | 관리자 작업 직후 갱신 필요 |
| `['upload-logs']` | **1분** | 5분 | true | 최근 업로드 이력 신선도 필요 |

---

### 9.5 100만 유저 기준 메뉴 트리 렌더링 최적화

**문제**: 메뉴가 수백 개 이상일 때 트리 테이블 DOM 비용 증가

**최적화 방안**:

```typescript
// 1. react-window 가상화 (MenuTreeTable 내부)
import { FixedSizeList as List } from 'react-window';

// Ant Design Tree를 평탄화된 가상 목록으로 대체
const flattenedTree = useMemo(() => flattenTree(treeData), [treeData]);

<List
  height={600}
  itemCount={flattenedTree.length}
  itemSize={40}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MenuTreeRow menu={flattenedTree[index]} />
    </div>
  )}
</List>

// 2. useMyMenus 결과 memoize (menuStore에 저장 후 재계산 방지)
// → menuStore.menuTree를 단일 진실 소스로 사용

// 3. GNB/LNB 분리 렌더링
// → GNB 클릭 시 해당 children만 LNB로 슬라이싱
//    전체 트리 재렌더링 불필요

// 4. Vercel Edge CDN 캐시 (GET /api/menus)
// → s-maxage=300으로 CDN에서 직접 응답
//    DB 쿼리 없이 수백만 요청 처리 가능
```

---

## 10. 환경변수 및 설정 파일

### 10.1 `.env.local` 전체 목록

```bash
# ─────────────────────────────────────────────────────
# Vite 프론트엔드 환경변수 (VITE_ prefix 필수)
# ─────────────────────────────────────────────────────

# Supabase 프로젝트 URL (공개)
VITE_SUPABASE_URL=https://hqyfkgwyblncdohrrgii.supabase.co

# Supabase anon 키 (공개 — RLS 정책으로 보호됨)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API 베이스 URL
# 로컬 개발: http://localhost:3000 (Vite proxy 사용 시 생략 가능)
# 배포:      https://act2026.vercel.app
VITE_API_BASE_URL=http://localhost:3000

# 앱 이름 (document.title 등)
VITE_APP_NAME=KKS 엔터프라이즈 포털

# 개발 모드 여부 (mock API 전환 등)
VITE_DEV_MODE=true
```

---

### 10.2 `/lib/queryClient.ts`

```typescript
// /src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 전역 기본값 (각 훅에서 오버라이드 가능)
      staleTime:            2 * 60 * 1000, // 2분
      gcTime:               10 * 60 * 1000, // 10분
      retry:                2,
      retryDelay:           (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 0, // mutation은 재시도 안 함 (중복 저장 방지)
    },
  },
});
```

---

### 10.3 `tsconfig.json` 권장 설정

```json
{
  "compilerOptions": {
    "target":              "ES2020",
    "useDefineForClassFields": true,
    "lib":                 ["ES2020", "DOM", "DOM.Iterable"],
    "module":              "ESNext",
    "skipLibCheck":        true,
    "moduleResolution":    "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule":   true,
    "isolatedModules":     true,
    "noEmit":              true,
    "jsx":                 "react-jsx",
    "strict":              true,
    "noUnusedLocals":      true,
    "noUnusedParameters":  true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*":       ["./src/*"],
      "@api/*":    ["./src/api/*"],
      "@comp/*":   ["./src/components/*"],
      "@hooks/*":  ["./src/hooks/*"],
      "@stores/*": ["./src/stores/*"],
      "@types/*":  ["./src/types/*"],
      "@utils/*":  ["./src/utils/*"],
      "@lib/*":    ["./src/lib/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

### 10.4 `package.json` 주요 의존성

```json
{
  "name": "kks-portal-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react":                   "^18.3.1",
    "react-dom":               "^18.3.1",
    "react-router-dom":        "^6.23.0",
    "@supabase/supabase-js":   "^2.46.0",
    "@tanstack/react-query":   "^5.40.0",
    "zustand":                 "^4.5.2",
    "antd":                    "^5.18.0",
    "@ant-design/icons":       "^5.3.7",
    "axios":                   "^1.7.2",
    "xlsx":                    "^0.18.5",
    "react-window":            "^1.8.10"
  },
  "devDependencies": {
    "@types/react":                "^18.3.3",
    "@types/react-dom":            "^18.3.0",
    "@types/react-window":         "^1.8.8",
    "@tanstack/react-query-devtools": "^5.40.0",
    "@vitejs/plugin-react":        "^4.3.0",
    "typescript":                  "^5.4.5",
    "vite":                        "^5.3.0"
  },
  "scripts": {
    "dev":     "vite",
    "build":   "tsc && vite build",
    "preview": "vite preview",
    "lint":    "eslint src --ext .ts,.tsx"
  }
}
```

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `react` | ^18.3.1 | UI 렌더링 |
| `react-router-dom` | ^6.23.0 | SPA 라우팅 |
| `@supabase/supabase-js` | ^2.46.0 | Auth + DB 클라이언트 |
| `@tanstack/react-query` | ^5.40.0 | 서버 상태 캐싱 |
| `zustand` | ^4.5.2 | 클라이언트 전역 상태 |
| `antd` | ^5.18.0 | UI 컴포넌트 라이브러리 |
| `axios` | ^1.7.2 | HTTP 클라이언트 |
| `xlsx` | ^0.18.5 | 엑셀 파싱/생성 |
| `react-window` | ^1.8.10 | 대용량 목록 가상화 |
