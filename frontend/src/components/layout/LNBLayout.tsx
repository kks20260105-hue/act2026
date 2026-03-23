import React from 'react';
import { Layout, Menu } from 'antd';
import styles from './LNBLayout.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMenuStore } from '../../stores/menuStore';
import * as Icons from '@ant-design/icons';

const { Sider } = Layout;

interface Props {
  parentMenuUrl?: string; // 미전달 시 현재 URL에서 자동 감지
}

export default function LNBLayout({ parentMenuUrl }: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const myMenus   = useMenuStore((s) => s.myMenus) ?? [];

  const gnbMenus  = myMenus.filter((m) => m.menu_depth === 1);

  // parentMenuUrl 미전달 시 현재 경로로 활성 GNB 자동 감지
  const activeGnbUrl = parentMenuUrl ??
    gnbMenus.find((g) =>
      location.pathname === g.menu_url ||
      location.pathname.startsWith(g.menu_url + '/')
    )?.menu_url;

  const lnbMenus = myMenus.filter((m) => {
    if (m.menu_depth !== 2) return false;
    if (activeGnbUrl) {
      const parent = myMenus.find((p) => p.menu_id === m.parent_menu_id);
      return parent?.menu_url === activeGnbUrl;
    }
    return false;
  });

  if (lnbMenus.length === 0) return null;

  function getIcon(iconClass?: string | null) {
    if (!iconClass) return null;
    const IconComp = (Icons as any)[`${iconClass.charAt(0).toUpperCase()}${iconClass.slice(1)}Outlined`];
    return IconComp ? <IconComp /> : null;
  }

  return (
    <Sider width={220} className={styles.sider}>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        className={styles.menu}
        items={lnbMenus.map((m) => ({
          key:   m.menu_url,
          icon:  getIcon(m.icon_class),
          label: m.menu_nm,
          onClick: () => navigate(m.menu_url),
        }))}
      />
    </Sider>
  );
}
