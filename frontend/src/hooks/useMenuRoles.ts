import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userRoleApi } from '../api/userRoleApi';

/** 메뉴-Role 매핑 조회 */
export function useMenuRoles(menuId?: string) {
  return useQuery({
    queryKey: ['menu-roles', menuId ?? 'all'],
    queryFn:  () => userRoleApi.getMenuRoles(menuId),
  });
}

/** 메뉴-Role 배치 저장 */
export function useBatchMenuRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ menuId, roleIds }: { menuId: string; roleIds: string[] }) =>
      userRoleApi.batchMenuRoles(menuId, roleIds),
    onSuccess: (_, { menuId }) => {
      qc.invalidateQueries({ queryKey: ['menu-roles', menuId] });
      qc.invalidateQueries({ queryKey: ['menus'] });
    },
  });
}
