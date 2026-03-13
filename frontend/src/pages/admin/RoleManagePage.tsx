import React, { useState } from 'react';
import {
  Button, Table, Space, Tag, Typography, Switch,
  Form, Input, InputNumber, ColorPicker, Modal, App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '../../hooks/useRoles';
import PageLayout from '../../components/layout/PageLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Role } from '../../types/role';

const { Title } = Typography;

export default function RoleManagePage() {
  const { message, modal } = App.useApp();
  const { data: roles = [], isLoading } = useRoles();
  const createRole  = useCreateRole();
  const deleteRole  = useDeleteRole();
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Role | null>(null);
  const [form]                  = Form.useForm();

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit   = (r: Role) => { setEditing(r); form.setFieldsValue(r); setOpen(true); };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) {
      // useUpdateRole needs roleId at hook creation - use mutateAsync directly via roleApi
      const { roleApi } = await import('../../api/roleApi');
      await roleApi.update(editing.role_id, values);
      message.success('Role이 수정되었습니다.');
    } else {
      await createRole.mutateAsync(values);
      message.success('Role이 생성되었습니다.');
    }
    setOpen(false);
  };

  const handleDelete = (r: Role) => {
    if (r.is_system) { message.warning('시스템 Role은 삭제할 수 없습니다.'); return; }
    modal.confirm({
      title:  `"${r.role_nm}" Role을 삭제하시겠습니까?`,
      okType: 'danger',
      onOk:   async () => { await deleteRole.mutateAsync(r.role_id); message.success('삭제되었습니다.'); },
    });
  };

  const columns = [
    {
      title: 'Role 코드',
      dataIndex: 'role_cd',
      render: (cd: string, r: Role) => <Tag color={r.role_color ?? 'blue'}>{cd}</Tag>,
    },
    { title: 'Role 명',   dataIndex: 'role_nm' },
    { title: '설명',      dataIndex: 'role_desc' },
    { title: '순서',      dataIndex: 'sort_order', width: 70, align: 'center' as const },
    {
      title: '사용',
      key:   'use_yn',
      width: 70,
      align: 'center' as const,
      render: (_: any, r: Role) => <Switch checked={r.use_yn === 'Y'} size="small" disabled />,
    },
    {
      title: '관리',
      key:   'action',
      width: 100,
      render: (_: any, r: Role) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} disabled={r.is_system} onClick={() => handleDelete(r)} />
        </Space>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <PageLayout
      breadcrumbs={[{ title: '홈', href: '/' }, { title: '관리' }, { title: 'Role 관리' }]}
      parentMenuUrl="/admin"
    >
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} align="center">
        <Title level={4} style={{ margin: 0 }}>Role 관리</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Role 추가</Button>
      </Space>

      <Table rowKey="role_id" columns={columns} dataSource={roles} pagination={false} size="small" bordered />

      <Modal
        title={editing ? 'Role 수정' : 'Role 추가'}
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        okText="저장"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!editing && (
            <Form.Item
              label="Role 코드" name="role_cd"
              rules={[
                { required: true, message: 'Role 코드를 입력하세요.' },
                { pattern: /^[A-Z_]+$/, message: '대문자와 _ 만 허용합니다.' },
              ]}
            >
              <Input placeholder="예: APPROVER" />
            </Form.Item>
          )}
          <Form.Item label="Role 명" name="role_nm" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="설명" name="role_desc">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="순서" name="sort_order">
            <InputNumber min={1} max={999} />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  );
}
