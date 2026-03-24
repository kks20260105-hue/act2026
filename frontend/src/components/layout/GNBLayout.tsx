import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import styles from './GNBLayout.module.css';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMyMenus } from '../../hooks/useMenuTree';
import { useMenuStore } from '../../stores/menuStore';

const { Header } = Layout;
const { Text } = Typography;

export default function GNBLayout() {
  const navigate         = useNavigate();
  const location         = useLocation();
  const { user, logout } = useAuth();
  useMyMenus(); // 내 메뉴 로드 (스토어에 저장)
  const myMenus          = useMenuStore((s) => s.myMenus) ?? [];

  const gnbMenus = myMenus.filter((m) => m.menu_depth === 1);
  const lnbMenus = myMenus.filter((m) => m.menu_depth === 2);

  // ── 디버그 로그 (문제 파악용) ─────────────────────────────────────────
  console.log('[GNBLayout] myMenus 전체:', myMenus.length, '개', myMenus);
  console.log('[GNBLayout] gnbMenus(depth=1):', gnbMenus.length, '개', gnbMenus);
  console.log('[GNBLayout] lnbMenus(depth=2):', lnbMenus.length, '개', lnbMenus);

  // 현재 경로의 첫 번째 세그먼트로 활성 GNB 계산
  const activeGnbKey = gnbMenus.find((g) =>
    location.pathname === g.menu_url || location.pathname.startsWith(g.menu_url + '/')
  )?.menu_url ?? '';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '로그아웃',
        onClick: handleLogout,
      },
    ],
  };

  // GNB 아이템 빌드: 하위 메뉴가 있으면 드롭다운 서브메뉴로 표시
  const menuItems = gnbMenus.map((gnb) => {
    const children = lnbMenus.filter((m) => m.parent_menu_id === gnb.menu_id);
    if (children.length > 0) {
      return {
        key:      gnb.menu_url,
        label:    gnb.menu_nm,
        children: children.map((child) => ({
          key:     child.menu_url,
          label:   child.menu_nm,
          onClick: () => navigate(child.menu_url),
        })),
      };
    }
    return {
      key:     gnb.menu_url,
      label:   gnb.menu_nm,
      onClick: () => navigate(gnb.menu_url),
    };
  });

  return (
    <Header className={styles.header} style={{ background: '#001529' }}>
      {/* 로고 */}
      <div className={styles.logo} onClick={() => navigate('/')}>
        KKS Portal
      </div>

      {/* GNB 메뉴 - 하위 메뉴는 드롭다운으로 자동 표시 */}
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[location.pathname, activeGnbKey]}
        className={styles.gnbMenu}
        items={menuItems}
      />

      {/* 사용자 정보 */}
      <Dropdown menu={userMenu} placement="bottomRight">
        <Space className={styles.user}>
          <Avatar icon={<UserOutlined />} size="small" style={{ background: '#1677ff' }} />
          <Text className={styles.userEmail}>{user?.email}</Text>
        </Space>
      </Dropdown>
    </Header>
  );
}
