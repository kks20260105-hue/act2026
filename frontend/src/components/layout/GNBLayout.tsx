import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
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
    await fetch('/api/auth/logout', { method: 'POST' });
    logout();
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
    <Header
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        background:      '#001529',
        padding:         '0 24px',
        position:        'sticky',
        top:             0,
        zIndex:          100,
      }}
    >
      {/* 로고 */}
      <div
        style={{ color: '#fff', fontWeight: 700, fontSize: 18, cursor: 'pointer', minWidth: 120 }}
        onClick={() => navigate('/')}
      >
        KKS Portal
      </div>

      {/* GNB 메뉴 */}
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[location.pathname.split('/')[1] ? `/${location.pathname.split('/')[1]}` : '/']}
        style={{ flex: 1, minWidth: 0 }}
        items={gnbMenus.map((m) => ({
          key:   m.menu_url,
          label: m.menu_nm,
          onClick: () => navigate(m.menu_url),
        }))}
      />

      {/* 사용자 정보 */}
      <Dropdown menu={userMenu} placement="bottomRight">
        <Space style={{ cursor: 'pointer' }}>
          <Avatar icon={<UserOutlined />} size="small" style={{ background: '#1677ff' }} />
          <Text style={{ color: '#fff' }}>{user?.email}</Text>
        </Space>
      </Dropdown>
    </Header>
  );
}
