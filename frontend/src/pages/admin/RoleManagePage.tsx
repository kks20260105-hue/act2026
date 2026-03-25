import React, { useState, useMemo } from 'react';
import {
  Button, Table, Space, Tag, Tooltip, Typography, Switch, App,
  Modal, Form, Input, InputNumber, Select, Card, Pagination,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
} from '@ant-design/icons';
import { useRoles, useCreateRole, useDeleteRole, ROLE_KEYS } from '../../hooks/useRoles';
import { roleApi } from '../../api/roleApi';
import { useQueryClient } from '@tanstack/react-query';
import PageLayout from '../../components/layout/PageLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Role } from '../../types/role';

const { Title, Text } = Typography;

/** Tag 색상 옵션 */
const COLOR_OPTIONS = [
  { value: 'red',        label: 'Red' },
  { value: 'volcano',    label: 'Volcano' },
  { value: 'orange',     label: 'Orange' },
  { value: 'gold',       label: 'Gold' },
  { value: 'yellow',     label: 'Yellow' },
  { value: 'lime',       label: 'Lime' },
  { value: 'green',      label: 'Green' },
  { value: 'cyan',       label: 'Cyan' },
  { value: 'blue',       label: 'Blue' },
  { value: 'geekblue',   label: 'Geekblue' },
  { value: 'purple',     label: 'Purple' },
  { value: 'magenta',    label: 'Magenta' },
];

export default function RoleManagePage() {
  const { message, modal } = App.useApp();
  const qc                  = useQueryClient();
  const { data: roles = [], isLoading } = useRoles();
  const createRole  = useCreateRole();
  const deleteRole  = useDeleteRole();

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing,   setEditing]     = useState<Role | null>(null);
  const [saving,    setSaving]      = useState(false);
  const [form]                      = Form.useForm();

  // use_yn 토글
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 검색 / 필터 / 페이징
  const [searchText,   setSearchText]   = useState('');
  const [filterUseYn,  setFilterUseYn]  = useState<'' | 'Y' | 'N'>('');
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(10);

  // ── 필터 적용 ─────────────────────────────────────────────────────
  const filteredRoles = useMemo<Role[]>(() => {
    let list = [...roles];
    if (filterUseYn) list = list.filter((r) => r.use_yn === filterUseYn);
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.role_cd.toLowerCase().includes(kw) ||
          r.role_nm.toLowerCase().includes(kw) ||
          (r.role_desc ?? '').toLowerCase().includes(kw),
      );
    }
    return list;
  }, [roles, filterUseYn, searchText]);

  // ── 모달 ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ sort_order: 50, use_yn: 'Y', role_color: 'blue' });
    setModalOpen(true);
  };

  const openEdit = (r: Role) => {
    setEditing(r);
    form.setFieldsValue({
      role_cd:    r.role_cd,
      role_nm:    r.role_nm,
      role_desc:  r.role_desc,
      sort_order: r.sort_order,
      use_yn:     r.use_yn,
      role_color: r.role_color ?? 'blue',
    });
    setModalOpen(true);
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await roleApi.update(editing.role_id, values);
        message.success('Role이 수정되었습니다.');
      } else {
        await createRole.mutateAsync(values);
        message.success('Role이 생성되었습니다.');
      }
      await qc.invalidateQueries({ queryKey: ROLE_KEYS.all });
      setModalOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r: Role) => {
    if (r.is_system) { message.warning('시스템 Role은 삭제할 수 없습니다.'); return; }
    modal.confirm({
      title:   `"${r.role_nm}" Role을 삭제하시겠습니까?`,
      content: '연결된 사용자 및 메뉴 매핑이 함께 삭제됩니다.',
      okText:  '삭제',
      okType:  'danger',
      onOk: async () => {
        await deleteRole.mutateAsync(r.role_id);
        message.success('삭제되었습니다.');
      },
    });
  };

  // ── use_yn 토글 ──────────────────────────────────────────────────
  const handleToggleUseYn = async (r: Role, checked: boolean) => {
    setTogglingId(r.role_id);
    try {
      await roleApi.update(r.role_id, { use_yn: checked ? 'Y' : 'N' });
      await qc.invalidateQueries({ queryKey: ROLE_KEYS.all });
      message.success(`"${r.role_nm}" 사용 여부가 ${checked ? 'ON' : 'OFF'}으로 변경되었습니다.`);
    } catch {
      message.error('사용 여부 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  // ── 컬럼 정의 ────────────────────────────────────────────────────
  const columns = [
    {
      title:  'No',
      key:    'no',
      width:  55,
      align:  'center' as const,
      render: (_: any, __: Role, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title:  'Role 코드',
      key:    'role_cd',
      render: (_: any, r: Role) => (
        <Tooltip title="수정">
          <Tag
            color={r.role_color ?? 'blue'}
            style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            onClick={() => openEdit(r)}
            className="clickable-text"
          >
            {r.role_cd}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title:  'Role 명',
      key:    'role_nm',
      render: (_: any, r: Role) => (
        <Tooltip title="수정">
          <Text
            strong
            style={{ fontSize: 13, cursor: 'pointer' }}
            onClick={() => openEdit(r)}
            className="clickable-text"
          >
            {r.role_nm}
          </Text>
        </Tooltip>
      ),
    },
    {
      title:     '설명',
      key:       'role_desc',
      render:    (_: any, r: Role) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{r.role_desc ?? '-'}</Text>
      ),
    },
    {
      title:     '순서',
      dataIndex: 'sort_order',
      key:       'sort_order',
      width:     60,
      align:     'center' as const,
    },
    {
      title:  '시스템',
      key:    'is_system',
      width:  70,
      align:  'center' as const,
      render: (_: any, r: Role) =>
        r.is_system ? (
          <Tag color="red" style={{ fontSize: 11 }}>시스템</Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>-</Text>
        ),
    },
    {
      title:  '사용',
      key:    'use_yn',
      width:  70,
      align:  'center' as const,
      render: (_: any, r: Role) => (
        <Tooltip title={r.use_yn === 'Y' ? 'ON → OFF' : 'OFF → ON'}>
          <Switch
            checked={r.use_yn === 'Y'}
            size="small"
            loading={togglingId === r.role_id}
            disabled={r.is_system}
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
      render: (_: any, r: Role) => (
        <Space>
          <Tooltip title="수정">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={r.is_system ? '시스템 Role은 삭제 불가' : '삭제'}>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={r.is_system}
              onClick={() => handleDelete(r)}
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
        { title: 'Role 관리' },
      ]}
      parentMenuUrl="/admin"
    >
      <Title level={4} style={{ marginBottom: 16 }}>Role 관리</Title>

      <Card
        size="small"
        title={
          <Space wrap>
            <Select
              value={filterUseYn}
              onChange={(v) => { setFilterUseYn(v as '' | 'Y' | 'N'); setPage(1); }}
              style={{ width: 100 }}
              options={[
                { value: '',  label: '전체' },
                { value: 'Y', label: '사용' },
                { value: 'N', label: '미사용' },
              ]}
            />
            <Input
              placeholder="Role 코드 / 명 / 설명 검색"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
              style={{ width: 240 }}
              suffix={<SearchOutlined />}
              allowClear
            />
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Role 추가
          </Button>
        }
      >
        <style>{`
          .compact-role-table .ant-table-cell {
            padding: 3px 6px !important;
            line-height: 1.3 !important;
          }
          .compact-role-table .ant-table-thead .ant-table-cell {
            padding: 4px 6px !important;
            font-size: 11px !important;
          }
        `}</style>
        <div style={{ overflowX: 'scroll' }} className="compact-role-table">
          <Table<Role>
            rowKey="role_id"
            columns={columns}
            dataSource={filteredRoles.slice((page - 1) * pageSize, page * pageSize)}
            pagination={false}
            size="small"
            bordered
          />
        </div>

        {/* 커스텀 페이지네이션 */}
        <div
          style={{
            display:        'flex',
            justifyContent: 'center',
            alignItems:     'center',
            gap:            8,
            marginTop:      16,
          }}
        >
          <Pagination
            current={page}
            pageSize={pageSize}
            total={filteredRoles.length}
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
                const lastPage = Math.ceil(filteredRoles.length / pageSize) || 1;
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

      {/* Role 추가 / 수정 모달 */}
      <Modal
        title={editing ? 'Role 수정' : 'Role 추가'}
        open={modalOpen}
        onOk={handleOk}
        onCancel={() => setModalOpen(false)}
        okText={editing ? '수정' : '추가'}
        cancelText="취소"
        confirmLoading={saving}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!editing && (
            <Form.Item
              name="role_cd"
              label="Role 코드"
              rules={[
                { required: true, message: 'Role 코드를 입력하세요.' },
                { pattern: /^[A-Z_]+$/, message: '대문자와 _ 만 허용합니다.' },
              ]}
            >
              <Input placeholder="예) APPROVER" maxLength={30} />
            </Form.Item>
          )}

          <Form.Item
            name="role_nm"
            label="Role 명"
            rules={[{ required: true, message: 'Role 명을 입력하세요.' }]}
          >
            <Input placeholder="예) 결재자" maxLength={50} />
          </Form.Item>

          <Form.Item name="role_desc" label="설명">
            <Input.TextArea rows={2} placeholder="Role에 대한 설명" maxLength={200} />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="sort_order" label="정렬 순서" style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={999} style={{ width: 100 }} />
            </Form.Item>

            <Form.Item name="role_color" label="Tag 색상" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 140 }}
                options={COLOR_OPTIONS.map((c) => ({
                  value: c.value,
                  label: <Tag color={c.value}>{c.label}</Tag>,
                }))}
              />
            </Form.Item>
          </Space>

          {editing && (
            <Form.Item name="use_yn" label="사용 여부" style={{ marginTop: 16 }}>
              <Select
                options={[
                  { value: 'Y', label: '사용' },
                  { value: 'N', label: '미사용' },
                ]}
                style={{ width: 120 }}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </PageLayout>
  );
}
