# 일반 사용자 GNB/LNB 자동 노출 등록 가이드

작성일: 2026-03-24

---

## 동작 원리

```
사용자 로그인 (JWT)
    ↓
GNBLayout 마운트 → useMyMenus() → GET /api/menus/my
    ↓
[서버] user_id → tb_user_role → tb_role → tb_menu_role → tb_menu (use_yn='Y')
    ↓
myMenus[] 반환 (Zustand menuStore에 저장)
    ↓
menu_depth=1 → GNB 상단 표시
menu_depth=2 → LNB 좌측 표시 (parent_menu_id로 GNB와 연결)
```

---

## 등록 순서 (5단계)

### Step 1 — Role 생성 → /admin/roles

| 항목        | 예시       |
|-------------|------------|
| Role 코드   | USER       |
| Role 명     | 일반사용자 |
| 사용 여부   | ON         |

※ Role이 없으면 메뉴 매핑 자체가 불가합니다.

---

### Step 2 — GNB 메뉴 등록 → /admin/menus → [메뉴 추가]

| 항목        | 설정값                    |
|-------------|---------------------------|
| 메뉴 구분   | GNB (상단 메뉴) menu_depth=1 |
| 메뉴명      | 공지사항                  |
| 메뉴 URL    | /notice                   |
| 순서        | 1                         |
| 사용 여부   | ON                        |

---

### Step 3 — LNB 메뉴 등록 → /admin/menus → [메뉴 추가]

| 항목            | 설정값                       |
|-----------------|------------------------------|
| 메뉴 구분       | LNB (좌측 메뉴) menu_depth=2 |
| 상위 GNB 메뉴   | Step 2에서 만든 GNB 선택     |
| 메뉴명          | 공지 목록                    |
| 메뉴 URL        | /notice/list                 |
| 순서            | 1                            |
| 사용 여부       | ON                           |

※ LNB 등록 시 반드시 상위 GNB 메뉴를 선택해야 parent_menu_id가 설정되어
  LNB가 올바른 GNB 하위에 표시됩니다.

---

### Step 4 — 메뉴-Role 매핑 → /admin/menu-roles → [매핑 추가]

| 항목      | 설정값                          |
|-----------|---------------------------------|
| 메뉴 선택 | Step 2/3에서 만든 메뉴          |
| Role 선택 | Step 1에서 만든 Role (USER)     |

※ GNB 메뉴와 LNB 메뉴 각각 매핑 추가가 필요합니다.
  - GNB만 매핑하면 LNB는 안 보임
  - LNB만 매핑하면 GNB가 안 보임

---

### Step 5 — 사용자에게 Role 부여 → /admin/user-roles

| 항목      | 설정값                         |
|-----------|--------------------------------|
| 사용자    | 대상 일반 사용자 선택          |
| Role      | Step 1에서 만든 Role (USER) 체크 |

---

## 결과 확인

일반 사용자로 로그인하면:

- GNB: menu_depth=1, use_yn='Y'이고 해당 Role이 매핑된 메뉴 자동 표시
- LNB: 현재 활성 GNB의 menu_id를 parent_menu_id로 가지는 menu_depth=2 메뉴 자동 표시
- LNB 하위 메뉴가 없는 GNB → 클릭 시 직접 해당 URL로 이동
- LNB 하위 메뉴가 있는 GNB → 드롭다운 형태로 자동 전환됨

---

## 최종 체크리스트

  □ Role 생성 (use_yn=ON)
  □ GNB 메뉴 등록 (menu_depth=1, use_yn=ON)
  □ LNB 메뉴 등록 (menu_depth=2, 상위GNB 선택, use_yn=ON)
  □ GNB 메뉴 ↔ Role 매핑 추가
  □ LNB 메뉴 ↔ Role 매핑 추가  ← 빠뜨리기 쉬움!
  □ 사용자 ↔ Role 부여
  □ 해당 사용자로 재로그인 후 확인

---

## 관련 소스 파일 위치

- GNB 렌더링:  frontend/src/components/layout/GNBLayout.tsx
- LNB 렌더링:  frontend/src/components/layout/LNBLayout.tsx
- 메뉴 스토어: frontend/src/stores/menuStore.ts
- 내메뉴 훅:   frontend/src/hooks/useMenuTree.ts (useMyMenus)
- 메뉴 API:    frontend/src/api/menuApi.ts (getMy → GET /api/menus/my)

---

## DB 테이블 관계

  tb_role          : Role 정의
  tb_menu          : 메뉴 정의 (menu_depth 1=GNB, 2=LNB)
  tb_menu_role     : 메뉴 ↔ Role 매핑 (read_yn='Y')
  tb_user_role     : 사용자 ↔ Role 부여
  profiles         : 사용자 정보
