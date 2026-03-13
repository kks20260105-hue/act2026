import React, { useState } from 'react';
import {
  Typography, Table, Space, Tag, Checkbox, Button, Select, App,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useMenuTree } from '../../hooks/useMenuTree';
import { useMenuStore } from '../../stores/menuStore';
import { useRoles } from '../../hooks/useRoles';
import { useBatchMenuRoles } from '../../hooks/useMenuRoles';
import PageLayout from '../../components/layout/PageLayout';
import type { MenuTreeNode } from '../../types/menu';

const { Title } = Typography;

export default function MenuRolePage() {
  const { message }           = App.useApp();
  const { isLoading: mLoading } = useMenuTree();
  const menuTree              = useMenuStore((s) => s.menuTree);
  const { data: roles = [] }  = useRoles();
  const batchSave             = useBatchMenuRoles();

  // 로컬 상태: menuId → roleIds 세트
  const [mappings, setMappings] = useState<Record<string, string[]>>({});

  const flat = (nodes: MenuTreeNode[]): MenuTreeNode[] =>
    nodes.flatMap((n) => [n, ...flat(n.children)]);

  const allMenus = flat(menuTree);

  const toggle = (menuId: string, roleId: string, checked: boolean) => {
    setMappings((prev) => {
      const curr = prev[menuId] ?? [];
      return {
        ...prev,
        [menuId]: checked ? [...curr, roleId] : curr.filter((r) => r !== roleId),
      };
    });
  };

  const handleSave = async (menuId: string) => {
    await batchSave.mutateAsync({ menuId, roleIds: mappings[menuId] ?? [] });
    message.success('저장되었습니다.');
  };

  const columns = [
    {
      title:     '메뉴',
      dataIndex: 'menu_nm',
      render: (nm: string, r: MenuTreeNode) => (
        <Space>
          <span>{nm}</span>
          <Tag color={r.menu_depth === 1 ? 'blue' : 'green'}>{r.menu_depth === 1 ? 'GNB' : 'LNB'}</Tag>
        </Space>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'menu_url',
      render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code>,
    },
    ...roles.map((role) => ({
      title:     <Tag color={role.role_color ?? 'blue'}>{role.role_cd}</Tag>,
      key:       role.role_id,
      width:     90,
      align:     'center' as const,
      render: (_: any, record: MenuTreeNode) => {
        const checked = (mappings[record.menu_id] ?? []).includes(role.role_id);
        return (
          <Checkbox
            checked={checked}
            onChange={(e) => toggle(record.menu_id, role.role_id, e.target.checked)}
          />
        );
      },
    })),
    {
      title:  '저장',
      key:    'save',
      width:  70,
      render: (_: any, record: MenuTreeNode) => (
        <Button
          size="small"
          icon={<SaveOutlined />}
          onClick={() => handleSave(record.menu_id)}
          loading={batchSave.isPending}
        />
      ),
    },
  ];

  return (
    <PageLayout
      breadcrumbs={[{ title: '홈', href: '/' }, { title: '관리' }, { title: '메뉴-Role 매핑' }]}
      parentMenuUrl="/admin"
    >
      <Title level={4} style={{ marginBottom: 16 }}>메뉴-Role 접근 권한 매핑</Title>
      <Table
        rowKey="menu_id"
        columns={columns}
        dataSource={allMenus}
        pagination={false}
        size="small"
        bordered
        loading={mLoading}
        scroll={{ x: 900 }}
      />
    </PageLayout>
  );
}
