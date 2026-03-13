import React from 'react';
import styles from './HomePage.module.css';
import { Typography, Card, Row, Col, Space } from 'antd';
import {
  AppstoreOutlined, UploadOutlined, TeamOutlined,
  ApartmentOutlined, UserSwitchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/layout/PageLayout';
import { useAuth } from '../hooks/useAuth';

const { Title, Text } = Typography;

const adminCards = [
  { title: '메뉴 관리',        icon: <AppstoreOutlined   style={{ fontSize: 32, color: '#1677ff' }} />, path: '/admin/menus' },
  { title: '메뉴 엑셀 업로드', icon: <UploadOutlined     style={{ fontSize: 32, color: '#52c41a' }} />, path: '/admin/menu-upload' },
  { title: 'Role 관리',        icon: <TeamOutlined       style={{ fontSize: 32, color: '#eb2f96' }} />, path: '/admin/roles' },
  { title: '메뉴-Role 매핑',   icon: <ApartmentOutlined  style={{ fontSize: 32, color: '#faad14' }} />, path: '/admin/menu-roles' },
  { title: '사용자-Role 관리', icon: <UserSwitchOutlined style={{ fontSize: 32, color: '#722ed1' }} />, path: '/admin/user-roles' },
];

const HomePage: React.FC = () => {
  const navigate          = useNavigate();
  const { user, isAdmin } = useAuth();

  return (
    <PageLayout showLNB={false}>
      <div className={styles.container}>
        <Title level={3}>안녕하세요, {user?.email} 님 👋</Title>
        <Text type="secondary">KKS 엔터프라이즈 포털에 오신 것을 환영합니다.</Text>

        {isAdmin && (
          <div className={styles.adminSection}>
            <Title level={5}>관리 메뉴</Title>
            <Row gutter={[16, 16]}>
              {adminCards.map((card) => (
                <Col key={card.path} xs={24} sm={12} md={8}>
                  <Card
                    hoverable
                    className={styles.adminCard}
                    onClick={() => navigate(card.path)}
                  >
                    <Space direction="vertical" align="center">
                      {card.icon}
                      <Text strong>{card.title}</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default HomePage;
