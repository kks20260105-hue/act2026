import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userRoleApi } from '../api/userRoleApi';

/** 사용자 Role 목록 */
export function useUserRoles(userId: string) {
  return useQuery({
    queryKey: ['user-roles', userId],
    queryFn:  () => userRoleApi.getByUser(userId),
    enabled:  !!userId,
  });
}

/** Role 부여 */
export function useGrantRole(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { role_id: string; start_dt?: string; end_dt?: string }) =>
      userRoleApi.grant(userId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-roles', userId] });
      // Invalidate parent users list so the main list reflects granted roles immediately
      qc.invalidateQueries({ queryKey: ['users'], exact: false });
    },
  });
}

/** Role 회수 */
export function useRevokeRole(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => userRoleApi.revoke(userId, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-roles', userId] });
      // Invalidate all queries that start with 'users' (users list cache uses params as part of the key)
      qc.invalidateQueries({ queryKey: ['users'], exact: false });
    },
  });
}
