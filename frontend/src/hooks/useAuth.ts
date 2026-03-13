import { useAuthStore } from '../stores/authStore';
import type { RoleCode } from '../types/role';

/**
 * 인증 상태와 권한 체크 유틸 훅
 */
export function useAuth() {
  const { user, accessToken, roles, clearUser, hasRole, isAdmin } = useAuthStore();

  const isLoggedIn = !!user && !!accessToken;

  const checkRole = (required: RoleCode | RoleCode[]) => hasRole(required);

  return {
    user,
    accessToken,
    roles,
    isLoggedIn,
    isAdmin: isAdmin(),
    checkRole,
    logout: clearUser,
  };
}
