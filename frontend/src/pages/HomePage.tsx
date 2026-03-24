import React, { useState } from 'react';
import styles from './HomePage.module.css';
import { Typography, Card, Row, Col, Space } from 'antd';
import {
  AppstoreOutlined, UploadOutlined, TeamOutlined,
  ApartmentOutlined, UserSwitchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/layout/PageLayout';
import { useAuth } from '../hooks/useAuth';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Title, Text } = Typography;

const STORAGE_KEY = 'admin_card_order';

const DEFAULT_CARDS = [
  { id: 'menus',       title: '메뉴 관리',        icon: <AppstoreOutlined   style={{ fontSize: 32, color: '#1677ff' }} />, path: '/admin/menus' },
  { id: 'menu-upload', title: '메뉴 엑셀 업로드', icon: <UploadOutlined     style={{ fontSize: 32, color: '#52c41a' }} />, path: '/admin/menu-upload' },
  { id: 'roles',       title: 'Role 관리',        icon: <TeamOutlined       style={{ fontSize: 32, color: '#eb2f96' }} />, path: '/admin/roles' },
  { id: 'menu-roles',  title: '메뉴-Role 매핑',   icon: <ApartmentOutlined  style={{ fontSize: 32, color: '#faad14' }} />, path: '/admin/menu-roles' },
  { id: 'user-roles',  title: '사용자-Role 관리', icon: <UserSwitchOutlined style={{ fontSize: 32, color: '#722ed1' }} />, path: '/admin/user-roles' },
];

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: string[] = JSON.parse(saved);
      // 저장된 순서가 유효한 id만 포함하는지 검증
      const validIds = DEFAULT_CARDS.map((c) => c.id);
      if (parsed.every((id) => validIds.includes(id)) && parsed.length === validIds.length) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_CARDS.map((c) => c.id);
}

// ── 개별 카드 컴포넌트 ────────────────────────────────────────────
interface SortableCardProps {
  id:       string;
  title:    string;
  icon:     React.ReactNode;
  path:     string;
  navigate: (path: string) => void;
}

function SortableCard({ id, title, icon, path, navigate }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <Col xs={24} sm={12} md={8}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{
          transform:  CSS.Transform.toString(transform),
          transition,
          opacity:    isDragging ? 0.45 : 1,
          cursor:     isDragging ? 'grabbing' : 'grab',
          zIndex:     isDragging ? 999 : undefined,
        }}
      >
        <Card
          hoverable={!isDragging}
          className={`${styles.adminCard} ${isDragging ? styles.dragging : ''}`}
          onClick={() => { if (!isDragging) navigate(path); }}
        >
          <Space direction="vertical" align="center">
            {icon}
            <Text strong>{title}</Text>
          </Space>
        </Card>
      </div>
    </Col>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────
const HomePage: React.FC = () => {
  const navigate          = useNavigate();
  const { user, isAdmin } = useAuth();

  const [order, setOrder] = useState<string[]>(loadOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as string);
    const newIdx = order.indexOf(over.id   as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const sortedCards = order
    .map((id) => DEFAULT_CARDS.find((c) => c.id === id)!)
    .filter(Boolean);

  return (
    <PageLayout showLNB={false}>
      <div className={styles.container}>
        <Title level={3}>안녕하세요, {user?.email} 님 👋</Title>
        <Text type="secondary">KKS 엔터프라이즈 포털에 오신 것을 환영합니다.</Text>

        {isAdmin && (
          <div className={styles.adminSection}>
            <Title level={5}>관리 메뉴</Title>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={order} strategy={rectSortingStrategy}>
                <Row gutter={[16, 16]}>
                  {sortedCards.map((card) => (
                    <SortableCard
                      key={card.id}
                      id={card.id}
                      title={card.title}
                      icon={card.icon}
                      path={card.path}
                      navigate={navigate}
                    />
                  ))}
                </Row>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default HomePage;
