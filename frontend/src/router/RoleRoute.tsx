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
  const { isLoggedIn, checkRole, roles: userRoles } = useAuth();

  // ── 디버그 로그 ──────────────────────────────
  console.group('[RoleRoute] 권한 체크');
  console.log('🔐 isLoggedIn:', isLoggedIn);
  console.log('👤 userRoles (저장된 역할):', userRoles);
  console.log('🎯 required roles:', roles);
  console.log('✅ checkRole 결과:', checkRole(roles));
  console.groupEnd();
  // ──────────────────────────────────────────────

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!checkRole(roles)) return <Navigate to={redirectTo} replace />;

  return <Outlet />;
}
