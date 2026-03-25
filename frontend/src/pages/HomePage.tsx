import React, { useState } from 'react';
import styles from './HomePage.module.css';
import { Typography, Card, Row, Col, Space, Carousel } from 'antd';
import {
  AppstoreOutlined, UploadOutlined, TeamOutlined,
  ApartmentOutlined, UserSwitchOutlined,
  RocketOutlined, SafetyCertificateOutlined, BarChartOutlined,
  CloudServerOutlined, SolutionOutlined,
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

// ── 배너 슬라이드 데이터 ──────────────────────────────────────────
const BANNER_SLIDES = [
  {
    id:       1,
    gradient: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
    icon:     <RocketOutlined style={{ fontSize: 56, color: 'rgba(255,255,255,0.9)' }} />,
    title:    'Portal Service에 오신 것을 환영합니다',
    sub:      '업무 효율을 높이는 통합 엔터프라이즈 포털',
  },
  {
    id:       2,
    gradient: 'linear-gradient(135deg, #52c41a 0%, #237804 100%)',
    icon:     <AppstoreOutlined style={{ fontSize: 56, color: 'rgba(255,255,255,0.9)' }} />,
    title:    '메뉴 관리 시스템',
    sub:      'GNB / LNB 구조로 서비스 메뉴를 손쉽게 관리하세요',
  },
  {
    id:       3,
    gradient: 'linear-gradient(135deg, #eb2f96 0%, #780650 100%)',
    icon:     <SafetyCertificateOutlined style={{ fontSize: 56, color: 'rgba(255,255,255,0.9)' }} />,
    title:    '역할 기반 접근 제어 (RBAC)',
    sub:      'Role 단위로 메뉴 권한을 세밀하게 설정하세요',
  },
  {
    id:       4,
    gradient: 'linear-gradient(135deg, #faad14 0%, #ad6800 100%)',
    icon:     <SolutionOutlined style={{ fontSize: 56, color: 'rgba(255,255,255,0.9)' }} />,
    title:    '사용자 권한 관리',
    sub:      '사용자별 Role 부여 및 만료일 관리로 보안을 강화하세요',
  },
  {
    id:       5,
    gradient: 'linear-gradient(135deg, #722ed1 0%, #391085 100%)',
    icon:     <CloudServerOutlined style={{ fontSize: 56, color: 'rgba(255,255,255,0.9)' }} />,
    title:    '클라우드 기반 인프라',
    sub:      'Supabase + Vercel로 안정적인 서비스 환경을 제공합니다',
  },
];

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
        <Text type="secondary">Portal Service에 오신 것을 환영합니다.</Text>

        {/* ── 배너 캐러셀 ─────────────────────────────────────────── */}
        <div className={styles.bannerWrap}>
          <Carousel autoplay autoplaySpeed={5000} dots effect="fade" dotPosition="bottom">
            {BANNER_SLIDES.map((slide) => (
              <div key={slide.id}>
                <div
                  className={styles.bannerSlide}
                  style={{ background: slide.gradient }}
                >
                  <div className={styles.bannerIcon}>{slide.icon}</div>
                  <div className={styles.bannerTitle}>{slide.title}</div>
                  <div className={styles.bannerSub}>{slide.sub}</div>
                </div>
              </div>
            ))}
          </Carousel>
        </div>

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
