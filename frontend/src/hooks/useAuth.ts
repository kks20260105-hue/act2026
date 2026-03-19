import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';
import type { RoleCode } from '../types/role';

/**
 * 인증 상태와 권한 체크 유틸 훅
 */
export function useAuth() {
  const { user, accessToken, roles, clearUser, hasRole, isAdmin } = useAuthStore();

  const isLoggedIn = !!user && !!accessToken;

  const checkRole = (required: RoleCode | RoleCode[]) => hasRole(required);

  /** 로그아웃: 백엔드 소셜 토큰 폐기 → localStorage 초기화 → 스토어 클리어 */
  const logout = async () => {
    await authService.logout();  // 백엔드 토큰 폐기 + localStorage 삭제
    clearUser();                 // Zustand 상태 초기화
  };

  return {
    user,
    accessToken,
    roles,
    isLoggedIn,
    isAdmin: isAdmin(),
    checkRole,
    logout,
  };
}
