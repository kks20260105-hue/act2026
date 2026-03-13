import api from './axiosInstance';
import type { Role } from '../types/role';
import type { ApiResponse } from '../types/common';

export const roleApi = {
  getAll: () =>
    api.get<ApiResponse<Role[]>>('/roles').then((r) => r.data.data),

  getById: (roleId: string) =>
    api.get<ApiResponse<Role>>(`/roles/${roleId}`).then((r) => r.data.data),

  create: (body: Partial<Role>) =>
    api.post<ApiResponse<Role>>('/roles', body).then((r) => r.data.data),

  update: (roleId: string, body: Partial<Role>) =>
    api.put<ApiResponse<Role>>(`/roles/${roleId}`, body).then((r) => r.data.data),

  delete: (roleId: string) =>
    api.delete(`/roles/${roleId}`).then((r) => r.data),
};
