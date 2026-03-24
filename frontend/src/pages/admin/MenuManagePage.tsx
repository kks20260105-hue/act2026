import React, { useState, useMemo } from 'react';
import {
  Button, Table, Space, Tag, Tooltip, Typography, Switch, App,
  Modal, Form, Input, InputNumber, Select, Radio, Card, Pagination,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMenuTree, useCreateMenu, useDeleteMenu } from '../../hooks/useMenuTree';
import { menuApi } from '../../api/menuApi';
import { useMenuStore } from '../../stores/menuStore';
import { useQueryClient } from '@tanstack/react-query';
import { MENU_KEYS } from '../../hooks/useMenuTree';
import PageLayout from '../../components/layout/PageLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Menu, MenuFormValues } from '../../types/menu';

const { Title, Text } = Typography;

export default function MenuManagePage() {
  const { message, modal } = App.useApp();
  const navigate           = useNavigate();
  const { isLoading }      = useMenuTree();
  const allMenus           = useMenuStore((s) => s.menus);
  const createMenu         = useCreateMenu();
  const deleteMenu         = useDeleteMenu();
  const qc                 = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Menu | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form]                    = Form.useForm<MenuFormValues>();
  const watchDepth                = Form.useWatch('menu_depth', form);

  // use_yn 토글 (Switch 직접 클릭)
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleUseYn = async (record: Menu, checked: boolean) => {
    setTogglingId(record.menu_id);
    try {
      await menuApi.update(record.menu_id, { use_yn: checked ? 'Y' : 'N' });
      await qc.invalidateQueries({ queryKey: MENU_KEYS.all });
      message.success(`"${record.menu_nm}" 사용 여부가 ${checked ? 'ON' : 'OFF'}으로 변경되었습니다.`);
    } catch {
      message.error('사용 여부 변경에 실패하였습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  // 검색 / 필터
  const [searchText, setSearchText]   = useState('');
  const [filterDepth, setFilterDepth] = useState<'' | '1' | '2'>('');
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  const gnbMenus = useMemo(() => allMenus.filter((m) => m.menu_depth === 1), [allMenus]);

  const filteredMenus = useMemo(() => {
    let list = [...allMenus];
    if (filterDepth === '1') list = list.filter((m) => m.menu_depth === 1);
    if (filterDepth === '2') list = list.filter((m) => m.menu_depth === 2);
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase();
      list = list.filter(
        (m) => m.menu_nm.toLowerCase().includes(kw) || m.menu_url.toLowerCase().includes(kw),
      );
    }
    return list;
  }, [allMenus, filterDepth, searchText]);

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = allMenus.find((m) => m.menu_id === parentId);
    return parent ? parent.menu_nm : '-';
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ menu_depth: 1, menu_order: 1, use_yn: 'Y' });
    setModalOpen(true);
  };

  const openEdit = (record: Menu) => {
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
      title:  'No',
      key:    'no',
      width:  55,
      align:  'center' as const,
      render: (_: any, __: Menu, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: '메뉴명',
      key:   'menu_nm',
      render: (_: any, r: Menu) => (
        <Tooltip title="수정">
          <Space
            style={{ cursor: 'pointer' }}
            onClick={() => openEdit(r)}
            className="clickable-cell"
          >
            <Text
              strong
              style={{ fontSize: 13 }}
              className="clickable-text"
            >
              {r.menu_nm}
            </Text>
            <Tag color={r.menu_depth === 1 ? 'blue' : 'green'} style={{ fontSize: 11 }}>
              {r.menu_depth === 1 ? 'GNB' : 'LNB'}
            </Tag>
          </Space>
        </Tooltip>
      ),
    },
    {
      title:  '상위 메뉴',
      key:    'parent',
      width:  130,
      render: (_: any, r: Menu) =>
        r.menu_depth === 2 ? (
          <Tooltip title="수정">
            <Text
              type="secondary"
              style={{ fontSize: 12, cursor: 'pointer' }}
              className="clickable-text"
              onClick={() => openEdit(r)}
            >
              {'\u2514 '}{getParentName(r.parent_menu_id)}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title:     'URL',
      dataIndex: 'menu_url',
      key:       'menu_url',
      render:    (url: string, r: Menu) => (
        <Tooltip title="수정">
          <code
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={() => openEdit(r)}
            className="clickable-text"
          >
            {url}
          </code>
        </Tooltip>
      ),
    },
    {
      title:     '순서',
      dataIndex: 'menu_order',
      key:       'menu_order',
      width:     60,
      align:     'center' as const,
    },
    {
      title:  '사용',
      key:    'use_yn',
      width:  70,
      align:  'center' as const,
      render: (_: any, r: Menu) => (
        <Tooltip title={r.use_yn === 'Y' ? 'ON → OFF' : 'OFF → ON'}>
          <Switch
            checked={r.use_yn === 'Y'}
            size="small"
            loading={togglingId === r.menu_id}
            onChange={(checked) => handleToggleUseYn(r, checked)}
          />
        </Tooltip>
      ),
    },
    {
      title:  '관리',
      key:    'action',
      width:  100,
      align:  'center' as const,
      render: (_: any, r: Menu) => (
        <Space>
          <Tooltip title="수정">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="삭제">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(r.menu_id, r.menu_nm)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <PageLayout
      breadcrumbs={[
        { title: '홈', href: '/' },
        { title: '관리' },
        { title: '메뉴 관리' },
      ]}
      parentMenuUrl="/admin"
    >
      <Title level={4} style={{ marginBottom: 16 }}>메뉴 관리</Title>

      <Card
        size="small"
        title={
          <Space>
            <Select
              value={filterDepth}
              onChange={(v) => { setFilterDepth(v as '' | '1' | '2'); setPage(1); }}
              style={{ width: 110 }}
              options={[
                { value: '', label: '전체' },
                { value: '1', label: 'GNB만' },
                { value: '2', label: 'LNB만' },
              ]}
            />
            <Input
              placeholder="메뉴명 / URL 검색"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
              style={{ width: 220 }}
              suffix={<SearchOutlined />}
              allowClear
            />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => navigate('/admin/menu-upload')}>
              엑셀 업로드
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              메뉴 추가
            </Button>
          </Space>
        }
      >
        <Table<Menu>
          rowKey="menu_id"
          columns={columns}
          dataSource={filteredMenus.slice((page - 1) * pageSize, page * pageSize)}
          pagination={false}
          size="small"
          bordered
        />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={filteredMenus.length}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
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
                const lastPage = Math.ceil(filteredMenus.length / pageSize) || 1;
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
