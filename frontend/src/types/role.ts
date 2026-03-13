import type { UseYN } from './common';

export interface Role {
  role_id:    string;
  role_cd:    string;
  role_nm:    string;
  role_desc:  string | null;
  role_color: string | null;
  sort_order: number;
  use_yn:     UseYN;
  is_system:  boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UserRole {
  user_role_id: string;
  user_id:      string;
  role_id:      string;
  start_dt:     string;
  end_dt:       string | null;
  use_yn:       UseYN;
  granted_by:   string | null;
  created_at:   string;
  tb_role?:     Pick<Role, 'role_id' | 'role_cd' | 'role_nm' | 'role_color' | 'sort_order'>;
}

export type RoleCode = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
