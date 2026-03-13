import type { UseYN } from './common';

export interface Menu {
  menu_id:        string;
  menu_nm:        string;
  menu_url:       string;
  parent_menu_id: string | null;
  menu_depth:     1 | 2;
  menu_order:     number;
  icon_class:     string | null;
  use_yn:         UseYN;
  can_write?:     boolean;
  created_at:     string;
  updated_at:     string | null;
  children?:      Menu[];
  menu_roles?:    MenuRoleItem[];
}

export interface MenuRoleItem {
  role_id:  string;
  read_yn:  UseYN;
  write_yn: UseYN;
  tb_role?: { role_cd: string; role_nm: string; role_color: string };
}

export interface MenuFormValues {
  menu_nm:        string;
  menu_url:       string;
  parent_menu_id?: string;
  menu_depth:     number;
  menu_order:     number;
  icon_class?:    string;
  use_yn:         UseYN;
}

/** 트리 구조로 변환된 메뉴 */
export interface MenuTreeNode extends Menu {
  key:      string;
  title:    string;
  children: MenuTreeNode[];
}

/** 메뉴 순서 변경 항목 */
export interface MenuOrderItem {
  menu_id:    string;
  menu_order: number;
}
