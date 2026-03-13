import { create } from 'zustand';
import type { Menu, MenuTreeNode } from '../types/menu';

/** 평탄한 메뉴 배열 → 트리 구조로 변환 */
function buildTree(menus: Menu[]): MenuTreeNode[] {
  const map: Record<string, MenuTreeNode> = {};
  const roots: MenuTreeNode[] = [];

  menus.forEach((m) => {
    map[m.menu_id] = { ...m, key: m.menu_id, title: m.menu_nm, children: [] };
  });

  menus.forEach((m) => {
    if (m.parent_menu_id && map[m.parent_menu_id]) {
      map[m.parent_menu_id].children.push(map[m.menu_id]);
    } else {
      roots.push(map[m.menu_id]);
    }
  });

  return roots;
}

interface MenuState {
  menus:       Menu[];
  myMenus:     Menu[];
  menuTree:    MenuTreeNode[];
  setMenus:    (menus: Menu[]) => void;
  setMyMenus:  (menus: Menu[]) => void;
}

export const useMenuStore = create<MenuState>()((set) => ({
  menus:    [],
  myMenus:  [],
  menuTree: [],

  setMenus: (menus) =>
    set({ menus, menuTree: buildTree(menus) }),

  setMyMenus: (menus) =>
    set({ myMenus: menus }),
}));
