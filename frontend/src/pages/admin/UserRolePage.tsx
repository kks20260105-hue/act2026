import React, { useState } from 'react';
import {
  Typography, Table, Space, Tag, Button, App, DatePicker,
  Form, Modal, Input, Card, Row, Col, Avatar, Divider, Select,
} from 'antd';
import { PlusOutlined, StopOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import { useUserRoles, useGrantRole, useRevokeRole } from '../../hooks/useUserRoles';
import { useRoles } from '../../hooks/useRoles';
import { useUsers } from '../../hooks/useUsers';
import type { UserProfile } from '../../hooks/useUsers';
import PageLayout from '../../components/layout/PageLayout';
import type { UserRole } from '../../types/role';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function UserRolePage() {
  const { message, modal } = App.useApp();
  const { data: allRoles = [] } = useRoles();

  // 사용자 목록 상태
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const { data: usersData, isLoading: usersLoading } = useUsers({ search, page, limit: 15 });
  const users = usersData?.data ?? [];
  const totalUsers = usersData?.total ?? 0;

  // 선택된 사용자
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const targetUserId = selectedUser?.id ?? '';

  // Role 관련
  const [grantOpen, setGrantOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(targetUserId);
  const grantRole = useGrantRole(targetUserId);
  const revokeRole = useRevokeRole(targetUserId);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
  };

  const handleRevoke = (ur: UserRole) => {
    modal.confirm({
      title: `"${ur.tb_role?.role_nm}" Role을 회수하시겠습니까?`,
      okType: 'danger',
      onOk: async () => {
        try {
          await revokeRole.mutateAsync(ur.role_id);
          message.success('회수되었습니다.');
        } catch (e: any) {
          message.error(e?.response?.data?.message ?? 'Role 회수에 실패했습니다.');
        }
      },
    });
  };

  const handleGrant = async () => {
    const values = await form.validateFields();
    try {
      await grantRole.mutateAsync({
        role_id: values.role_id,
        start_dt: values.start_dt ? values.start_dt.format('YYYY-MM-DD') : undefined,
        end_dt: values.end_dt ? values.end_dt.format('YYYY-MM-DD') : undefined,
      });
      message.success('Role이 부여되었습니다.');
      setGrantOpen(false);
      form.resetFields();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Role 부여에 실패했습니다.');
    }
  };

  // 사용자 목록 컬럼
  const userColumns = [
    {
      title: '사용자',
      key: 'user',
      render: (_: any, r: UserProfile) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
          <span>
            <Text strong style={{ fontSize: 13 }}>{r.username ?? '-'}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{r.email}</Text>
          </span>
        </Space>
      ),
    },
    {
      title: '부서',
      dataIndex: 'dept_nm',
      width: 100,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'Role',
      key: 'roles',
      width: 160,
      render: (_: any, r: UserProfile) => {
        const activeRoles = (r.tb_user_role ?? []).filter((ur) => ur.use_yn === 'Y');
        if (activeRoles.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space size={2} wrap>
            {activeRoles.map((ur) =>
              ur.tb_role ? (
                <Tag key={ur.role_id} color={ur.tb_role.role_color ?? 'blue'} style={{ fontSize: 11 }}>
                  {ur.tb_role.role_cd}
                </Tag>
              ) : null
            )}
          </Space>
        );
      },
    },
    {
      title: '가입일',
      dataIndex: 'created_at',
      width: 100,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
  ];

  // 선택 사용자의 Role 컬럼
  const roleColumns = [
    {
      title: 'Role',
      key: 'role',
      render: (_: any, r: UserRole) => (
        <Tag color={r.tb_role?.role_color ?? 'blue'}>{r.tb_role?.role_nm ?? r.role_id}</Tag>
      ),
    },
    { title: '시작일', dataIndex: 'start_dt', width: 110 },
    {
      title: '만료일',
      dataIndex: 'end_dt',
      width: 110,
      render: (v: string | null) => v ?? '∞ (무기한)',
    },
    {
      title: '상태',
      key: 'status',
      width: 80,
      render: (_: any, r: UserRole) => {
        const expired = r.end_dt && dayjs(r.end_dt).isBefore(dayjs(), 'day');
        return <Tag color={expired ? 'red' : 'green'}>{expired ? '만료' : '활성'}</Tag>;
      },
    },
    {
      title: '회수',
      key: 'revoke',
      width: 80,
      render: (_: any, r: UserRole) => (
        <Button size="small" danger icon={<StopOutlined />} onClick={() => handleRevoke(r)}>
          회수
        </Button>
      ),
    },
  ];

  return (
    <PageLayout
      breadcrumbs={[
        { title: '홈', href: '/' },
        { title: '관리' },
        { title: '사용자-Role 관리' },
      ]}
      parentMenuUrl="/admin"
    >
      <Title level={4} style={{ marginBottom: 16 }}>사용자-Role 관리</Title>

      <Row gutter={16}>
        {/* 좌측: 사용자 목록 */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title="사용자 목록"
            extra={
              <Space>
                <Input
                  placeholder="이름 / 이메일 / 부서 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 220 }}
                  suffix={
                    <SearchOutlined style={{ cursor: 'pointer' }} onClick={handleSearch} />
                  }
                />
              </Space>
            }
          >
            <Table<UserProfile>
              rowKey="id"
              columns={userColumns}
              dataSource={users}
              loading={usersLoading}
              size="small"
              pagination={{
                current: page,
                pageSize: 15,
                total: totalUsers,
                onChange: (p: number) => setPage(p),
                showTotal: (t: number) => `총 ${t}명`,
                size: 'small',
              }}
              onRow={(record) => ({
                onClick: () => handleSelectUser(record),
                style: {
                  cursor: 'pointer',
                  background: selectedUser?.id === record.id ? '#e6f4ff' : undefined,
                },
              })}
            />
          </Card>
        </Col>

        {/* 우측: 선택 사용자 Role */}
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={
              selectedUser
                ? `${selectedUser.username ?? selectedUser.email} 님의 Role`
                : 'Role 관리 (사용자 선택 후 확인)'
            }
            extra={
              selectedUser && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setGrantOpen(true)}
                >
                  Role 부여
                </Button>
              )
            }
          >
            {selectedUser ? (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                  <span>
                    <Text strong>{selectedUser.username ?? '-'}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{selectedUser.email}</Text>
                    {selectedUser.dept_nm && (
                      <Tag style={{ marginLeft: 8 }}>{selectedUser.dept_nm}</Tag>
                    )}
                  </span>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
                <Table<UserRole>
                  rowKey="user_role_id"
                  columns={roleColumns}
                  dataSource={userRoles}
                  loading={rolesLoading}
                  pagination={false}
                  size="small"
                  bordered
                  locale={{ emptyText: '부여된 Role이 없습니다.' }}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                좌측 목록에서 사용자를 클릭하세요
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Role 부여 모달 */}
      <Modal
        title={`Role 부여 — ${selectedUser?.username ?? selectedUser?.email ?? ''}`}
        open={grantOpen}
        onOk={handleGrant}
        onCancel={() => {
          setGrantOpen(false);
          form.resetFields();
        }}
        okText="부여"
        cancelText="취소"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="Role"
            name="role_id"
            rules={[{ required: true, message: 'Role을 선택하세요.' }]}
          >
            <Select
              placeholder="Role 선택"
              options={allRoles.map((r) => ({
                value: r.role_id,
                label: `${r.role_nm} (${r.role_cd})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="시작일" name="start_dt" initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="만료일" name="end_dt">
            <DatePicker placeholder="비워두면 무기한" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  );
}
