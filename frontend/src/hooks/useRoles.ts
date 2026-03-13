import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleApi } from '../api/roleApi';
import type { Role } from '../types/role';

export const ROLE_KEYS = {
  all:  ['roles'] as const,
  byId: (id: string) => ['roles', id] as const,
};

export function useRoles() {
  return useQuery({
    queryKey: ROLE_KEYS.all,
    queryFn:  roleApi.getAll,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Role>) => roleApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLE_KEYS.all }),
  });
}

export function useUpdateRole(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Role>) => roleApi.update(roleId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLE_KEYS.all }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => roleApi.delete(roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLE_KEYS.all }),
  });
}
