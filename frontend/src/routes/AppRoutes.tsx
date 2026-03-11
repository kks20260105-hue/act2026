import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useRedux';
import { ProgressSpinner } from 'primereact/progressspinner';

// Lazy loading으로 코드 스플리팅
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));

//------------------------------------------------------------
// PrivateRoute: 인증된 사용자만 접근 가능한 라우트
//------------------------------------------------------------
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

//------------------------------------------------------------
// 로딩 스피너 (Suspense fallback)
//------------------------------------------------------------
const LoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
    }}
  >
    <ProgressSpinner style={{ width: '30px', height: '30px' }} strokeWidth="4" />
  </div>
);

//------------------------------------------------------------
// AppRoutes: 전체 라우트 설정
//------------------------------------------------------------
const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* 기본 진입점 → 인증 필요 */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />

        {/* 로그인 페이지 (공개 - 유일한 비인증 접근 허용) */}
        <Route path="/login" element={<LoginPage />} />

        {/* 대시보드 (인증 필요) */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <div style={{ padding: '20px', fontSize: '12px' }}>
                대시보드 (준비 중)
              </div>
            </PrivateRoute>
          }
        />

        {/* 그 외 모든 경로 → 로그인 페이지로 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
