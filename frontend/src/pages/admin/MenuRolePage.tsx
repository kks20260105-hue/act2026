import React, { useState, useEffect, useMemo } from 'react';
import {
  Button, Table, Space, Tag, Tooltip, Typography, App, Switch,
  Modal, Form, Select, Card, Pagination, Input,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckSquareOutlined,
  SearchOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMenuTree, MENU_KEYS } from '../../hooks/useMenuTree';
import { useMenuStore } from '../../stores/menuStore';
import { useRoles } from '../../hooks/useRoles';
import { useMenuRoles, useBatchMenuRoles } from '../../hooks/useMenuRoles';
import { menuApi } from '../../api/menuApi';
import PageLayout from '../../components/layout/PageLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Menu } from '../../types/menu';
import type { Role } from '../../types/role';

const { Title, Text } = Typography;

/** 플랫 리스트 한 행의 타입 */
interface MappingRow {
  key:   string;  // `${menuId}-${roleId}`
  menu:  Menu;
  role:  Role;
}

export default function MenuRolePage() {
  const { message, modal }              = App.useApp();
  const qc                               = useQueryClient();
  const { isLoading: mLoading }         = useMenuTree();
  const allMenus: Menu[]                  = useMenuStore((s) => s.menus ?? []);
  const { data: roles = [], isLoading: rLoading }       = useRoles();
  const { data: menuRoles = [], isLoading: mrLoading }  = useMenuRoles();
  const batchSave                        = useBatchMenuRoles();

  // ── 메뉴 사용여부 토글 → DB 자동 저장 ──────────────────────────────
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const handleToggleUseYn = async (menu: Menu, checked: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(menu.menu_id));
    try {
      await menuApi.update(menu.menu_id, { use_yn: checked ? 'Y' : 'N' });
      await qc.invalidateQueries({ queryKey: MENU_KEYS.all });
      message.success(`'${menu.menu_nm}' 사용 여부가 ${checked ? 'ON' : 'OFF'}으로 변경되었습니다.`);
    } catch {
      message.error('사용 여부 변경에 실패했습니다.');
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(menu.menu_id); return s; });
    }
  };

  // ── 로컬 매핑 상태 : menuId → roleId[] ────────────────────────────
  const [mappings,     setMappings]     = useState<Record<string, string[]>>({});
  const [initialized,  setInitialized]  = useState(false);

  useEffect(() => {
    if (!mrLoading && !initialized) {
      const init: Record<string, string[]> = {};
      (menuRoles as any[]).forEach((mr: any) => {
        if (!init[mr.menu_id]) init[mr.menu_id] = [];
        if (mr.read_yn === 'Y') init[mr.menu_id].push(mr.role_id);
      });
      setMappings(init);
      setInitialized(true);
    }
  }, [menuRoles, mrLoading, initialized]);

  // ── 모달 ────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form]                    = Form.useForm<{ menu_id: string; role_ids: string[] }>();

  // ── 검색 / 필터 / 페이징 ─────────────────────────────────────────
  const [searchText,  setSearchText]  = useState('');
  const [filterDepth, setFilterDepth] = useState<'' | '1' | '2'>('');
  const [filterRole,  setFilterRole]  = useState<string>('');
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(10);

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = allMenus.find((m) => m.menu_id === parentId);
    return parent ? parent.menu_nm : '-';
  };

  // ── 플랫 행 생성 ────────────────────────────────────────────────────
  const flatRows = useMemo<MappingRow[]>(() => {
    const rows: MappingRow[] = [];
    Object.entries(mappings).forEach(([menuId, roleIds]) => {
      const menu = allMenus.find((m) => m.menu_id === menuId);
      if (!menu) return;
      roleIds.forEach((roleId) => {
        const role = roles.find((r) => r.role_id === roleId);
        if (!role) return;
        rows.push({ key: `${menuId}-${roleId}`, menu, role });
      });
    });
    // GNB 먼저 → menu_order → role sort_order
    rows.sort((a, b) => {
      if (a.menu.menu_depth !== b.menu.menu_depth) return a.menu.menu_depth - b.menu.menu_depth;
      if (a.menu.menu_order !== b.menu.menu_order) return a.menu.menu_order - b.menu.menu_order;
      return a.role.sort_order - b.role.sort_order;
    });
    return rows;
  }, [mappings, allMenus, roles]);

  // ── 필터 적용 ────────────────────────────────────────────────────────
  const filteredRows = useMemo<MappingRow[]>(() => {
    let list = [...flatRows];
    if (filterDepth === '1') list = list.filter((r) => r.menu.menu_depth === 1);
    if (filterDepth === '2') list = list.filter((r) => r.menu.menu_depth === 2);
    if (filterRole)          list = list.filter((r) => r.role.role_id === filterRole);
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.menu.menu_nm.toLowerCase().includes(kw) ||
          r.menu.menu_url.toLowerCase().includes(kw) ||
          r.role.role_cd.toLowerCase().includes(kw) ||
          r.role.role_nm.toLowerCase().includes(kw),
      );
    }
    return list;
  }, [flatRows, filterDepth, filterRole, searchText]);

  // ── 행 삭제 ─────────────────────────────────────────────────────────
  const handleDelete = (row: MappingRow) => {
    modal.confirm({
      title:   `"${row.menu.menu_nm}" 에서 [${row.role.role_cd}] 권한을 삭제하시겠습니까?`,
      okText:  '삭제',
      okType:  'danger',
      onOk: async () => {
        const newRoleIds = (mappings[row.menu.menu_id] ?? []).filter((id) => id !== row.role.role_id);
        setMappings((prev) => ({ ...prev, [row.menu.menu_id]: newRoleIds }));
        try {
          await batchSave.mutateAsync({ menuId: row.menu.menu_id, roleIds: newRoleIds });
          message.success('삭제되었습니다.');
        } catch {
          // 실패 시 원래 상태로 복구
          setMappings((prev) => ({
            ...prev,
            [row.menu.menu_id]: [...(prev[row.menu.menu_id] ?? []), row.role.role_id],
          }));
          message.error('삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  // ── 전체 저장 ────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    try {
      const menuIds = [...new Set(flatRows.map((r) => r.menu.menu_id))];
      await Promise.all(
        menuIds.map((menuId) =>
          batchSave.mutateAsync({ menuId, roleIds: mappings[menuId] ?? [] }),
        ),
      );
      message.success(`${menuIds.length}개 메뉴 권한이 저장되었습니다.`);
    } catch {
      message.error('일부 저장에 실패했습니다.');
    }
  };

  // ── 매핑 추가 모달 ───────────────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const prev = mappings[values.menu_id] ?? [];
      const newIds = values.role_ids.filter((id) => !prev.includes(id));
      if (newIds.length === 0) {
        message.warning('이미 등록된 Role입니다.');
        setSaving(false);
        return;
      }
      const next = [...prev, ...newIds];
      setMappings((s) => ({ ...s, [values.menu_id]: next }));
      await batchSave.mutateAsync({ menuId: values.menu_id, roleIds: next });
      message.success('매핑이 추가되었습니다.');
      setModalOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 모달에서 이미 매핑된 role 제외
  const getAvailableRoles = (menuId: string) => {
    const existing = mappings[menuId] ?? [];
    return roles.filter((r) => !existing.includes(r.role_id));
  };

  const watchMenuId = Form.useWatch('menu_id', form);

  // ── 수정 모달 ────────────────────────────────────────────────────────
  const [editOpen,    setEditOpen]    = useState(false);
  const [editRow,     setEditRow]     = useState<MappingRow | null>(null);
  const [editSaving,  setEditSaving]  = useState(false);
  const [editForm]                    = Form.useForm<{ menu_id: string; role_id: string }>();
  const watchEditMenuId               = Form.useWatch('menu_id', editForm);

  const openEdit = (row: MappingRow) => {
    setEditRow(row);
    editForm.setFieldsValue({ menu_id: row.menu.menu_id, role_id: row.role.role_id });
    setEditOpen(true);
  };

  const handleEditOk = async () => {
    const values = await editForm.validateFields();
    if (!editRow) return;
    setEditSaving(true);
    try {
      const oldMenuId = editRow.menu.menu_id;
      const oldRoleId = editRow.role.role_id;
      const newMenuId = values.menu_id;
      const newRoleId = values.role_id;

      // 변경 없으면 그냥 닫기
      if (oldMenuId === newMenuId && oldRoleId === newRoleId) {
        setEditOpen(false);
        setEditSaving(false);
        return;
      }

      let nextMappings = { ...mappings };

      // 기존 매핑에서 제거
      nextMappings[oldMenuId] = (nextMappings[oldMenuId] ?? []).filter((id) => id !== oldRoleId);

      // 새 메뉴+role 에 추가 (중복 방지)
      const alreadyExists = (nextMappings[newMenuId] ?? []).includes(newRoleId);
      if (alreadyExists) {
        message.warning('이미 등록된 매핑입니다.');
        setEditSaving(false);
        return;
      }
      nextMappings[newMenuId] = [...(nextMappings[newMenuId] ?? []), newRoleId];

      setMappings(nextMappings);

      // 영향받는 메뉴 저장 (old / new 모두)
      const saveTargets = oldMenuId === newMenuId ? [newMenuId] : [oldMenuId, newMenuId];
      await Promise.all(
        saveTargets.map((menuId) =>
          batchSave.mutateAsync({ menuId, roleIds: nextMappings[menuId] ?? [] }),
        ),
      );

      message.success('수정되었습니다.');
      setEditOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '수정 중 오류가 발생했습니다.');
    } finally {
      setEditSaving(false);
    }
  };

  // 수정 모달에서 선택 가능한 Role (기존 것 or 현재 편집 대상 제외)
  const getEditableRoles = (menuId: string, originalRoleId: string) => {
    const existing = (mappings[menuId] ?? []).filter((id) => id !== originalRoleId);
    return roles.filter((r) => !existing.includes(r.role_id));
  };

  // ── 컬럼 정의 ────────────────────────────────────────────────────────
  const columns = [
    {
      title:  'No',
      key:    'no',
      width:  55,
      align:  'center' as const,
      render: (_: any, __: MappingRow, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title:  '메뉴명',
      key:    'menu_nm',
      render: (_: any, r: MappingRow) => (
        <Tooltip title="수정" mouseEnterDelay={0.3}>
          <Space
            className="clickable-cell"
            onClick={() => openEdit(r)}
            style={{ cursor: 'pointer' }}
          >
            {r.menu.menu_depth === 2 && (
              <Text type="secondary" style={{ fontSize: 11 }}>{'\u2514'}</Text>
            )}
            <Text strong style={{ fontSize: 13 }}>{r.menu.menu_nm}</Text>
            <Tag color={r.menu.menu_depth === 1 ? 'blue' : 'green'} style={{ fontSize: 11 }}>
              {r.menu.menu_depth === 1 ? 'GNB' : 'LNB'}
            </Tag>
          </Space>
        </Tooltip>
      ),
    },
    {
      title:  '상위 메뉴',
      key:    'parent',
      width:  130,
      render: (_: any, r: MappingRow) =>
        r.menu.menu_depth === 2 ? (
          <Tooltip title="수정" mouseEnterDelay={0.3}>
            <Text
              type="secondary"
              className="clickable-text"
              style={{ fontSize: 12, cursor: 'pointer' }}
              onClick={() => openEdit(r)}
            >
              {getParentName(r.menu.parent_menu_id)}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title:  'URL',
      key:    'menu_url',
      render: (_: any, r: MappingRow) => (
        <Tooltip title="수정" mouseEnterDelay={0.3}>
          <code
            className="clickable-text"
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={() => openEdit(r)}
          >
            {r.menu.menu_url}
          </code>
        </Tooltip>
      ),
    },
    {
      title:  'Role',
      key:    'role',
      width:  130,
      render: (_: any, r: MappingRow) => (
        <Tooltip title="수정" mouseEnterDelay={0.3}>
          <Tag
            color={r.role.role_color ?? 'blue'}
            style={{ fontWeight: 600, cursor: 'pointer' }}
            onClick={() => openEdit(r)}
          >
            {r.role.role_cd}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title:  'Role 명',
      key:    'role_nm',
      width:  120,
      render: (_: any, r: MappingRow) => (
        <Tooltip title="수정" mouseEnterDelay={0.3}>
          <Text
            className="clickable-text"
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={() => openEdit(r)}
          >
            {r.role.role_nm}
          </Text>
        </Tooltip>
      ),
    },
    {
      title:  '메뉴 사용',
      key:    'use_yn',
      width:  80,
      align:  'center' as const,
      render: (_: any, r: MappingRow) => (
        <Tooltip title={r.menu.use_yn === 'Y' ? 'ON → OFF 클릭' : 'OFF → ON 클릭'} mouseEnterDelay={0.4}>
          <Switch
            checked={r.menu.use_yn === 'Y'}
            size="small"
            loading={togglingIds.has(r.menu.menu_id)}
            onChange={(checked) => handleToggleUseYn(r.menu, checked)}
          />
        </Tooltip>
      ),
    },
    {
      title:  '수정',
      key:    'edit',
      width:  60,
      align:  'center' as const,
      render: (_: any, r: MappingRow) => (
        <Tooltip title="수정">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
          />
        </Tooltip>
      ),
    },
    {
      title:  '관리',
      key:    'action',
      width:  70,
      align:  'center' as const,
      render: (_: any, r: MappingRow) => (
        <Tooltip title="매핑 삭제">
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(r)}
          />
        </Tooltip>
      ),
    },
  ];

  const isLoading = mLoading || rLoading || mrLoading;
  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <PageLayout
      breadcrumbs={[
        { title: '홈', href: '/' },
        { title: '관리' },
        { title: '메뉴-Role 매핑' },
      ]}
      parentMenuUrl="/admin"
    >
      <Title level={4} style={{ marginBottom: 16 }}>메뉴-Role 접근 권한 매핑</Title>

      <Card
        size="small"
        title={
          <Space wrap>
            <Select
              value={filterDepth}
              onChange={(v) => { setFilterDepth(v as '' | '1' | '2'); setPage(1); }}
              style={{ width: 110 }}
              options={[
                { value: '',  label: '전체' },
                { value: '1', label: 'GNB만' },
                { value: '2', label: 'LNB만' },
              ]}
            />
            <Select
              value={filterRole}
              onChange={(v) => { setFilterRole(v ?? ''); setPage(1); }}
              style={{ width: 130 }}
              allowClear
              placeholder="Role 필터"
              options={[
                { value: '', label: '전체 Role' },
                ...roles.map((r) => ({ value: r.role_id, label: r.role_cd })),
              ]}
            />
            <Input
              placeholder="메뉴명 / URL / Role 검색"
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
            <Button
              icon={<CheckSquareOutlined />}
              onClick={handleSaveAll}
              loading={batchSave.isPending}
            >
              전체 저장
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              매핑 추가
            </Button>
          </Space>
        }
      >
        <Table<MappingRow>
          rowKey="key"
          columns={columns}
          dataSource={filteredRows.slice((page - 1) * pageSize, page * pageSize)}
          pagination={false}
          size="small"
          bordered
        />

        {/* ── 커스텀 페이지네이션 ────────────────────────────────── */}
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
            total={filteredRows.length}
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
                const lastPage = Math.ceil(filteredRows.length / pageSize) || 1;
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

      {/* ── 매핑 추가 모달 ────────────────────────────────────────── */}
      <Modal
        title="메뉴-Role 매핑 추가"
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        okText="추가"
        cancelText="취소"
        confirmLoading={saving}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="menu_id"
            label="메뉴 선택"
            rules={[{ required: true, message: '메뉴를 선택하세요.' }]}
          >
            <Select
              showSearch
              placeholder="메뉴를 선택하세요"
              optionFilterProp="label"
              options={allMenus.map((m) => ({
                value: m.menu_id,
                label: `${m.menu_depth === 2 ? '└ ' : ''}${m.menu_nm} (${m.menu_url})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="role_ids"
            label="Role 선택 (복수 선택 가능)"
            rules={[{ required: true, message: 'Role을 하나 이상 선택하세요.' }]}
          >
            <Select
              mode="multiple"
              placeholder={watchMenuId ? '부여할 Role을 선택하세요' : '먼저 메뉴를 선택하세요'}
              disabled={!watchMenuId}
              options={
                watchMenuId
                  ? getAvailableRoles(watchMenuId).map((r) => ({
                      value: r.role_id,
                      label: `[${r.role_cd}] ${r.role_nm}`,
                    }))
                  : []
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 매핑 수정 모달 ────────────────────────────────────────── */}
      <Modal
        title="메뉴-Role 매핑 수정"
        open={editOpen}
        onOk={handleEditOk}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        okText="저장"
        cancelText="취소"
        confirmLoading={editSaving}
        destroyOnClose
        width={480}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="menu_id"
            label="메뉴 선택"
            rules={[{ required: true, message: '메뉴를 선택하세요.' }]}
          >
            <Select
              showSearch
              placeholder="메뉴를 선택하세요"
              optionFilterProp="label"
              options={allMenus.map((m) => ({
                value: m.menu_id,
                label: `${m.menu_depth === 2 ? '└ ' : ''}${m.menu_nm} (${m.menu_url})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="role_id"
            label="Role 선택"
            rules={[{ required: true, message: 'Role을 선택하세요.' }]}
          >
            <Select
              showSearch
              placeholder="Role을 선택하세요"
              optionFilterProp="label"
              options={
                watchEditMenuId && editRow
                  ? getEditableRoles(watchEditMenuId, editRow.role.role_id).map((r) => ({
                      value: r.role_id,
                      label: `[${r.role_cd}] ${r.role_nm}`,
                    }))
                  : roles.map((r) => ({
                      value: r.role_id,
                      label: `[${r.role_cd}] ${r.role_nm}`,
                    }))
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  );
}
