import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { ApiResponse } from '../types/common';

export interface UserProfile {
  id:           string;
  email:        string;
  username:     string | null;
  name:         string | null;
  display_name: string | null;
  department:   string | null;
  position_nm:  string | null;
  is_active:    boolean;
  created_at:   string;
  tb_user_role?: Array<{
    role_id:  string;
    start_dt: string;
    end_dt:   string | null;
    use_yn:   'Y' | 'N';
    tb_role:  { role_cd: string; role_nm: string; role_color: string | null } | null;
  }>;
}

interface UsersResponse extends ApiResponse<UserProfile[]> {
  total: number;
  page:  number;
  limit: number;
}

export function useUsers(params: { search?: string; page?: number; limit?: number } = {}) {
  const { search = '', page = 1, limit = 20 } = params;
  return useQuery({
    queryKey: ['users', { search, page, limit }],
    queryFn:  () =>
      api.get<UsersResponse>('/users', { params: { search: search || undefined, page, limit } })
         .then((r) => r.data),
    placeholderData: (prev) => prev,
  });
}
