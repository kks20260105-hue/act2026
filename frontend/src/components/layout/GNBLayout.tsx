import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import styles from './GNBLayout.module.css';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMyMenus } from '../../hooks/useMenuTree';

const { Header } = Layout;
const { Text } = Typography;

export default function GNBLayout() {
  const navigate     = useNavigate();
  const location     = useLocation();
  const { user, logout } = useAuth();
  const { data: myMenus = [] } = useMyMenus();

  const gnbMenus = myMenus.filter((m) => m.menu_depth === 1);

  const handleLogout = async () => {
    await logout();   // 백엔드 토큰 폐기 + localStorage 초기화 + 스토어 클리어
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

  return (
    <Header className={styles.header} style={{ background: '#001529' }}>
      {/* 로고 */}
      <div className={styles.logo} onClick={() => navigate('/')}>
        KKS Portal
      </div>

      {/* GNB 메뉴 */}
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[location.pathname.split('/')[1] ? `/${location.pathname.split('/')[1]}` : '/']}
        className={styles.gnbMenu}
        items={gnbMenus.map((m) => ({
          key:   m.menu_url,
          label: m.menu_nm,
          onClick: () => navigate(m.menu_url),
        }))}
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
