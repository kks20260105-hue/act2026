import type { RoleCode } from '../types/role';
import { ROLE_HIERARCHY } from '../constants/roles';

/** 사용자가 필요 Role을 보유하고 있는지 확인 */
export function hasRequiredRole(userRoles: RoleCode[], required: RoleCode | RoleCode[]): boolean {
  const arr = Array.isArray(required) ? required : [required];
  return arr.some((r) => userRoles.includes(r));
}

/** 사용자의 최상위 Role 반환 */
export function getTopRole(roles: RoleCode[]): RoleCode | null {
  if (roles.length === 0) return null;
  return roles.reduce((top, cur) =>
    ROLE_HIERARCHY[cur] < ROLE_HIERARCHY[top] ? cur : top
  );
}
