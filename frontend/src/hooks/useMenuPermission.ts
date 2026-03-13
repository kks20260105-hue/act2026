import { useMenuStore } from '../stores/menuStore';
import { useAuthStore } from '../stores/authStore';

/**
 * 현재 경로 또는 menuUrl에 대한 접근/쓰기 권한 확인
 */
export function useMenuPermission(menuUrl?: string) {
  const myMenus   = useMenuStore((s) => s.myMenus);
  const { roles } = useAuthStore();

  // SUPER_ADMIN은 모든 권한
  if (roles.includes('SUPER_ADMIN')) {
    return { canRead: true, canWrite: true };
  }

  if (!menuUrl) return { canRead: false, canWrite: false };

  const menu = myMenus.find((m) => m.menu_url === menuUrl);
  if (!menu) return { canRead: false, canWrite: false };

  return {
    canRead:  true,
    canWrite: menu.can_write ?? false,
  };
}
