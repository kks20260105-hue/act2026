import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { RoleCode } from '../types/role';

interface Props {
  roles:       RoleCode[];
  redirectTo?: string;
}

/** Role 기반 라우트 가드 */
export default function RoleRoute({ roles, redirectTo = '/forbidden' }: Props) {
  const { isLoggedIn, checkRole } = useAuth();

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!checkRole(roles)) return <Navigate to={redirectTo} replace />;

  return <Outlet />;
}
