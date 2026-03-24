import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Space, Tag, Checkbox, Button, App, Spin,
} from 'antd';
import { SaveOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { useMenuTree } from '../../hooks/useMenuTree';
import { useMenuStore } from '../../stores/menuStore';
import { useRoles } from '../../hooks/useRoles';
import { useMenuRoles, useBatchMenuRoles } from '../../hooks/useMenuRoles';
import PageLayout from '../../components/layout/PageLayout';
import type { MenuTreeNode } from '../../types/menu';

const { Title } = Typography;

export default function MenuRolePage() {
  const { message }             = App.useApp();
  const { isLoading: mLoading } = useMenuTree();
  const menuTree                = useMenuStore((s) => s.menuTree);
  const { data: roles = [] }    = useRoles();
  const { data: menuRoles = [], isLoading: mrLoading } = useMenuRoles();
  const batchSave               = useBatchMenuRoles();

  // 로컬 상태: menuId → roleIds[]
  const [mappings, setMappings] = useState<Record<string, string[]>>({});
  const [initialized, setInitialized] = useState(false);

  // DB에서 불러온 매핑으로 초기화
  useEffect(() => {
    if (!mrLoading && menuRoles.length >= 0 && !initialized) {
      const init: Record<string, string[]> = {};
      (menuRoles as any[]).forEach((mr: any) => {
        if (!init[mr.menu_id]) init[mr.menu_id] = [];
        if (mr.read_yn === 'Y') init[mr.menu_id].push(mr.role_id);
      });
      setMappings(init);
      setInitialized(true);
    }
  }, [menuRoles, mrLoading, initialized]);

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

  // 단일 메뉴 저장
  const handleSave = async (menuId: string) => {
    await batchSave.mutateAsync({ menuId, roleIds: mappings[menuId] ?? [] });
    message.success('저장되었습니다.');
  };

  // 전체 일괄 저장
  const handleSaveAll = async () => {
    try {
      await Promise.all(
        allMenus.map((m) =>
          batchSave.mutateAsync({ menuId: m.menu_id, roleIds: mappings[m.menu_id] ?? [] })
        )
      );
      message.success(`전체 ${allMenus.length}개 메뉴 권한이 저장되었습니다.`);
    } catch {
      message.error('일부 저장에 실패했습니다.');
    }
  };

  const columns = [
    {
      title:     '메뉴',
      dataIndex: 'menu_nm',
      render: (nm: string, r: MenuTreeNode) => (
        <Space>
          {r.menu_depth === 2 && <span style={{ color: '#bbb', marginRight: 4 }}>└</span>}
          <span>{nm}</span>
          <Tag color={r.menu_depth === 1 ? 'blue' : 'green'}>{r.menu_depth === 1 ? 'GNB' : 'LNB'}</Tag>
        </Space>
      ),
    },
    {
      title:     'URL',
      dataIndex: 'menu_url',
      render:    (v: string) => <code style={{ fontSize: 11 }}>{v}</code>,
    },
    ...roles.map((role) => ({
      title:  <Tag color={role.role_color ?? 'blue'}>{role.role_cd}</Tag>,
      key:    role.role_id,
      width:  110,
      align:  'center' as const,
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
      align:  'center' as const,
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

  const isLoading = mLoading || mrLoading;

  return (
    <PageLayout
      breadcrumbs={[{ title: '홈', href: '/' }, { title: '관리' }, { title: '메뉴-Role 매핑' }]}
      parentMenuUrl="/admin"
    >
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', display: 'flex' }}>
        <Title level={4} style={{ margin: 0 }}>메뉴-Role 접근 권한 매핑</Title>
        <Button
          type="primary"
          icon={<CheckSquareOutlined />}
          onClick={handleSaveAll}
          loading={batchSave.isPending}
          disabled={isLoading}
        >
          전체 저장
        </Button>
      </Space>
      {isLoading ? (
        <Spin tip="권한 정보 불러오는 중..." style={{ display: 'block', textAlign: 'center', marginTop: 60 }} />
      ) : (
        <Table
          rowKey="menu_id"
          columns={columns}
          dataSource={allMenus}
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 900 }}
        />
      )}
    </PageLayout>
  );
}
