# GNB/LNB 메뉴 엑셀 업로드 전체 스펙

> **프로젝트명**: KKS 엔터프라이즈 포털  
> **버전**: v1.0  
> **기술스택**: React 18 + TypeScript / SheetJS / Node.js Serverless (Vercel) / Supabase PostgreSQL

---

## 목차

| # | 항목 |
|---|------|
| 1 | 엑셀 파일 컬럼 정의 |
| 2 | 유효성 검사 규칙 (25개) |
| 3 | 업로드 처리 로직 상세 흐름 |
| 4 | 오류 처리 정책 |
| 5 | API 명세 (Node.js Serverless) |
| 6 | 오류 결과 다운로드 파일 스펙 |
| 7 | 샘플 엑셀 데이터 (15행) |
| 8 | React 컴포넌트 연동 가이드 |

---

## 1. 엑셀 파일 컬럼 정의

### 1.1 컬럼 구성표

| 순번 | 헤더명 | 영문 Key | 필수여부 | 데이터타입 | 유효성 규칙 | 오류코드 | 예시값 |
|------|--------|---------|---------|-----------|------------|---------|--------|
| A | 메뉴ID | menu_id | 선택 | UUID 문자열 | UUID v4 형식 또는 빈값 (수정 시 사용) | ERR_FORMAT_UUID | `3f7b2c1d-...` |
| B | 메뉴명 | menu_nm | **필수** | 문자열 | 1~100자, 특수문자 `<>` 불가 | ERR_REQUIRED, ERR_LENGTH | `공지사항` |
| C | 메뉴URL | menu_url | **필수** | 문자열 | `/`로 시작, 1~255자, 영문/숫자/`-_/` | ERR_REQUIRED, ERR_FORMAT_URL | `/work/notice` |
| D | 상위메뉴ID | parent_menu_id | 조건부 필수 | UUID 문자열 | 메뉴깊이=2이면 필수, 존재하는 menu_id여야 함 | ERR_REQUIRED_IF, ERR_REF_NOT_FOUND | `2f3a1b0c-...` |
| E | 메뉴깊이 | menu_depth | **필수** | 정수 | 1 또는 2 만 허용 (1=GNB, 2=LNB) | ERR_REQUIRED, ERR_RANGE | `1` |
| F | 정렬순서 | menu_order | **필수** | 정수 | 1~999 사이 정수 | ERR_REQUIRED, ERR_RANGE | `3` |
| G | 아이콘CLASS | icon_class | 선택 | 문자열 | 최대 100자, 영문/숫자/`-_` | ERR_LENGTH | `bell` |
| H | 사용여부 | use_yn | **필수** | 문자열 | `Y` 또는 `N` 만 허용 (대소문자 구분 없음) | ERR_REQUIRED, ERR_VALUE | `Y` |
| I | 허용ROLE코드 | allow_roles | **필수** | 문자열 | 콤마 구분 복수 입력, 각 코드는 `tb_role.role_cd` 존재 여부 확인 | ERR_REQUIRED, ERR_REF_ROLE | `SUPER_ADMIN,ADMIN,USER` |

### 1.2 헤더 행 규칙

- **1행**: 헤더 행 (컬럼명 영문 Key 또는 한글명 모두 허용)
- **2행~**: 데이터 행
- 최대 처리 행 수: **10,000행** (2행~10,001행)
- 지원 파일 형식: `.xlsx`, `.xls`
- 최대 파일 크기: **10MB**

### 1.3 헤더 허용 명칭 매핑

| 영문 Key | 허용 한글 헤더명 |
|---------|----------------|
| menu_id | 메뉴ID, menuId, MENU_ID |
| menu_nm | 메뉴명, menuNm, MENU_NM, 메뉴이름 |
| menu_url | 메뉴URL, menuUrl, MENU_URL, URL |
| parent_menu_id | 상위메뉴ID, parentMenuId, PARENT_ID |
| menu_depth | 메뉴깊이, menuDepth, DEPTH |
| menu_order | 정렬순서, menuOrder, SORT_ORDER, ORDER |
| icon_class | 아이콘CLASS, iconClass, ICON |
| use_yn | 사용여부, useYn, USE_YN |
| allow_roles | 허용ROLE코드, allowRoles, ROLES |

---

## 2. 유효성 검사 규칙 (25개)

### 2.1 필수값 검사 (5개)

| 규칙번호 | 대상컬럼 | 검사내용 | 오류코드 | 오류메시지 |
|---------|---------|---------|---------|-----------|
| V-001 | 메뉴명 | 값이 null, 빈 문자열, 공백만인 경우 오류 | ERR_REQUIRED | `메뉴명은 필수 입력값입니다.` |
| V-002 | 메뉴URL | 값이 null, 빈 문자열, 공백만인 경우 오류 | ERR_REQUIRED | `메뉴URL은 필수 입력값입니다.` |
| V-003 | 메뉴깊이 | 값이 null 또는 빈 문자열인 경우 오류 | ERR_REQUIRED | `메뉴깊이는 필수 입력값입니다.` |
| V-004 | 사용여부 | 값이 null 또는 빈 문자열인 경우 오류 | ERR_REQUIRED | `사용여부는 필수 입력값입니다.` |
| V-005 | 허용ROLE코드 | 값이 null, 빈 문자열, 또는 공백만인 경우 오류 | ERR_REQUIRED | `허용ROLE코드는 필수 입력값입니다. 최소 1개 입력 필요.` |

### 2.2 형식/타입 검사 (5개)

| 규칙번호 | 대상컬럼 | 검사내용 | 오류코드 | 오류메시지 |
|---------|---------|---------|---------|-----------|
| V-006 | 메뉴URL | `/`로 시작하지 않는 경우, 또는 허용되지 않는 문자 포함 (`<>"{}`) | ERR_FORMAT_URL | `메뉴URL은 /로 시작해야 하며 특수문자(<>"{ })를 포함할 수 없습니다.` |
| V-007 | 메뉴깊이 | 숫자가 아니거나 소수점 포함 (예: "1.5", "abc") | ERR_FORMAT_INT | `메뉴깊이는 정수(1 또는 2)로 입력해야 합니다.` |
| V-008 | 정렬순서 | 숫자가 아니거나 소수점 포함 | ERR_FORMAT_INT | `정렬순서는 정수로 입력해야 합니다.` |
| V-009 | 사용여부 | Y, N 이외의 값 입력 (대소문자 무관하게 정규화 후 재검사) | ERR_VALUE | `사용여부는 Y 또는 N만 입력 가능합니다.` |
| V-010 | 메뉴ID | 값이 존재하나 UUID v4 형식이 아닌 경우 | ERR_FORMAT_UUID | `메뉴ID는 UUID 형식이어야 합니다. (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)` |

### 2.3 범위/길이 검사 (5개)

| 규칙번호 | 대상컬럼 | 검사내용 | 오류코드 | 오류메시지 |
|---------|---------|---------|---------|-----------|
| V-011 | 메뉴명 | 문자열 길이가 100자를 초과하는 경우 | ERR_LENGTH | `메뉴명은 최대 100자까지 입력 가능합니다. (현재: {N}자)` |
| V-012 | 메뉴URL | 문자열 길이가 255자를 초과하는 경우 | ERR_LENGTH | `메뉴URL은 최대 255자까지 입력 가능합니다. (현재: {N}자)` |
| V-013 | 메뉴깊이 | 1 또는 2가 아닌 경우 (0, 3, 음수 등) | ERR_RANGE | `메뉴깊이는 1(GNB) 또는 2(LNB)만 허용됩니다.` |
| V-014 | 정렬순서 | 1 미만 또는 999 초과인 경우 | ERR_RANGE | `정렬순서는 1~999 사이의 값이어야 합니다.` |
| V-015 | 아이콘CLASS | 문자열 길이가 100자를 초과하는 경우 | ERR_LENGTH | `아이콘CLASS는 최대 100자까지 입력 가능합니다.` |

### 2.4 참조 무결성 검사 (5개)

| 규칙번호 | 대상컬럼 | 검사내용 | 오류코드 | 오류메시지 |
|---------|---------|---------|---------|-----------|
| V-016 | 상위메뉴ID | 메뉴깊이=2인데 상위메뉴ID가 빈값인 경우 (조건부 필수) | ERR_REQUIRED_IF | `메뉴깊이가 2(LNB)이면 상위메뉴ID는 필수입니다.` |
| V-017 | 상위메뉴ID | 상위메뉴ID가 DB 또는 같은 파일 내 GNB 행에 존재하지 않는 경우 | ERR_REF_NOT_FOUND | `상위메뉴ID({value})에 해당하는 메뉴가 존재하지 않습니다.` |
| V-018 | 상위메뉴ID | 상위메뉴ID로 지정된 메뉴의 menu_depth가 1이 아닌 경우 (LNB→LNB 하위 불가) | ERR_REF_DEPTH | `상위메뉴ID는 GNB(메뉴깊이=1) 메뉴만 지정 가능합니다. (3depth 이상 불가)` |
| V-019 | 허용ROLE코드 | 콤마 분리된 각 role_cd가 `tb_role` 테이블에 존재하지 않는 경우 | ERR_REF_ROLE | `허용ROLE코드 '{value}'는 존재하지 않는 Role 코드입니다.` |
| V-020 | 메뉴ID | 수정 모드(menu_id 있음)에서 해당 menu_id가 DB에 존재하지 않는 경우 | ERR_REF_NOT_FOUND | `메뉴ID({value})에 해당하는 메뉴가 DB에 존재하지 않습니다. 신규 등록 시 메뉴ID는 비워두세요.` |

### 2.5 중복 검사 (5개)

| 규칙번호 | 대상컬럼 | 검사내용 | 오류코드 | 오류메시지 |
|---------|---------|---------|---------|-----------|
| V-021 | 메뉴URL | 같은 파일 내 동일한 menu_url이 2개 이상 존재하는 경우 (파일 내 중복) | ERR_DUPLICATE_FILE | `파일 내 메뉴URL이 중복됩니다. (행 {N}과 현재 행 충돌)` |
| V-022 | 메뉴URL | DB의 `tb_menu.menu_url`에 이미 존재하는 값인 경우 (DB 중복) | ERR_DUPLICATE_DB | `메뉴URL({value})이 이미 등록되어 있습니다.` |
| V-023 | 메뉴명 + 상위메뉴ID | 같은 상위메뉴 하위에 동일한 메뉴명이 파일 내에서 2개 이상 존재하는 경우 | ERR_DUPLICATE_NM | `같은 상위 메뉴 하위에 동일한 메뉴명이 중복됩니다.` |
| V-024 | 메뉴ID | 파일 내 동일한 menu_id가 2개 이상 존재하는 경우 (수정 대상 중복) | ERR_DUPLICATE_ID | `파일 내 메뉴ID({value})가 중복 입력되었습니다.` |
| V-025 | 정렬순서 + 상위메뉴ID | 같은 상위 메뉴 하위에 동일한 정렬순서가 파일 내 2개 이상 존재하는 경우 | ERR_DUPLICATE_ORDER | `같은 상위 메뉴 하위에 정렬순서가 중복됩니다. (현재: {N})` |

---

## 3. 업로드 처리 로직 상세 흐름

```
[프론트엔드]                          [백엔드: Node.js /api]           [DB: Supabase]
     │                                         │                           │
 3.1 파일 수신/확장자 검사                      │                           │
     │                                         │                           │
 3.2 SheetJS 파싱                              │                           │
     │                                         │                           │
 3.3 헤더 검증                                 │                           │
     │                                         │                           │
 3.4 행별 유효성 검사 ──────── (Role코드 조회) ──→                      ./tb_role
     │                                         │                           │
 3.5 미리보기 렌더링                            │                           │
     │                                         │                           │
 3.6 확정 클릭 → API 호출 ──────────────────────→                           │
                                          3.7 2차 유효성 검사               │
                                               │                           │
                                          3.8 트랜잭션 저장 ───────────→ tb_menu
                                               │                           │
                                          3.9 이력 저장 ─────────────→ tb_menu_upload_log
                                               │                           │
                                          3.10 오류 저장 ────────────→ tb_menu_upload_error
                                               │                           │
 3.12 결과 렌더링 ◀──────────────────────── 3.11 결과 JSON 반환
```

### 3.1 파일 수신 및 확장자 검사 (프론트엔드)

**담당**: 프론트엔드 (React)  
**처리 위치**: `<FileDropZone>` 컴포넌트의 `onChange` / `onDrop` 핸들러

| 검사 항목 | 검사 방법 | 오류 처리 |
|----------|----------|----------|
| 파일 확장자 | `file.name` 의 `.xlsx`, `.xls` 여부 확인 | 인라인 에러 메시지 표시, 파싱 중단 |
| MIME 타입 | `file.type` 이 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 또는 `application/vnd.ms-excel` 인지 확인 | 동일 |
| 파일 크기 | `file.size <= 10 * 1024 * 1024` (10MB) | "파일 크기가 10MB를 초과합니다." |
| 파일 선택 여부 | `files.length > 0` | [다음] 버튼 비활성 |

### 3.2 SheetJS 파싱 (프론트엔드)

**담당**: 프론트엔드  
**처리 위치**: `useUploadParser` 커스텀 훅

```
① FileReader.readAsArrayBuffer(file) 로 바이너리 로드
② XLSX.read(buffer, { type: 'array', cellDates: true }) 로 Workbook 생성
③ 첫 번째 시트(SheetNames[0]) 선택
④ XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) 로 2D 배열 변환
⑤ 1행(헤더) 분리 → 2행~ 데이터 행으로 구분
⑥ 빈 행(모든 셀이 빈 값) 제거 (중간 빈 행 처리)
⑦ 행 수 검사: 0행이면 "데이터가 없습니다", 10,000행 초과면 오류
```

### 3.3 헤더 검증 (프론트엔드)

**담당**: 프론트엔드  
**처리 위치**: `validateHeaders()` 함수

```
① 파싱된 1행 배열을 toLowerCase() + trim() 후 표준 Key로 매핑 시도
② 필수 헤더(menu_nm, menu_url, menu_depth, menu_order, use_yn, allow_roles) 존재 여부 확인
③ 누락된 필수 헤더가 있으면 오류 팝업 출력 후 파싱 중단
   → "필수 헤더가 누락되었습니다: [메뉴명, 메뉴URL]"
④ 인식할 수 없는 헤더가 있으면 경고(Warning)만 출력 (무시하고 계속 진행)
```

### 3.4 행별 유효성 검사 (프론트엔드)

**담당**: 프론트엔드  
**처리 위치**: `validateRows(rows, existingRoles)` 함수  
**사전 준비**: Role 목록은 `GET /api/roles` 로 미리 조회하여 메모리에 캐시

```
① 각 행을 순서대로 순회
② 섹션 2의 유효성 규칙 V-001 ~ V-025 순서대로 검사
③ 각 행의 오류 목록을 배열로 누적: { rowNo, colNm, errorCd, errorMsg }
④ 중복 검사(V-021~V-025)는 전체 행 순회 후 일괄 검사 (Map 자료구조 활용)
⑤ 결과: ValidRow[] (정상) + ErrorRow[] (오류) 로 분리
⑥ 하나의 행에 복수 오류 발생 가능 → 모든 오류를 누적하여 표시
```

### 3.5 미리보기 렌더링 (프론트엔드)

**담당**: 프론트엔드  
**처리 위치**: `UploadPreviewTable` 컴포넌트

```
① 전체 행 수 / 정상 행 수 / 오류 행 수 요약 바 렌더링
② 오류 행: 행 전체를 빨간 배경(#FEF2F2) + 빨간 테두리로 하이라이트
③ 오류 셀: 해당 셀에 빨간 밑줄 + 호버 시 툴팁으로 오류 메시지 표시
④ 필터 탭: [전체] / [정상만] / [오류만] 탭으로 전환 가능
⑤ 10,000행 대용량: react-window의 VariableSizeList로 가상 스크롤 적용
⑥ [오류 행 다운로드] 버튼: 오류 행만 추출하여 xlsx 생성 후 다운로드
```

### 3.6 사용자 확정 클릭 → API 호출 (프론트엔드 → 백엔드)

**담당**: 프론트엔드  
**처리 위치**: `handleConfirmUpload()` 함수

```
① 사용자가 오류 처리 모드 선택: ALL_OR_NOTHING / PARTIAL_SUCCESS
   - 오류 0건: [확정 저장] 버튼만 활성
   - 오류 N건: [오류 무시하고 저장 (PARTIAL)] / [전체 취소 (ALL_OR_NOTHING)] 선택 안내

② Request Body 구성:
   {
     rows: ValidRow[],          // 정상 행 배열
     errorRows: ErrorRow[],     // 오류 행 배열 (이력 저장용)
     mode: "ALL_OR_NOTHING" | "PARTIAL_SUCCESS",
     uploadType: "MENU"
   }

③ axios.post('/api/menus/upload/confirm', body, {
     headers: { Authorization: `Bearer ${token}` }
   })

④ 업로드 진행 중 ProgressBar 표시 (axios onUploadProgress 이벤트 활용)
⑤ 응답 수신 후 SB-009 결과 화면으로 상태 전달
```

### 3.7 Node.js API 수신 및 2차 유효성 검사 (백엔드)

**담당**: 백엔드 (Node.js Serverless `/api/menus/upload/confirm.js`)

```
① Authorization 헤더에서 JWT 추출 → 검증
② 요청 사용자 Role 확인 (MANAGER 이상만 허용)
③ rows 배열 수신 후 서버 측 2차 유효성 검사:
   - menu_url DB 중복 여부: SELECT menu_url FROM tb_menu WHERE menu_url = ANY($1)
   - parent_menu_id 존재 여부: SELECT menu_id FROM tb_menu WHERE menu_id = ANY($1) AND menu_depth = 1
   - allow_roles 코드 유효성: SELECT role_cd FROM tb_role WHERE role_cd = ANY($1)
④ ALL_OR_NOTHING 모드이고 2차 오류 발생 시 즉시 400 반환
⑤ PARTIAL_SUCCESS 모드이면 오류 행을 분리하고 정상 행만 저장 진행
```

### 3.8 Supabase PostgreSQL 트랜잭션 저장 (백엔드)

**담당**: 백엔드

```sql
-- 트랜잭션 시작
BEGIN;

-- 1. tb_menu INSERT (신규) 또는 UPDATE (menu_id 있는 경우)
INSERT INTO public.tb_menu
  (menu_nm, menu_url, parent_menu_id, menu_depth, menu_order, icon_class, use_yn)
VALUES
  ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (menu_url) DO UPDATE   -- PARTIAL_SUCCESS 모드에서 중복 시 SKIP
  SET menu_nm = EXCLUDED.menu_nm,
      updated_at = NOW()
RETURNING menu_id;

-- 2. tb_menu_role INSERT (메뉴-Role 매핑)
INSERT INTO public.tb_menu_role (menu_id, role_id, read_yn)
SELECT $menu_id, r.role_id, 'Y'
FROM public.tb_role r
WHERE r.role_cd = ANY($allow_roles)
ON CONFLICT (menu_id, role_id) DO NOTHING;

-- 커밋
COMMIT;
```

- **배치 처리**: 500행 단위로 분할하여 INSERT (단일 트랜잭션 과부하 방지)
- **ALL_OR_NOTHING**: 전체 배치를 단일 트랜잭션으로 처리, 중간 오류 시 전체 ROLLBACK
- **PARTIAL_SUCCESS**: 배치별 독립 트랜잭션, 실패한 배치의 오류 행만 기록

### 3.9 업로드 이력 저장 (백엔드)

**담당**: 백엔드

```sql
INSERT INTO public.tb_menu_upload_log
  (file_nm, upload_type, total_cnt, success_cnt, fail_cnt, skip_cnt, status, upload_user_id)
VALUES
  ($file_nm, 'MENU', $total, $success, $fail, $skip, $status, $user_id)
RETURNING log_id;
```

- 저장 성공/실패 확정 후 최종 집계값으로 INSERT
- `status`: `SUCCESS` (실패 0) / `PARTIAL` (일부 실패) / `FAIL` (전체 실패)

### 3.10 오류 상세 저장 (백엔드)

**담당**: 백엔드

```sql
INSERT INTO public.tb_menu_upload_error
  (log_id, row_no, column_nm, error_cd, error_msg, raw_data)
VALUES
  ($log_id, $row_no, $col_nm, $err_cd, $err_msg, $raw_data::jsonb);
```

- 프론트에서 전달받은 `errorRows` 배열 + 백엔드 2차 검사 오류를 합산하여 저장
- `raw_data`: 해당 행 전체 원본 데이터를 JSONB로 저장 (오류 결과 다운로드용)

### 3.11 결과 JSON 반환 (백엔드 → 프론트엔드)

**담당**: 백엔드

```json
{
  "success": true,
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
      "error_msg": "메뉴URL(/work/notice)이 이미 등록되어 있습니다.",
      "raw_data": { "menu_nm": "공지사항", "menu_url": "/work/notice" }
    }
  ]
}
```

### 3.12 결과 화면 렌더링 (프론트엔드)

**담당**: 프론트엔드  
**처리 위치**: `UploadResultPage` (SB-009)

```
① 응답 summary 기반 성공/실패/건너뜀 건수 카드 렌더링
② errors 배열이 있으면 오류 상세 테이블 표시
③ [업로드 이력 보기] 버튼 → log_id 포함하여 SB-010 이동
④ [새 업로드 시작] 버튼 → 업로드 상태 초기화 후 SB-007 이동
⑤ status = 'FAIL' 시 전체 실패 안내 + 원인 요약 표시
```

---

## 4. 오류 처리 정책

### 4.1 전체 롤백 모드 (ALL_OR_NOTHING)

**개념**: 업로드된 행 중 단 1건이라도 오류가 있으면 전체 저장을 취소하고 DB를 원래 상태로 되돌린다.

**적합한 상황**:
- 메뉴 구조 간의 참조 무결성이 중요한 경우 (부모-자식 관계)
- 한 번에 GNB 4개 + 하위 LNB 전체를 동시에 등록하는 경우 (LNB는 GNB가 없으면 의미 없음)
- 데이터 정합성이 최우선인 운영 환경 배포
- 업무 담당자가 "모든 행이 완벽하게 검증된 후 등록"을 원하는 경우

**처리 흐름**:
```
프론트 오류 확인 → 오류 0건이면 [확정 저장] 버튼 활성
→ 백엔드 수신 → 단일 DB 트랜잭션 시작
→ 중간 오류 발생 시 즉시 ROLLBACK
→ 400 Bad Request + 오류 목록 반환
→ 프론트: "저장에 실패했습니다. 파일을 수정 후 재업로드해주세요."
```

**사용자 안내 메시지**:
> "엄격 모드: 오류가 있는 행이 포함된 경우 전체 저장이 취소됩니다. 모든 행을 수정 후 재업로드해주세요."

---

### 4.2 부분 성공 모드 (PARTIAL_SUCCESS)

**개념**: 오류가 있는 행은 건너뛰고 정상 행만 저장한다. 오류 행은 이력에 기록된다.

**적합한 상황**:
- 수천~수만 건 대량 사용자/메뉴 등록 시 일부 오류로 전체가 차단되는 것을 방지
- 초기 데이터 마이그레이션 (이미 등록된 일부 URL 중복 등)
- 빠른 등록이 우선이고, 오류 건은 별도 수정 예정인 경우
- GNB는 이미 있고 LNB만 일부 등록하는 경우

**처리 흐름**:
```
프론트 오류 N건 확인 → [오류 무시하고 저장] 버튼 표시
→ 확인 다이얼로그: "오류 {N}건은 건너뜁니다. 정상 {M}건만 저장합니다."
→ 백엔드 수신 → 정상 행만 INSERT
→ 오류 행은 tb_menu_upload_error 기록
→ 200 OK + 부분 성공 결과 반환
→ 프론트: 성공/실패 건수 + 오류 내역 다운로드 안내
```

**사용자 안내 메시지**:
> "허용 모드: 오류가 있는 {N}건은 건너뛰고 정상 {M}건만 저장됩니다. 오류 내역은 결과 화면에서 다운로드하여 수정 후 재업로드하세요."

---

### 4.3 사용자 모드 선택 UI

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠ 오류가 발견되었습니다.                                       │
│                                                                 │
│  전체 15행 중 정상 12행 / 오류 3행                              │
│                                                                 │
│  저장 방식을 선택하세요:                                        │
│                                                                 │
│  ○ 전체 취소 (ALL_OR_NOTHING)                                  │
│    오류 수정 후 재업로드. 안전한 방식.                          │
│                                                                 │
│  ● 오류 무시하고 저장 (PARTIAL_SUCCESS)                        │
│    정상 12건만 저장, 오류 3건은 이력에 기록.                    │
│    오류 내역 파일을 다운로드하여 별도 처리 가능.               │
│                                                                 │
│  [오류 행 다운로드 (.xlsx)]                                     │
│                                                                 │
│          [전체 취소]        [선택 방식으로 저장]                │
└─────────────────────────────────────────────────────────────────┘
```

| 오류 건수 | 표시되는 버튼 | 기본 선택 |
|----------|-------------|---------|
| 0건 | [확정 저장] 버튼만 표시 | ALL_OR_NOTHING (묵시적) |
| 1건 이상 | [전체 취소], [오류 무시하고 저장] 모두 표시 | PARTIAL_SUCCESS 기본 선택 권고 |
| 전체 오류 | [전체 취소] 버튼만 활성 ([오류 무시] 비활성) | ALL_OR_NOTHING 강제 |

---

## 5. API 명세 (Node.js Serverless)

### 5.1 POST /api/menus/upload/preview

> 서버 측에서 파일을 미리 파싱하는 선택적 API. 보통 클라이언트 SheetJS로 처리하므로 선택적 사용.

**접근 가능 Role**: MANAGER, ADMIN, SUPER_ADMIN  
**Content-Type**: `multipart/form-data`

**Request**:
```
POST /api/menus/upload/preview
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

file: [엑셀 파일 바이너리]
uploadType: "MENU"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "summary": {
    "total_cnt": 15,
    "valid_cnt": 12,
    "error_cnt": 3
  },
  "valid_rows": [
    {
      "row_no": 2,
      "data": {
        "menu_nm": "홈",
        "menu_url": "/",
        "menu_depth": 1,
        "menu_order": 1,
        "use_yn": "Y",
        "allow_roles": ["USER", "ADMIN"]
      }
    }
  ],
  "error_rows": [
    {
      "row_no": 8,
      "data": { "menu_nm": "공지사항", "menu_url": "/work/notice" },
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
```

**Response (400 Bad Request - 헤더 오류)**:
```json
{
  "success": false,
  "error_code": "ERR_INVALID_HEADER",
  "message": "필수 헤더가 누락되었습니다: [메뉴명, 메뉴URL]"
}
```

**HTTP 상태코드**:
| 코드 | 상황 |
|------|------|
| 200 | 파싱 성공 (오류 행 포함 가능) |
| 400 | 파일 형식 오류, 헤더 누락 |
| 401 | 미인증 |
| 403 | 권한 부족 |
| 413 | 파일 크기 초과 (10MB) |
| 500 | 서버 내부 오류 |

---

### 5.2 POST /api/menus/upload/confirm

**접근 가능 Role**: MANAGER, ADMIN, SUPER_ADMIN  
**Content-Type**: `application/json`

**Request**:
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
    },
    {
      "row_no": 3,
      "menu_nm": "업무",
      "menu_url": "/work",
      "parent_menu_id": null,
      "menu_depth": 1,
      "menu_order": 2,
      "icon_class": "briefcase",
      "use_yn": "Y",
      "allow_roles": ["USER", "ADMIN"]
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
  "upload_type": "MENU",
  "file_nm": "menu_batch_20260313.xlsx",
  "total_cnt": 15
}
```

**Response (200 OK)**:
```json
{
  "success": true,
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
      "error_msg": "메뉴URL(/work/notice)이 이미 등록되어 있습니다.",
      "raw_data": { "menu_nm": "공지사항", "menu_url": "/work/notice" }
    },
    {
      "row_no": 12,
      "column_nm": "allow_roles",
      "error_cd": "ERR_REF_ROLE",
      "error_msg": "허용ROLE코드 'SUPERUSER'는 존재하지 않습니다.",
      "raw_data": { "menu_nm": "설정", "allow_roles": "SUPERUSER" }
    }
  ]
}
```

**Response (400 Bad Request - ALL_OR_NOTHING 모드 오류)**:
```json
{
  "success": false,
  "error_code": "ERR_ALL_OR_NOTHING",
  "message": "2차 유효성 검사에서 오류가 발견되어 전체 저장이 취소되었습니다.",
  "errors": [
    {
      "row_no": 8,
      "error_cd": "ERR_DUPLICATE_DB",
      "error_msg": "메뉴URL(/work/notice)이 이미 등록되어 있습니다."
    }
  ]
}
```

**HTTP 상태코드**:
| 코드 | 상황 |
|------|------|
| 200 | 저장 완료 (PARTIAL 포함) |
| 400 | ALL_OR_NOTHING 오류, 요청 형식 불량 |
| 401 | 미인증 |
| 403 | 권한 부족 |
| 422 | rows가 빈 배열 |
| 500 | DB 오류, 트랜잭션 실패 |

---

### 5.3 GET /api/menus/upload/logs

**접근 가능 Role**: MANAGER, ADMIN, SUPER_ADMIN

**Request (Query Parameters)**:
```
GET /api/menus/upload/logs?from=2026-01-01&to=2026-03-13&status=PARTIAL&page=1&limit=20
Authorization: Bearer {jwt_token}
```

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| from | DATE | 선택 | 조회 시작일 (기본: 30일 전) |
| to | DATE | 선택 | 조회 종료일 (기본: 오늘) |
| status | STRING | 선택 | SUCCESS / FAIL / PARTIAL |
| page | INT | 선택 | 페이지 번호 (기본: 1) |
| limit | INT | 선택 | 페이지당 건수 (기본: 20, 최대: 100) |

**Response (200 OK)**:
```json
{
  "success": true,
  "pagination": {
    "total": 48,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  },
  "logs": [
    {
      "log_id": "30000000-0000-0000-0000-000000000010",
      "file_nm": "menu_batch_20260313.xlsx",
      "upload_type": "MENU",
      "total_cnt": 15,
      "success_cnt": 12,
      "fail_cnt": 3,
      "status": "PARTIAL",
      "upload_user": {
        "id": "00000000-0000-0000-0000-000000000002",
        "username": "관리자",
        "email": "admin@company.com"
      },
      "created_at": "2026-03-13T09:30:00.000Z"
    }
  ]
}
```

**HTTP 상태코드**: 200 / 401 / 403

---

### 5.4 GET /api/menus/upload/logs/:logId/errors

**접근 가능 Role**: MANAGER, ADMIN, SUPER_ADMIN

**Request**:
```
GET /api/menus/upload/logs/30000000-0000-0000-0000-000000000010/errors
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "log_id": "30000000-0000-0000-0000-000000000010",
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
        "menu_depth": "2",
        "menu_order": "1"
      },
      "created_at": "2026-03-13T09:30:01.000Z"
    }
  ]
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error_code": "ERR_LOG_NOT_FOUND",
  "message": "업로드 이력을 찾을 수 없습니다."
}
```

**HTTP 상태코드**: 200 / 401 / 403 / 404

---

### 5.5 GET /api/menus/upload/template

**접근 가능 Role**: MANAGER, ADMIN, SUPER_ADMIN

**Request**:
```
GET /api/menus/upload/template?type=MENU
Authorization: Bearer {jwt_token}
```

**Response**:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="menu_upload_template.xlsx"`
- 응답 바디: xlsx 바이너리

**템플릿 파일 구성**:

| 시트명 | 내용 |
|--------|------|
| 메뉴등록양식 | 헤더 1행 + 예시 데이터 3행 (회색 배경) + 빈 행 100행 |
| 작성방법안내 | 각 컬럼 설명, 유효성 규칙, 오류코드 안내 |
| Role코드목록 | 현재 DB의 tb_role 목록 (role_cd, role_nm) - 동적 생성 |

**HTTP 상태코드**: 200 / 401 / 403 / 500

---

## 6. 오류 결과 다운로드 파일 스펙

### 6.1 파일 구성

- **파일명**: `menu_upload_errors_{log_id_앞8자}_{YYYYMMDD}.xlsx`
- **시트명**: `오류목록`
- **구성**: 원본 데이터 컬럼 9개 + 오류 정보 컬럼 3개

### 6.2 컬럼 구성표

| 순번 | 컬럼명 | 데이터 소스 | 설명 |
|------|--------|------------|------|
| A | 행번호 | `row_no` | 원본 엑셀 행 번호 |
| B | 메뉴ID | `raw_data.menu_id` | 원본 입력값 |
| C | 메뉴명 | `raw_data.menu_nm` | 원본 입력값 |
| D | 메뉴URL | `raw_data.menu_url` | 원본 입력값 |
| E | 상위메뉴ID | `raw_data.parent_menu_id` | 원본 입력값 |
| F | 메뉴깊이 | `raw_data.menu_depth` | 원본 입력값 |
| G | 정렬순서 | `raw_data.menu_order` | 원본 입력값 |
| H | 아이콘CLASS | `raw_data.icon_class` | 원본 입력값 |
| I | 사용여부 | `raw_data.use_yn` | 원본 입력값 |
| J | 허용ROLE코드 | `raw_data.allow_roles` | 원본 입력값 |
| K | **오류코드** | `error_cd` | 예: `ERR_DUPLICATE_DB` |
| L | **오류 컬럼** | `column_nm` | 오류 발생 컬럼명 |
| M | **오류 메시지** | `error_msg` | 상세 오류 설명 |

### 6.3 스타일 적용 규칙

| 대상 | 스타일 | SheetJS 설정값 |
|------|--------|---------------|
| 헤더 행 (1행) | 배경색 회색 + 볼드 | `{ fgColor: { rgb: "4B5563" } }`, `bold: true` |
| 오류 행 전체 | 배경색 연한 빨강 | `{ fgColor: { rgb: "FEF2F2" } }` |
| 오류 컬럼 셀 (K~M) | 폰트색 빨강 + 볼드 | `{ fgColor: { rgb: "DC2626" } }` |
| 행번호 열 (A) | 배경색 연한 노랑 | `{ fgColor: { rgb: "FEF9C3" } }` |
| 모든 셀 | 테두리 | `{ style: "thin", color: { rgb: "D1D5DB" } }` |

### 6.4 SheetJS 스타일 적용 코드 (프론트엔드)

```typescript
import * as XLSX from 'xlsx-js-style'; // 스타일 지원 버전 사용

export function generateErrorReport(errorRows: ErrorRow[]): void {
  const wb = XLSX.utils.book_new();

  const headers = [
    '행번호','메뉴ID','메뉴명','메뉴URL','상위메뉴ID',
    '메뉴깊이','정렬순서','아이콘CLASS','사용여부','허용ROLE코드',
    '오류코드','오류컬럼','오류메시지'
  ];

  const DATA_STYLE = {
    fill: { fgColor: { rgb: "FEF2F2" } },             // 오류 행 배경
    font: { sz: 11 },
    border: {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    }
  };

  const ERROR_COL_STYLE = {
    ...DATA_STYLE,
    font: { sz: 11, bold: true, color: { rgb: "DC2626" } }
  };

  const rows = errorRows.map(er => [
    er.row_no,
    er.raw_data.menu_id ?? '',
    er.raw_data.menu_nm ?? '',
    er.raw_data.menu_url ?? '',
    er.raw_data.parent_menu_id ?? '',
    er.raw_data.menu_depth ?? '',
    er.raw_data.menu_order ?? '',
    er.raw_data.icon_class ?? '',
    er.raw_data.use_yn ?? '',
    er.raw_data.allow_roles ?? '',
    er.error_cd,
    er.column_nm,
    er.error_msg,
  ]);

  // 셀 스타일 적용
  const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const range = XLSX.utils.decode_range(ws['!ref']!);

  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) continue;
      ws[cellAddr].s = C >= 10 ? ERROR_COL_STYLE : DATA_STYLE;
    }
  }

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 8 }, { wch: 36 }, { wch: 20 }, { wch: 30 },
    { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 15 },
    { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, '오류목록');
  XLSX.writeFile(wb, `menu_upload_errors_${Date.now()}.xlsx`);
}
```

---

## 7. 샘플 엑셀 데이터 (15행)

> ⚠️ 아래 데이터는 GNB 4개(메뉴깊이=1) + LNB 11개(메뉴깊이=2) + 의도적 오류 3행 포함

| 행 | 메뉴ID | 메뉴명 | 메뉴URL | 상위메뉴ID | 메뉴깊이 | 정렬순서 | 아이콘CLASS | 사용여부 | 허용ROLE코드 | 비고 |
|----|--------|--------|---------|----------|---------|---------|------------|--------|-------------|------|
| 2  | _(신규)_ | 홈 | `/` | _(없음)_ | 1 | 1 | home | Y | USER,MANAGER,ADMIN,SUPER_ADMIN | ✅ GNB1 |
| 3  | _(신규)_ | 업무 | `/work` | _(없음)_ | 1 | 2 | briefcase | Y | USER,MANAGER,ADMIN,SUPER_ADMIN | ✅ GNB2 |
| 4  | _(신규)_ | 게시판 | `/board` | _(없음)_ | 1 | 3 | pin | Y | USER,MANAGER,ADMIN,SUPER_ADMIN | ✅ GNB3 |
| 5  | _(신규)_ | 관리 | `/admin` | _(없음)_ | 1 | 4 | settings | Y | ADMIN,SUPER_ADMIN | ✅ GNB4 |
| 6  | _(신규)_ | 공지사항 | `/work/notice` | _(GNB2 ID)_ | 2 | 1 | bell | Y | USER,MANAGER,ADMIN | ✅ LNB1 |
| 7  | _(신규)_ | 결재함 | `/work/sign` | _(GNB2 ID)_ | 2 | 2 | clipboard | Y | USER,MANAGER,ADMIN | ✅ LNB2 |
| 8  | _(신규)_ | 결재대기 | `/work/sign/wait` | _(GNB2 ID)_ | 2 | 3 | clock | Y | USER,MANAGER | ✅ LNB3 |
| 9  | _(신규)_ | 자유게시판 | `/board/free` | _(GNB3 ID)_ | 2 | 1 | message | Y | USER,MANAGER,ADMIN | ✅ LNB4 |
| 10 | _(신규)_ | Q&A | `/board/qna` | _(GNB3 ID)_ | 2 | 2 | help | Y | USER,MANAGER,ADMIN | ✅ LNB5 |
| 11 | _(신규)_ | 공지게시판 | `/board/notice` | _(GNB3 ID)_ | 2 | 3 | speaker | Y | USER,MANAGER,ADMIN | ✅ LNB6 |
| 12 | _(신규)_ | 메뉴관리 | `/admin/menu` | _(GNB4 ID)_ | 2 | 1 | list | Y | ADMIN,SUPER_ADMIN | ✅ LNB7 |
| 13 | _(신규)_ | 권한관리 | `/admin/roles` | _(GNB4 ID)_ | 2 | 2 | shield | Y | ADMIN,SUPER_ADMIN | ✅ LNB8 |
| 14 | _(신규)_ | 사용자관리 | `/admin/users` | _(GNB4 ID)_ | 2 | 3 | users | Y | ADMIN,SUPER_ADMIN | ✅ LNB9 |
| 15 | _(신규)_ | _(빈값)_ | `/admin/logs` | _(GNB4 ID)_ | 2 | 4 | log | Y | ADMIN,SUPER_ADMIN | ❌ **오류1**: 메뉴명 필수값 누락 (V-001) |
| 16 | _(신규)_ | 시스템설정 | `/admin/settings` | _(GNB4 ID)_ | 2 | 5 | tool | Y | **SUPERUSER,ADMIN** | ❌ **오류2**: 존재하지 않는 Role코드 SUPERUSER (V-019) |
| 17 | _(신규)_ | 업무홈 | **/work** | _(GNB2 ID)_ | 2 | 6 | home | Y | USER,ADMIN | ❌ **오류3**: 메뉴URL /work 중복 (V-021/V-022) |

### 오류 행 요약

| 행 | 오류유형 | 오류코드 | 오류 컬럼 | 오류 메시지 |
|----|---------|---------|----------|------------|
| 15 | 필수값 누락 | ERR_REQUIRED | menu_nm | 메뉴명은 필수 입력값입니다. |
| 16 | 잘못된 Role코드 | ERR_REF_ROLE | allow_roles | 허용ROLE코드 'SUPERUSER'는 존재하지 않는 Role 코드입니다. |
| 17 | 중복 메뉴URL | ERR_DUPLICATE_DB | menu_url | 메뉴URL(/work)이 이미 등록되어 있습니다. |

---

## 8. React 컴포넌트 연동 가이드

### 8.1 SheetJS 설치 및 import

```bash
# 기본 SheetJS (스타일 미지원)
npm install xlsx

# 스타일 지원 버전 (오류 결과 다운로드 시 색상 적용 필요)
npm install xlsx-js-style
```

```typescript
// 파싱 (읽기) → xlsx 사용
import * as XLSX from 'xlsx';

// 스타일 포함 쓰기 → xlsx-js-style 사용
import * as XLSXStyle from 'xlsx-js-style';
```

**tsconfig.json 설정 확인**:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  }
}
```

---

### 8.2 파일 읽기 → JSON 변환 핵심 코드 (TypeScript)

```typescript
// types/upload.ts
export interface RawMenuRow {
  row_no: number;
  menu_id?: string;
  menu_nm: string;
  menu_url: string;
  parent_menu_id?: string;
  menu_depth: number;
  menu_order: number;
  icon_class?: string;
  use_yn: string;
  allow_roles: string[];
}

export interface RowError {
  column_nm: string;
  error_cd: string;
  error_msg: string;
}

export interface ParsedRow extends RawMenuRow {
  has_error: boolean;
  errors: RowError[];
}

// hooks/useUploadParser.ts
import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { ParsedRow, RawMenuRow } from '@/types/upload';

// 헤더 정규화 맵
const HEADER_MAP: Record<string, keyof RawMenuRow> = {
  '메뉴id': 'menu_id',     'menuid': 'menu_id',     'menu_id': 'menu_id',
  '메뉴명': 'menu_nm',     'menunm': 'menu_nm',     'menu_nm': 'menu_nm',     '메뉴이름': 'menu_nm',
  '메뉴url': 'menu_url',   'menuurl': 'menu_url',   'menu_url': 'menu_url',   'url': 'menu_url',
  '상위메뉴id': 'parent_menu_id', 'parentmenuid': 'parent_menu_id', 'parent_menu_id': 'parent_menu_id',
  '메뉴깊이': 'menu_depth','menudepth': 'menu_depth','menu_depth': 'menu_depth','depth': 'menu_depth',
  '정렬순서': 'menu_order','menuorder': 'menu_order','menu_order': 'menu_order','sort_order': 'menu_order',
  '아이콘class': 'icon_class','iconclass': 'icon_class','icon_class': 'icon_class','icon': 'icon_class',
  '사용여부': 'use_yn',    'useyn': 'use_yn',       'use_yn': 'use_yn',
  '허용role코드': 'allow_roles','allowroles': 'allow_roles','allow_roles': 'allow_roles','roles': 'allow_roles',
};

const REQUIRED_HEADERS: Array<keyof RawMenuRow> = [
  'menu_nm', 'menu_url', 'menu_depth', 'menu_order', 'use_yn', 'allow_roles'
];

export function useUploadParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseFile = useCallback(
    async (file: File): Promise<ParsedRow[]> => {
      setIsParsing(true);
      setParseError(null);

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const workbook = XLSX.read(buffer, {
              type: 'array',
              cellDates: true,
              cellNF: false,
              cellText: false,
            });

            // 첫 번째 시트 사용
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // 2D 배열로 변환 (header: 1 = 배열 형태, defval = 빈 문자열)
            const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: '',
              blankrows: false,
            });

            if (raw.length < 2) {
              throw new Error('데이터가 없는 파일입니다. 헤더 이외에 최소 1행의 데이터가 필요합니다.');
            }
            if (raw.length > 10001) {
              throw new Error('최대 10,000행까지 업로드 가능합니다.');
            }

            // ── 헤더 파싱 ──
            const headerRow = raw[0].map(h => String(h).toLowerCase().trim().replace(/\s+/g, ''));
            const colIndexMap: Partial<Record<keyof RawMenuRow, number>> = {};

            headerRow.forEach((h, idx) => {
              const key = HEADER_MAP[h];
              if (key) colIndexMap[key] = idx;
            });

            // 필수 헤더 누락 체크
            const missingHeaders = REQUIRED_HEADERS.filter(k => colIndexMap[k] === undefined);
            if (missingHeaders.length > 0) {
              throw new Error(`필수 헤더가 누락되었습니다: [${missingHeaders.join(', ')}]`);
            }

            // ── 데이터 행 파싱 ──
            const dataRows = raw.slice(1);
            const result: ParsedRow[] = dataRows.map((row, index) => {
              const rowNo = index + 2; // 엑셀 기준 행 번호
              const get = (key: keyof RawMenuRow): string =>
                String(row[colIndexMap[key] ?? -1] ?? '').trim();

              const allowRolesRaw = get('allow_roles');
              const allow_roles = allowRolesRaw
                ? allowRolesRaw.split(',').map(r => r.trim().toUpperCase()).filter(Boolean)
                : [];

              const rawRow: RawMenuRow = {
                row_no:         rowNo,
                menu_id:        get('menu_id') || undefined,
                menu_nm:        get('menu_nm'),
                menu_url:       get('menu_url'),
                parent_menu_id: get('parent_menu_id') || undefined,
                menu_depth:     Number(get('menu_depth')),
                menu_order:     Number(get('menu_order')),
                icon_class:     get('icon_class') || undefined,
                use_yn:         get('use_yn').toUpperCase(),
                allow_roles,
              };

              return { ...rawRow, has_error: false, errors: [] };
            });

            setIsParsing(false);
            resolve(result);
          } catch (err) {
            const msg = err instanceof Error ? err.message : '파일 파싱에 실패했습니다.';
            setParseError(msg);
            setIsParsing(false);
            reject(new Error(msg));
          }
        };

        reader.onerror = () => {
          setParseError('파일을 읽을 수 없습니다.');
          setIsParsing(false);
          reject(new Error('파일을 읽을 수 없습니다.'));
        };

        reader.readAsArrayBuffer(file);
      });
    },
    []
  );

  return { parseFile, isParsing, parseError };
}
```

---

### 8.3 미리보기 테이블 오류 행 하이라이트 처리

```typescript
// components/UploadPreviewTable.tsx
import React, { useState, useMemo } from 'react';
import type { ParsedRow } from '@/types/upload';

interface Props {
  rows: ParsedRow[];
}

type FilterType = 'all' | 'valid' | 'error';

export const UploadPreviewTable: React.FC<Props> = ({ rows }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [hoveredError, setHoveredError] = useState<{
    rowNo: number; colNm: string; msg: string;
  } | null>(null);

  const validCount = useMemo(() => rows.filter(r => !r.has_error).length, [rows]);
  const errorCount = useMemo(() => rows.filter(r => r.has_error).length, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === 'valid') return rows.filter(r => !r.has_error);
    if (filter === 'error') return rows.filter(r => r.has_error);
    return rows;
  }, [rows, filter]);

  const getRowStyle = (row: ParsedRow): React.CSSProperties =>
    row.has_error
      ? { backgroundColor: '#FEF2F2', borderLeft: '3px solid #DC2626' }
      : {};

  const getCellStyle = (row: ParsedRow, colKey: string): React.CSSProperties => {
    if (!row.has_error) return {};
    const hasColError = row.errors.some(e => e.column_nm === colKey);
    return hasColError
      ? { textDecoration: 'underline', textDecorationColor: '#DC2626', color: '#B91C1C', fontWeight: 600 }
      : {};
  };

  const columns: Array<{ key: keyof typeof rows[0]; label: string }> = [
    { key: 'row_no',         label: '행번호' },
    { key: 'menu_nm',        label: '메뉴명' },
    { key: 'menu_url',       label: '메뉴URL' },
    { key: 'menu_depth',     label: '깊이' },
    { key: 'menu_order',     label: '순서' },
    { key: 'use_yn',         label: '사용여부' },
    { key: 'allow_roles',    label: '허용Role' },
  ];

  return (
    <div className="upload-preview">
      {/* 요약 바 */}
      <div className="summary-bar" style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <span>전체 <strong>{rows.length}</strong>행</span>
        <span style={{ color: '#16A34A' }}>정상 <strong>{validCount}</strong>행</span>
        <span style={{ color: '#DC2626' }}>오류 <strong>{errorCount}</strong>행</span>
      </div>

      {/* 필터 탭 */}
      <div className="filter-tabs" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['all', 'valid', 'error'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid #D1D5DB',
              backgroundColor: filter === f ? '#2563EB' : '#fff',
              color: filter === f ? '#fff' : '#374151',
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? '전체' : f === 'valid' ? '정상만' : `⚠ 오류만 ${errorCount}`}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#F3F4F6', position: 'sticky', top: 0 }}>
              {columns.map(col => (
                <th key={col.key} style={{ padding: '8px 12px', border: '1px solid #E5E7EB', textAlign: 'left' }}>
                  {col.label}
                </th>
              ))}
              <th style={{ padding: '8px 12px', border: '1px solid #E5E7EB' }}>오류</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => (
              <tr key={row.row_no} style={getRowStyle(row)}>
                {columns.map(col => {
                  const value = row[col.key];
                  const displayValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');
                  const colError = row.errors.find(e => e.column_nm === col.key);

                  return (
                    <td
                      key={col.key}
                      style={{ padding: '6px 12px', border: '1px solid #E5E7EB', position: 'relative', ...getCellStyle(row, col.key) }}
                      onMouseEnter={() => colError && setHoveredError({ rowNo: row.row_no, colNm: col.key, msg: colError.error_msg })}
                      onMouseLeave={() => setHoveredError(null)}
                      title={colError?.error_msg}
                    >
                      {displayValue || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>_(빈값)_</span>}
                    </td>
                  );
                })}
                <td style={{ padding: '6px 12px', border: '1px solid #E5E7EB', color: '#DC2626', fontSize: 12 }}>
                  {row.has_error ? row.errors.map(e => e.error_msg).join(' / ') : '✓'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

### 8.4 업로드 진행 상태 표시 (ProgressBar)

```typescript
// components/UploadProgressBar.tsx
import React from 'react';

interface Props {
  total: number;
  current: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  label?: string;
}

export const UploadProgressBar: React.FC<Props> = ({
  total, current, status, label
}) => {
  const percent = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  const COLOR_MAP = {
    idle:      '#6B7280',
    uploading: '#2563EB',
    success:   '#16A34A',
    error:     '#DC2626',
  };
  const barColor = COLOR_MAP[status];

  const STATUS_LABEL = {
    idle:      '대기 중',
    uploading: `저장 중... (${current} / ${total}행)`,
    success:   '저장 완료',
    error:     '저장 실패',
  };

  return (
    <div className="upload-progress" style={{ padding: '12px 0' }}>
      {/* 상태 텍스트 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <span style={{ color: barColor, fontWeight: 600 }}>
          {label ?? STATUS_LABEL[status]}
        </span>
        <span style={{ color: '#374151' }}>{percent}%</span>
      </div>

      {/* 프로그레스 바 */}
      <div style={{
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            backgroundColor: barColor,
            borderRadius: 4,
            transition: 'width 0.3s ease-in-out',
          }}
        />
      </div>

      {/* 선형 애니메이션 (uploading 상태에서 percent를 알 수 없을 때) */}
      {status === 'uploading' && total === 0 && (
        <div style={{
          height: 4,
          marginTop: 4,
          backgroundColor: '#DBEAFE',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div className="indeterminate-bar" style={{
            height: '100%',
            width: '30%',
            backgroundColor: '#2563EB',
            borderRadius: 4,
            animation: 'indeterminate 1.5s infinite linear',
          }} />
        </div>
      )}
    </div>
  );
};

// axios onUploadProgress 연동 예시
/*
  axios.post('/api/menus/upload/confirm', body, {
    headers: { Authorization: `Bearer ${token}` },
    onUploadProgress: (evt) => {
      if (evt.total) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(pct);
      }
    }
  });
*/

// CSS 애니메이션 (index.css 또는 글로벌 스타일)
/*
  @keyframes indeterminate {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
*/
```

---

## 부록. 오류코드 전체 목록

| 오류코드 | 카테고리 | 설명 |
|---------|---------|------|
| ERR_REQUIRED | 필수값 | 필수 컬럼이 비어있음 |
| ERR_REQUIRED_IF | 조건부 필수 | 특정 조건에서 필수값 누락 |
| ERR_FORMAT_URL | 형식 | URL 형식 오류 |
| ERR_FORMAT_INT | 형식 | 정수 형식 오류 |
| ERR_FORMAT_UUID | 형식 | UUID 형식 오류 |
| ERR_VALUE | 값 | 허용값 이외의 값 |
| ERR_LENGTH | 범위 | 문자열 길이 초과 |
| ERR_RANGE | 범위 | 숫자 범위 초과 |
| ERR_REF_NOT_FOUND | 참조 | 참조 대상 없음 (FK 불일치) |
| ERR_REF_DEPTH | 참조 | 잘못된 depth 참조 |
| ERR_REF_ROLE | 참조 | 존재하지 않는 Role 코드 |
| ERR_DUPLICATE_FILE | 중복 | 파일 내 중복 |
| ERR_DUPLICATE_DB | 중복 | DB 중복 |
| ERR_DUPLICATE_NM | 중복 | 동일 부모 내 메뉴명 중복 |
| ERR_DUPLICATE_ID | 중복 | 파일 내 menu_id 중복 |
| ERR_DUPLICATE_ORDER | 중복 | 동일 부모 내 정렬순서 중복 |
| ERR_INVALID_HEADER | 파일 구조 | 필수 헤더 누락 |
| ERR_FILE_TOO_LARGE | 파일 크기 | 10MB 초과 |
| ERR_FILE_FORMAT | 파일 형식 | .xlsx/.xls 이외 형식 |
| ERR_EMPTY_FILE | 파일 내용 | 데이터 행 없음 |
| ERR_ROW_LIMIT | 행 수 초과 | 10,000행 초과 |
| ERR_ALL_OR_NOTHING | 모드 | ALL_OR_NOTHING 오류로 전체 취소 |

---

> **문서 종료** | 8개 섹션 완전 수록 | v1.0 | 2026-03-13  
> **다음 단계**: `frontend/src/hooks/useUploadParser.ts`, `frontend/src/components/UploadPreviewTable.tsx` 파일로 분리 구현
