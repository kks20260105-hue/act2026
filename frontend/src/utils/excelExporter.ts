import * as XLSX from 'xlsx';
import type { Menu } from '../types/menu';

/** 메뉴 목록을 엑셀로 내보내기 */
export function exportMenusToExcel(menus: Menu[], fileName = 'menu_export.xlsx') {
  const rows = menus.map((m) => ({
    menu_nm:         m.menu_nm,
    menu_url:        m.menu_url,
    parent_menu_url: m.parent_menu_id ?? '',
    menu_depth:      m.menu_depth,
    menu_order:      m.menu_order,
    icon_class:      m.icon_class ?? '',
    use_yn:          m.use_yn,
    allow_roles:     (m.menu_roles ?? [])
      .map((r) => r.tb_role?.role_cd)
      .filter(Boolean)
      .join(','),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Menus');
  XLSX.writeFile(wb, fileName);
}
