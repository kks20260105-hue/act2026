import api from './axiosInstance';
import type { Menu, MenuFormValues, MenuOrderItem } from '../types/menu';
import type { ApiResponse } from '../types/common';

export const menuApi = {
  /** 전체 메뉴 목록 조회 */
  getAll: () =>
    api.get<ApiResponse<Menu[]>>('/menus').then((r) => r.data.data),

  /** 내 메뉴 목록 */
  getMy: () =>
    api.get<ApiResponse<Menu[]>>('/menus/my').then((r) => r.data.data),

  /** 메뉴 상세 */
  getById: (menuId: string) =>
    api.get<ApiResponse<Menu>>(`/menus/${menuId}`).then((r) => r.data.data),

  /** 메뉴 생성 */
  create: (body: MenuFormValues) =>
    api.post<ApiResponse<Menu>>('/menus', body).then((r) => r.data.data),

  /** 메뉴 수정 */
  update: (menuId: string, body: Partial<MenuFormValues>) =>
    api.put<ApiResponse<Menu>>(`/menus/${menuId}`, body).then((r) => r.data.data),

  /** 메뉴 삭제 */
  delete: (menuId: string) =>
    api.delete(`/menus/${menuId}`).then((r) => r.data),

  /** 순서 일괄 저장 */
  updateOrder: (orders: MenuOrderItem[]) =>
    api.put('/menus/order', { orders }).then((r) => r.data),
};
