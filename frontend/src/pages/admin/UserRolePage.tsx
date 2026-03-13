import React, { useState } from 'react';
import {
  Typography, Table, Space, Tag, Button, Select, App, DatePicker,
  Form, Modal, Input,
} from 'antd';
import { PlusOutlined, StopOutlined } from '@ant-design/icons';
import { useUserRoles, useGrantRole, useRevokeRole } from '../../hooks/useUserRoles';
import { useRoles } from '../../hooks/useRoles';
import PageLayout from '../../components/layout/PageLayout';
import type { UserRole } from '../../types/role';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function UserRolePage() {
  const { message, modal } = App.useApp();
  const { data: allRoles = [] } = useRoles();
  const [targetUserId, setTargetUserId] = useState('');
  const [searchId,     setSearchId]     = useState('');
  const [grantOpen,    setGrantOpen]    = useState(false);
  const [form]                          = Form.useForm();

  const { data: userRoles = [], isLoading } = useUserRoles(targetUserId);
  const grantRole   = useGrantRole(targetUserId);
  const revokeRole  = useRevokeRole(targetUserId);

  const handleSearch = () => setTargetUserId(searchId.trim());

  const handleRevoke = (ur: UserRole) => {
    modal.confirm({
      title:   `"${ur.tb_role?.role_nm}" Role을 회수하시겠습니까?`,
      okType:  'danger',
      onOk:    async () => { await revokeRole.mutateAsync(ur.role_id); message.success('회수되었습니다.'); },
    });
  };

  const handleGrant = async () => {
    const values = await form.validateFields();
    await grantRole.mutateAsync({
      role_id:  values.role_id,
      start_dt: values.start_dt  ? values.start_dt.format('YYYY-MM-DD')  : undefined,
      end_dt:   values.end_dt    ? values.end_dt.format('YYYY-MM-DD')    : undefined,
    });
    message.success('Role이 부여되었습니다.');
    setGrantOpen(false);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Role',
      key:   'role',
      render: (_: any, r: UserRole) => (
        <Tag color={r.tb_role?.role_color ?? 'blue'}>{r.tb_role?.role_nm ?? r.role_id}</Tag>
      ),
    },
    { title: '시작일',  dataIndex: 'start_dt' },
    { title: '만료일',  dataIndex: 'end_dt', render: (v: string | null) => v ?? '∞ (무기한)' },
    {
      title: '상태',
      key:   'status',
      render: (_: any, r: UserRole) => {
        const expired = r.end_dt && dayjs(r.end_dt).isBefore(dayjs(), 'day');
        return <Tag color={expired ? 'red' : 'green'}>{expired ? '만료' : '활성'}</Tag>;
      },
    },
    {
      title: '회수',
      key:   'revoke',
      render: (_: any, r: UserRole) => (
        <Button size="small" danger icon={<StopOutlined />} onClick={() => handleRevoke(r)}>
          회수
        </Button>
      ),
    },
  ];

  return (
    <PageLayout
      breadcrumbs={[{ title: '홈', href: '/' }, { title: '관리' }, { title: '사용자-Role 관리' }]}
      parentMenuUrl="/admin"
    >
      <Title level={4} style={{ marginBottom: 16 }}>사용자-Role 관리</Title>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="사용자 UUID 입력"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          style={{ width: 320 }}
          onPressEnter={handleSearch}
        />
        <Button type="primary" onClick={handleSearch}>조회</Button>
      </Space>

      {targetUserId && (
        <>
          <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'flex-end' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setGrantOpen(true)}>
              Role 부여
            </Button>
          </Space>

          <Table
            rowKey="user_role_id"
            columns={columns}
            dataSource={userRoles}
            loading={isLoading}
            pagination={false}
            size="small"
            bordered
          />
        </>
      )}

      <Modal
        title="Role 부여"
        open={grantOpen}
        onOk={handleGrant}
        onCancel={() => setGrantOpen(false)}
        okText="부여"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Role" name="role_id" rules={[{ required: true }]}>
            <Select
              placeholder="Role 선택"
              options={allRoles.map((r) => ({ value: r.role_id, label: r.role_nm }))}
            />
          </Form.Item>
          <Form.Item label="시작일" name="start_dt">
            <DatePicker defaultValue={dayjs()} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="만료일" name="end_dt">
            <DatePicker placeholder="비워두면 무기한" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  );
}
