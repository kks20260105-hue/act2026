import React, { useState } from 'react';
import {
  Typography, Table, Space, Tag, Button, App, DatePicker,
  Form, Modal, Input, Card, Avatar, Divider, Select, Pagination,
  Tooltip,
} from 'antd';
import {
  PlusOutlined, StopOutlined, UserOutlined, SearchOutlined,
  ControlOutlined, DoubleLeftOutlined, DoubleRightOutlined,
} from '@ant-design/icons';
import { useUserRoles, useGrantRole, useRevokeRole } from '../../hooks/useUserRoles';
import { useRoles } from '../../hooks/useRoles';
import { useUsers } from '../../hooks/useUsers';
import DeleteSub1 from '../../components/admin/DeleteSub1';
import type { UserProfile } from '../../hooks/useUsers';
import PageLayout from '../../components/layout/PageLayout';
import type { UserRole } from '../../types/role';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function Menu04_MenuRolePage() {
  const { message, modal } = App.useApp();
  const { data: allRoles = [] } = useRoles();

  /* ────── 사용자 목록 / 검색 / 페이지 ───────────────────────────────── */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  const { data: usersData, isLoading: usersLoading } = useUsers({ search, page, limit: pageSize });
  const users      = usersData?.data  ?? [];
  const totalUsers = usersData?.total ?? 0;
  const lastPage   = Math.ceil(totalUsers / pageSize) || 1;

  const handleSearch = () => { setSearch(searchInput.trim()); setPage(1); };

  /* ────── 선택 사용자 / Role 모달 ───────────────────────────────────── */
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const targetUserId = selectedUser?.id ?? '';

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [grantOpen, setGrantOpen]         = useState(false);
  const [form]                            = Form.useForm();

  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(targetUserId);
  const grantRole  = useGrantRole(targetUserId);
  const revokeRole = useRevokeRole(targetUserId);

  const openRoleModal = (user: UserProfile) => {
    setSelectedUser(user);
    setRoleModalOpen(true);
  };

  const handleRevoke = (ur: UserRole) => {
    modal.confirm({
      title:  `"${ur.tb_role?.role_nm}" Role을 회수하시겠습니까?`,
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
    if (grantRole.status === 'pending') return;
    const values = await form.validateFields();
    try {
      await grantRole.mutateAsync({
        role_id:  values.role_id,
        start_dt: values.start_dt ? values.start_dt.format('YYYY-MM-DD') : undefined,
        end_dt:   values.end_dt   ? values.end_dt.format('YYYY-MM-DD')   : undefined,
      });
      message.success('Role이 부여되었습니다.');
      setGrantOpen(false);
      form.resetFields();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Role 부여에 실패했습니다.');
    }
  };

  /* ────── 테이블 컬럼 ───────────────────────────────────────────────── */
  const columns = [
    {
      title:  'No',
      key:    'no',
      width:  55,
      align:  'center' as const,
      render: (_: any, __: UserProfile, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: '사용자',
      key:   'user',
      render: (_: any, r: UserProfile) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
          <span>
            <Text strong style={{ fontSize: 13 }}>{r.display_name ?? r.name ?? r.username ?? '-'}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{r.email}</Text>
          </span>
        </Space>
      ),
    },
    {
      title:     '부서',
      dataIndex: 'department',
      key:       'department',
      width:     120,
      render:    (v: string | null) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title:     '직급',
      dataIndex: 'position_nm',
      key:       'position_nm',
      width:     100,
      render:    (v: string | null) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title:  'Role',
      key:    'roles',
      width:  180,
      render: (_: any, r: UserProfile) => {
        const active = (r.tb_user_role ?? []).filter((ur) => ur.use_yn === 'Y');
        if (active.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space size={2} wrap>
            {active.map((ur) =>
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
      title:     '가입일',
      dataIndex: 'created_at',
      key:       'created_at',
      width:     105,
      align:     'center' as const,
      render:    (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('YYYY-MM-DD')}</Text>,
    },
    {
      title:  '관리',
      key:    'action',
      width:  105,
      align:  'center' as const,
      render: (_: any, r: UserProfile) => (
        <Tooltip title="Role 관리">
          <Button
            size="small"
            icon={<ControlOutlined />}
            onClick={() => openRoleModal(r)}
          >
            Role 관리
          </Button>
        </Tooltip>
      ),
    },
  ];

  /* ────── Role 모달 내 컬럼 ─────────────────────────────────────────── */
  const roleColumns = [
    {
      title:  'Role',
      key:    'role',
      render: (_: any, r: UserRole) => (
        <Tag color={r.tb_role?.role_color ?? 'blue'}>{r.tb_role?.role_nm ?? r.role_id}</Tag>
      ),
    },
    { title: '시작일', dataIndex: 'start_dt', width: 105 },
    {
      title:  '만료일',
      dataIndex: 'end_dt',
      width:  115,
      render: (v: string | null) => v ?? '∞ 무기한',
    },
    {
      title:  '상태',
      key:    'status',
      width:  70,
      align:  'center' as const,
      render: (_: any, r: UserRole) => {
        const expired = r.end_dt && dayjs(r.end_dt).isBefore(dayjs(), 'day');
        return <Tag color={expired ? 'red' : 'green'}>{expired ? '만료' : '활성'}</Tag>;
      },
    },
    {
      title:  '회수',
      key:    'revoke',
      width:  75,
      align:  'center' as const,
      render: (_: any, r: UserRole) => (
        <Button size="small" danger icon={<StopOutlined />} onClick={() => handleRevoke(r)} />
      ),
    },
  ];

  /* ────── 렌더 ──────────────────────────────────────────────────────── */
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

      <Card
        size="small"
        title={
          <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Space>
              <Input
              placeholder="이름 / 이메일 / 부서 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 240 }}
              suffix={
                <SearchOutlined style={{ cursor: 'pointer' }} onClick={handleSearch} />
              }
              allowClear
              onClear={() => { setSearchInput(''); setSearch(''); setPage(1); }}
            />
            </Space>
            <Space>
              <DeleteSub1 allowFull />
            </Space>
          </Space>
        }
      >
        <style>{`
          .compact-user-table .ant-table-cell {
            padding: 3px 6px !important;
            line-height: 1.3 !important;
          }
          .compact-user-table .ant-table-thead .ant-table-cell {
            padding: 4px 6px !important;
            font-size: 11px !important;
          }
        `}</style>
        <div style={{ overflowX: 'scroll' }} className="compact-user-table">
          <Table<UserProfile>
            rowKey="id"
            columns={columns}
            dataSource={users}
            loading={usersLoading}
            size="small"
            bordered
            pagination={false}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={totalUsers}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
            showTotal={(t) => `총 ${t}명`}
            size="small"
            itemRender={(_, type, originalElement) => {
              if (type === 'prev') {
                const disabled = page <= 1;
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', columnGap: 8 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!disabled) setPage(1); }}
                      disabled={disabled}
                      className="ant-pagination-item-link"
                      aria-label="first-page"
                      title="첫 페이지"
                    >
                      <DoubleLeftOutlined />
                    </button>
                    {originalElement}
                  </span>
                );
              }
              if (type === 'next') {
                const disabled = page >= lastPage;
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', columnGap: 8 }}>
                    {originalElement}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!disabled) setPage(lastPage); }}
                      disabled={disabled}
                      className="ant-pagination-item-link"
                      aria-label="last-page"
                      title="마지막 페이지"
                    >
                      <DoubleRightOutlined />
                    </button>
                  </span>
                );
              }
              return originalElement;
            }}
          />
          <Select
            value={pageSize}
            onChange={(v) => { setPageSize(v); setPage(1); }}
            style={{ width: 95 }}
            size="small"
            options={[
              { value: 2,    label: '2개' },
              { value: 3,    label: '3개' },
              { value: 5,    label: '5개' },
              { value: 10,   label: '10개' },
              { value: 15,   label: '15개' },              
              { value: 20,   label: '20개' },              
              { value: 30,   label: '30개' },
              { value: 50,   label: '50개' },
              { value: 100,  label: '100개' },
              { value: 500,  label: '500개' },
              { value: 1000, label: '1000개' },
            ]}
          />
        </div>
      </Card>

      {/* ── Role 관리 모달 ─────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
            <span>
              {selectedUser?.display_name ?? selectedUser?.name ?? selectedUser?.username ?? selectedUser?.email ?? ''} 님의 Role 관리
            </span>
          </Space>
        }
        open={roleModalOpen}
        onCancel={() => { setRoleModalOpen(false); setGrantOpen(false); form.resetFields(); }}
        footer={null}
        width={600}
        destroyOnClose
      >
        {selectedUser && (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} />
              <span>
                <Text strong>{selectedUser.display_name ?? selectedUser.name ?? selectedUser.username ?? '-'}</Text>
                {'  '}
                <Text type="secondary" style={{ fontSize: 12 }}>{selectedUser.email}</Text>
                {selectedUser.department && <Tag style={{ marginLeft: 8 }}>{selectedUser.department}</Tag>}
                {selectedUser.position_nm && <Tag style={{ marginLeft: 4 }}>{selectedUser.position_nm}</Tag>}
              </span>
            </Space>
            <Divider style={{ margin: '8px 0 12px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>보유 Role</Text>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setGrantOpen(true)}
              >
                Role 부여
              </Button>
            </div>

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
        )}
      </Modal>

      {/* ── Role 부여 모달 ─────────────────────────────────────────────── */}
      <Modal
        title={`Role 부여 — ${selectedUser?.display_name ?? selectedUser?.name ?? selectedUser?.username ?? selectedUser?.email ?? ''}`}
        open={grantOpen}
        onOk={handleGrant}
        confirmLoading={grantRole.status === 'pending'}
        onCancel={() => { setGrantOpen(false); form.resetFields(); }}
        okText="부여"
        cancelText="취소"
        destroyOnClose
        width={420}
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