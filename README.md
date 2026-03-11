# kks202601 Portal Service

## 프로젝트 개요
포털 서비스 기본 로그인 페이지 (React + TypeScript + Supabase + PrimeReact)

## 배포 URL
- Frontend: https://free2026one.vercel.app/

## 기술 스택
| 구분 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite |
| UI Library | PrimeReact, PrimeFlex, PrimeIcons |
| 상태 관리 | Redux Toolkit |
| Backend | Node.js, Express (차후 .NET 마이그레이션 예정) |
| DB | Supabase (PostgreSQL) |
| 배포 | Vercel (frontend), Railway/Render (backend) |

## 코딩 컨벤션
- 클래스/타입 → **PascalCase**
- 변수/함수 → **camelCase**
- DB명/테이블명/컬럼명 → **소문자 snake_case**

## 폴더 구조
```
kks202601-root/
├─ backend/          ← Node.js / Express 서버
├─ frontend/         ← React + TypeScript 앱
├─ infra/            ← 배포/인프라 설정
└─ README.md
```

## 시작하기

### 환경 변수 설정
```bash
# frontend/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:4000/api

# backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
PORT=4000
```

### 설치 및 실행
```bash
# root 의존성 설치
npm install

# frontend 실행
cd frontend && npm install && npm run dev

# backend 실행
cd backend && npm install && npm run dev
```

## DB 설정 (Supabase)
- Project: free2026db
- `infra/sql/init.sql` 파일을 Supabase SQL Editor에서 실행














--실행파일 순서
npm install

2026.02.04 기준 설치 엑셀
npm install xlsx

 npm run dev






 ---과거 backend 참조
 소스 다운 후, npm install을 하여 관련 라이브러리를 설치합니다.
그리고 node index.js 로 실행하면, Prisma 관련 모듈이 없다고 납니다.

아래와 같이 Prisma 라이브러리를 추가 설치합니다.
npm install -D prisma
npm install @prisma/client

이후에 기본 정보 생성을 위해 아래 명령어를 실행합니다. 
npx prisma generate

그리고 node index.js 를 실행하면 4000번 포트로 서비스가 시작됩니다. 

DB가 변경이 되면, npx prisma generate 를 다시 해줘야 함.



2026년 2월 5일 추가 내용: 통계 메뉴 추가.
## backend
npm install ua-parser-js

## frontend
npm install xlsx
설치파일 추가
-------------------------
npm install

npm install -D prisma
npm install @prisma/client

npx prisma generate

npm install ua-parser-js  ////2026.06.11 - 추가로 ua-parser-js 라이브러리가 없다고 나오는 경우가 있어,  아래와 같이 추가 설치합니다. 


npm install
npm install -D prisma
npm install @prisma/client
npx prisma generate
npx prisma migrate deploy
npm install ua-parser-js 
npm install dotenv
node index.js

npm install express
npm install cors
npm install pg

npm install @prisma/adapter-pg pg
npm install
npm install @prisma/client
npm install bcrypt jsonwebtoken

npx prisma generate
npm install multer
npm install mqtt
npm install express cors dotenv mqtt multer @prisma/client @prisma/adapter-pg pg

