import api from './axiosInstance';
import type { UserRole } from '../types/role';
import type { ApiResponse } from '../types/common';

export const userRoleApi = {
  /** 사용자 Role 목록 */
  getByUser: (userId: string) =>
    api.get<ApiResponse<UserRole[]>>(`/users/${userId}/roles`).then((r) => r.data.data),

  /** Role 부여 */
  grant: (userId: string, body: { role_id: string; start_dt?: string; end_dt?: string }) =>
    api.post<ApiResponse<UserRole>>(`/users/${userId}/roles`, body).then((r) => r.data.data),

  /** Role 회수 */
  revoke: (userId: string, roleId: string) =>
    api.delete(`/users/${userId}/roles/${roleId}`).then((r) => r.data),

  /** 메뉴-Role 매핑 조회 */
  getMenuRoles: (menuId?: string) =>
    api.get('/menu-roles', { params: menuId ? { menu_id: menuId } : {} }).then((r) => r.data.data),

  /** 메뉴-Role 배치 저장 */
  batchMenuRoles: (menuId: string, roleIds: string[]) =>
    api.put('/menu-roles', { menu_id: menuId, role_ids: roleIds }).then((r) => r.data),
};
