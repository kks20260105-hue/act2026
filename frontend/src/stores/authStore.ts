import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/auth';
import type { RoleCode } from '../types/role';

interface AuthState {
  user:         User | null;
  accessToken:  string | null;
  roles:        RoleCode[];

  setUser:      (user: User, token: string, roles: RoleCode[]) => void;
  clearUser:    () => void;
  hasRole:      (role: RoleCode | RoleCode[]) => boolean;
  isAdmin:      () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      roles:       [],

      setUser: (user, accessToken, roles) =>
        set({ user, accessToken, roles }),

      clearUser: () =>
        set({ user: null, accessToken: null, roles: [] }),

      hasRole: (role) => {
        const { roles } = get();
        // ── 디버그 로그 ──────────────────────────────
        console.log('[authStore] hasRole 호출 → 저장된 roles:', roles, '| 요청 role:', role);
        // ──────────────────────────────────────────────
        if (Array.isArray(role)) return role.some((r) => roles.includes(r));
        return roles.includes(role);
      },

      isAdmin: () => {
        const { roles } = get();
        return roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
      },
    }),
    {
      name:    'auth-store',
      partialize: (state) => ({
        user:        state.user,
        accessToken: state.accessToken,
        roles:       state.roles,
      }),
    }
  )
);
