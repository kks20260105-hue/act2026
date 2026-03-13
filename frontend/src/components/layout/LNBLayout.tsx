import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMenuStore } from '../../stores/menuStore';
import * as Icons from '@ant-design/icons';

const { Sider } = Layout;

interface Props {
  parentMenuUrl?: string;
}

export default function LNBLayout({ parentMenuUrl }: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const myMenus   = useMenuStore((s) => s.myMenus);

  const lnbMenus = myMenus.filter((m) => {
    if (m.menu_depth !== 2) return false;
    if (parentMenuUrl) {
      const parent = myMenus.find((p) => p.menu_id === m.parent_menu_id);
      return parent?.menu_url === parentMenuUrl;
    }
    return true;
  });

  if (lnbMenus.length === 0) return null;

  function getIcon(iconClass?: string | null) {
    if (!iconClass) return null;
    const IconComp = (Icons as any)[`${iconClass.charAt(0).toUpperCase()}${iconClass.slice(1)}Outlined`];
    return IconComp ? <IconComp /> : null;
  }

  return (
    <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
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
