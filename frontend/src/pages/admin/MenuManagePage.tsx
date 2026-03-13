import React, { useState } from 'react';
import { Button, Table, Space, Tag, Tooltip, Typography, Switch, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useMenuTree, useDeleteMenu } from '../../hooks/useMenuTree';
import { useMenuStore } from '../../stores/menuStore';
import PageLayout from '../../components/layout/PageLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { MenuTreeNode } from '../../types/menu';

const { Title } = Typography;

export default function MenuManagePage() {
  const { message, modal } = App.useApp();
  const { isLoading }      = useMenuTree();
  const menuTree           = useMenuStore((s) => s.menuTree);
  const deleteMenu         = useDeleteMenu();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const handleDelete = (menuId: string, menuNm: string) => {
    modal.confirm({
      title:   `"${menuNm}" 메뉴를 삭제하시겠습니까?`,
      content: '하위 메뉴 및 Role 매핑이 함께 삭제됩니다.',
      okText:  '삭제',
      okType:  'danger',
      onOk: async () => {
        await deleteMenu.mutateAsync(menuId);
        message.success('메뉴가 삭제되었습니다.');
      },
    });
  };

  const columns = [
    {
      title:     '메뉴명',
      dataIndex: 'menu_nm',
      key:       'menu_nm',
      render: (text: string, record: MenuTreeNode) => (
        <Space>
          <span>{text}</span>
          <Tag color={record.menu_depth === 1 ? 'blue' : 'green'}>
            {record.menu_depth === 1 ? 'GNB' : 'LNB'}
          </Tag>
        </Space>
      ),
    },
    {
      title:     'URL',
      dataIndex: 'menu_url',
      key:       'menu_url',
      render: (url: string) => <code style={{ fontSize: 12 }}>{url}</code>,
    },
    {
      title:     '순서',
      dataIndex: 'menu_order',
      key:       'menu_order',
      width:     70,
      align:     'center' as const,
    },
    {
      title:  '사용',
      key:    'use_yn',
      width:  70,
      align:  'center' as const,
      render: (_: unknown, record: MenuTreeNode) => (
        <Switch checked={record.use_yn === 'Y'} size="small" disabled />
      ),
    },
    {
      title:  '관리',
      key:    'action',
      width:  100,
      render: (_: unknown, record: MenuTreeNode) => (
        <Space>
          <Tooltip title="수정">
            <Button size="small" icon={<EditOutlined />} />
          </Tooltip>
          <Tooltip title="삭제">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.menu_id, record.menu_nm)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <PageLayout
      breadcrumbs={[{ title: '홈', href: '/' }, { title: '관리' }, { title: '메뉴 관리' }]}
      parentMenuUrl="/admin"
    >
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} align="center">
        <Title level={4} style={{ margin: 0 }}>메뉴 관리</Title>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => window.location.href = '/admin/menu-upload'}>
            엑셀 업로드
          </Button>
          <Button type="primary" icon={<PlusOutlined />}>
            메뉴 추가
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="menu_id"
        columns={columns}
        dataSource={menuTree}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
          defaultExpandAllRows: true,
          childrenColumnName: 'children',
        }}
        pagination={false}
        size="small"
        bordered
      />
    </PageLayout>
  );
}
