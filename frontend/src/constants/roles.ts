import type { RoleCode } from '../types/role';

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: '슈퍼관리자',
  ADMIN:       '관리자',
  MANAGER:     '매니저',
  USER:        '일반사용자',
};

export const ROLE_COLORS: Record<RoleCode, string> = {
  SUPER_ADMIN: '#E74C3C',
  ADMIN:       '#E67E22',
  MANAGER:     '#2980B9',
  USER:        '#27AE60',
};

/** Role 계층 (숫자가 낮을수록 상위 권한) */
export const ROLE_HIERARCHY: Record<RoleCode, number> = {
  SUPER_ADMIN: 1,
  ADMIN:       2,
  MANAGER:     3,
  USER:        99,
};

/** 관리자 이상 Role 목록 */
export const ADMIN_ROLES: RoleCode[] = ['SUPER_ADMIN', 'ADMIN'];
