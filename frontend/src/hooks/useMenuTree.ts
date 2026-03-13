import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi } from '../api/menuApi';
import { useMenuStore } from '../stores/menuStore';
import type { Menu, MenuFormValues, MenuOrderItem } from '../types/menu';

export const MENU_KEYS = {
  all:   ['menus'] as const,
  my:    ['menus', 'my'] as const,
  byId:  (id: string) => ['menus', id] as const,
};

/** 전체 메뉴 목록 */
export function useMenuTree() {
  const setMenus = useMenuStore((s) => s.setMenus);
  return useQuery({
    queryKey: MENU_KEYS.all,
    queryFn:  async () => {
      const data = await menuApi.getAll();
      setMenus(data);
      return data;
    },
  });
}

/** 내 메뉴 목록 (Role 기반) */
export function useMyMenus() {
  const setMyMenus = useMenuStore((s) => s.setMyMenus);
  return useQuery({
    queryKey: MENU_KEYS.my,
    queryFn:  async () => {
      const data = await menuApi.getMy();
      setMyMenus(data);
      return data;
    },
  });
}

/** 메뉴 생성 */
export function useCreateMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MenuFormValues) => menuApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: MENU_KEYS.all }),
  });
}

/** 메뉴 수정 */
export function useUpdateMenu(menuId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<MenuFormValues>) => menuApi.update(menuId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_KEYS.all });
      qc.invalidateQueries({ queryKey: MENU_KEYS.byId(menuId) });
    },
  });
}

/** 메뉴 삭제 */
export function useDeleteMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (menuId: string) => menuApi.delete(menuId),
    onSuccess: () => qc.invalidateQueries({ queryKey: MENU_KEYS.all }),
  });
}

/** 메뉴 순서 저장 */
export function useUpdateMenuOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: MenuOrderItem[]) => menuApi.updateOrder(orders),
    onSuccess: () => qc.invalidateQueries({ queryKey: MENU_KEYS.all }),
  });
}
