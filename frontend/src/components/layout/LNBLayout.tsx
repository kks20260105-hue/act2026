import React, { useMemo } from 'react';
import { Layout, Menu, Typography } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import styles from './LNBLayout.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMenuStore } from '../../stores/menuStore';
import type { Menu as MenuType } from '../../types/menu';

const { Sider } = Layout;
const { Text }  = Typography;

interface Props {
  parentMenuUrl?: string;
}

/** 재귀적으로 Ant Design Menu items 빌드 */
function buildItems(
  allMenus: MenuType[],
  parentId: string | null,
  navigate: (url: string) => void,
): ItemType[] {
  return allMenus
    .filter((m) => m.parent_menu_id === parentId)
    .sort((a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0))
    .map((m) => {
      const children = buildItems(allMenus, m.menu_id, navigate);

      if (children.length > 0) {
        return {
          key:      m.menu_url,
          label:    m.menu_nm,
          children,
        } as ItemType;
      }
      return {
        key:     m.menu_url,
        label:   m.menu_nm,
        onClick: () => navigate(m.menu_url),
      } as ItemType;
    });
}

/** 자식이 있는 모든 메뉴 URL 수집 (전체 펼침용) */
function getAllParentKeys(allMenus: MenuType[]): string[] {
  const parentIds = new Set(allMenus.map((m) => m.parent_menu_id).filter(Boolean));
  return allMenus.filter((m) => parentIds.has(m.menu_id)).map((m) => m.menu_url);
}

export default function LNBLayout({ parentMenuUrl }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const myMenus  = useMenuStore((s) => s.myMenus) ?? [];

  const gnbMenus = myMenus.filter((m) => m.menu_depth === 1);

  // 활성 GNB 자동 감지
  const activeGnb = useMemo(() => {
    const url = parentMenuUrl ??
      gnbMenus.find((g) =>
        location.pathname === g.menu_url ||
        location.pathname.startsWith(g.menu_url + '/'),
      )?.menu_url;
    return gnbMenus.find((g) => g.menu_url === url) ?? null;
  }, [parentMenuUrl, gnbMenus, location.pathname]);

  // 활성 GNB 하위의 모든 메뉴 (전 depth)
  const subMenus = useMemo(() => {
    if (!activeGnb) return [];
    const result: MenuType[] = [];
    const collect = (parentId: string) => {
      myMenus
        .filter((m) => m.parent_menu_id === parentId)
        .sort((a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0))
        .forEach((m) => { result.push(m); collect(m.menu_id); });
    };
    collect(activeGnb.menu_id);
    return result;
  }, [activeGnb, myMenus]);

  const menuItems = useMemo(
    () => buildItems(subMenus, activeGnb?.menu_id ?? null, navigate),
    [subMenus, activeGnb, navigate],
  );

  // 자식이 있는 모든 항목을 기본 펼침 (10 depth 전체)
  const allOpenKeys = useMemo(
    () => getAllParentKeys(subMenus),
    [subMenus],
  );

  if (!activeGnb || menuItems.length === 0) return null;

  return (
    <Sider width={220} className={styles.sider}>
      {/* GNB 제목 헤더 */}
      <div className={styles.gnbHeader}>
        <Text strong style={{ fontSize: 13 }}>{activeGnb.menu_nm}</Text>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        defaultOpenKeys={allOpenKeys}
        className={styles.menu}
        items={menuItems}
      />
    </Sider>
  );
}
