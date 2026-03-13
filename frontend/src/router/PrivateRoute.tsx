import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface Props {
  redirectTo?: string;
}

/** 로그인 여부 확인 라우트 가드 */
export default function PrivateRoute({ redirectTo = '/login' }: Props) {
  const { isLoggedIn } = useAuth();

  if (isLoggedIn === undefined) {
    return <LoadingSpinner fullPage />;
  }

  return isLoggedIn ? <Outlet /> : <Navigate to={redirectTo} replace />;
}
