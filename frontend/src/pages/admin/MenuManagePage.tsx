import React, { useState } from 'react';
import {
  Button, Table, Space, Tag, Tooltip, Typography, Switch, App,
  Modal, Form, Input, InputNumber, Select, Radio,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMenuTree, useCreateMenu, useDeleteMenu } from '../../hooks/useMenuTree';
import { menuApi } from '../../api/menuApi';
import { useMenuStore } from '../../stores/menuStore';
import { useQueryClient } from '@tanstack/react-query';
import { MENU_KEYS } from '../../hooks/useMenuTree';
import PageLayout from '../../components/layout/PageLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { MenuTreeNode } from '../../types/menu';
import type { MenuFormValues } from '../../types/menu';

const { Title } = Typography;

export default function MenuManagePage() {
  const { message, modal } = App.useApp();
  const navigate           = useNavigate();
  const { isLoading }      = useMenuTree();
  const menuTree           = useMenuStore((s) => s.menuTree);
  const allMenus           = useMenuStore((s) => s.menus);
  const createMenu         = useCreateMenu();
  const deleteMenu         = useDeleteMenu();
  const qc                 = useQueryClient();

  const [expandedKeys, setExpandedKeys]   = useState<string[]>([]);
  const [modalOpen, setModalOpen]         = useState(false);
  const [editing, setEditing]             = useState<MenuTreeNode | null>(null);
  const [saving, setSaving]               = useState(false);
  const [form]                            = Form.useForm<MenuFormValues>();
  const watchDepth                        = Form.useWatch('menu_depth', form);

  const gnbMenus = allMenus.filter((m) => m.menu_depth === 1);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ menu_depth: 1, menu_order: 1, use_yn: 'Y' });
    setModalOpen(true);
  };

  const openEdit = (record: MenuTreeNode) => {
    setEditing(record);
    form.setFieldsValue({
      menu_nm:        record.menu_nm,
      menu_url:       record.menu_url,
      parent_menu_id: record.parent_menu_id ?? undefined,
      menu_depth:     record.menu_depth,
      menu_order:     record.menu_order,
      icon_class:     record.icon_class ?? undefined,
      use_yn:         record.use_yn,
    });
    setModalOpen(true);
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await menuApi.update(editing.menu_id, values);
        message.success('메뉴가 수정되었습니다.');
      } else {
        await createMenu.mutateAsync(values);
        message.success('메뉴가 추가되었습니다.');
      }
      await qc.invalidateQueries({ queryKey: MENU_KEYS.all });
      setModalOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

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
      render:    (url: string) => <code style={{ fontSize: 12 }}>{url}</code>,
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
      width:  110,
      render: (_: unknown, record: MenuTreeNode) => (
        <Space>
          <Tooltip title="수정">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
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
          <Button icon={<UploadOutlined />} onClick={() => navigate('/admin/menu-upload')}>
            엑셀 업로드
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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

      {/* 메뉴 추가 / 수정 모달 */}
      <Modal
        title={editing ? '메뉴 수정' : '메뉴 추가'}
        open={modalOpen}
        onOk={handleOk}
        onCancel={() => setModalOpen(false)}
        okText={editing ? '수정' : '추가'}
        cancelText="취소"
        confirmLoading={saving}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>

          <Form.Item name="menu_depth" label="메뉴 구분" rules={[{ required: true }]}>
            <Radio.Group
              onChange={() => form.setFieldValue('parent_menu_id', undefined)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value={1}>GNB (상단 메뉴)</Radio.Button>
              <Radio.Button value={2}>LNB (좌측 메뉴)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {watchDepth === 2 && (
            <Form.Item
              name="parent_menu_id"
              label="상위 GNB 메뉴"
              rules={[{ required: true, message: '상위 GNB 메뉴를 선택하세요.' }]}
            >
              <Select placeholder="상위 GNB 메뉴 선택" allowClear>
                {gnbMenus.map((g) => (
                  <Select.Option key={g.menu_id} value={g.menu_id}>
                    {g.menu_nm} ({g.menu_url})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="menu_nm"
            label="메뉴명"
            rules={[{ required: true, message: '메뉴명을 입력하세요.' }]}
          >
            <Input placeholder="예) 메뉴 관리" maxLength={50} />
          </Form.Item>

          <Form.Item
            name="menu_url"
            label="메뉴 URL"
            rules={[
              { required: true, message: 'URL을 입력하세요.' },
              { pattern: /^\//, message: '/ 로 시작해야 합니다.' },
            ]}
          >
            <Input placeholder="예) /admin/menus" maxLength={100} />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="menu_order"
              label="정렬 순서"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <InputNumber min={1} max={999} style={{ width: 100 }} />
            </Form.Item>

            <Form.Item name="icon_class" label="아이콘 클래스" style={{ marginBottom: 0, flex: 1 }}>
              <Input placeholder="예) setting (Ant Icons 이름)" />
            </Form.Item>
          </Space>

          <Form.Item name="use_yn" label="사용 여부" style={{ marginTop: 16 }} rules={[{ required: true }]}>
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio.Button value="Y">사용</Radio.Button>
              <Radio.Button value="N">미사용</Radio.Button>
            </Radio.Group>
          </Form.Item>

        </Form>
      </Modal>
    </PageLayout>
  );
}
