import React, { useState, useEffect, useMemo } from 'react';
import {
  Button, Table, Space, Tag, Tooltip, Typography, App, Switch,
  Modal, Form, Select, Card, Pagination, Input,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckSquareOutlined,
  SearchOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
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

/** 메뉴 1행에 Role[] 묶음 타입 */
interface MappingRow {
  key:   string;   // menuId
  menu:  Menu;
  roles: Role[];   // ROLE_CD_ORDER 정렬된 배열
}

export default function MenuRolePage() {
  const { message, modal }             = App.useApp();
  const qc                              = useQueryClient();
  const { isLoading: mLoading }        = useMenuTree();
  const allMenus: Menu[]                 = useMenuStore((s) => s.menus ?? []);
  const { data: roles = [], isLoading: rLoading }       = useRoles();
  const { data: menuRoles = [], isLoading: mrLoading }  = useMenuRoles();
  const batchSave                       = useBatchMenuRoles();

  // ── 메뉴 사용여부 토글 ──────────────────────────────────────────────
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const handleToggleUseYn = async (menu: Menu, checked: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(menu.menu_id));
    try {
      await menuApi.update(menu.menu_id, { use_yn: checked ? 'Y' : 'N' });
      await qc.invalidateQueries({ queryKey: MENU_KEYS.all });
      message.success(`'${menu.menu_nm}' 사용이 ${checked ? 'ON' : 'OFF'}으로 변경됐습니다.`);
    } catch {
      message.error('사용 여부 변경에 실패했습니다.');
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(menu.menu_id); return s; });
    }
  };

  // ── 로컬 매핑 상태 : menuId → roleId[] ────────────────────────────
  const [mappings,    setMappings]    = useState<Record<string, string[]>>({});
  const [initialized, setInitialized] = useState(false);

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
  const [form]                    = Form.useForm<{ menu_id: string; role_ids: string[] }>();  const [modalDepthFilter, setModalDepthFilter] = useState<number | null>(null);
  // ── 검색 / 필터 / 페이징 ─────────────────────────────────────────
  const [searchText,  setSearchText]  = useState('');
  const [filterDepth, setFilterDepth] = useState<string>('');
  const [filterRole,  setFilterRole]  = useState<string>('');
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(10);

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = allMenus.find((m) => m.menu_id === parentId);
    return parent ? parent.menu_nm : '-';
  };

  /** depth에 따른 들여쓰기 + └ 프리픽스 (depth 1 → 빈 문자열) */
  const getIndentPrefix = (depth: number): string =>
    depth <= 1 ? '' : '    '.repeat(depth - 1) + '└ ';

  /** 메뉴 선택 콤보박스용 트리 정렬 options (GNB → LNB → L3 ... 무한 depth) */
  const menuTreeOptions = useMemo(() => {
    const getKey = (menu: Menu): string => {
      const padded = String(menu.menu_order ?? 0).padStart(5, '0');
      if (!menu.parent_menu_id) return padded;
      const parent = allMenus.find((m) => m.menu_id === menu.parent_menu_id);
      return parent ? `${getKey(parent)}.${padded}` : padded;
    };
    return [...allMenus]
      .sort((a, b) => getKey(a).localeCompare(getKey(b)))
      .map((m) => {
        const indent = m.menu_depth > 1 ? '\u00a0\u00a0\u00a0\u00a0'.repeat(m.menu_depth - 1) + '\u2514 ' : '';
        const lv     = `[L${m.menu_depth}]`;
        return {
          value: m.menu_id,
          label: `${indent}${lv} ${m.menu_nm}  (${m.menu_url})`,
          depth: m.menu_depth,
        };
      });
  }, [allMenus]);

  /** 모달 depth 필터용 레벨 목록 (실제 존재하는 depth만) */
  const menuDepthLevels = useMemo(() => {
    const depths = [...new Set(allMenus.map((m) => m.menu_depth))].sort((a, b) => a - b);
    return depths.map((d) => ({
      depth: d,
      label: d === 1 ? 'GNB' : d === 2 ? 'LNB' : `L${d}`,
      color: d === 1 ? 'blue' : d === 2 ? 'green' : 'purple',
    }));
  }, [allMenus]);

  /** modalDepthFilter 적용된 options */
  const filteredMenuTreeOptions = useMemo(() =>
    modalDepthFilter === null
      ? menuTreeOptions
      : menuTreeOptions.filter((o) => o.depth === modalDepthFilter),
  [menuTreeOptions, modalDepthFilter]);

  /** role_cd → 리스트 표시 약어 (없으면 role_cd 그대로) */
  const ROLE_CD_ALIAS: Record<string, string> = {
    SUPER_ADMIN: 'SA',
    ADMIN:       'A',
    MANAGER:     'M',
    USER:        'U',
  };
  const getRoleAlias = (role_cd: string): string => ROLE_CD_ALIAS[role_cd] ?? role_cd;

  /** depth에 따른 Tag 라벨·색상 */
  const getDepthTag = (depth: number): { label: string; color: string } => {
    const map: Record<number, { label: string; color: string }> = {
      1: { label: 'GNB', color: 'blue' },
      2: { label: 'LNB', color: 'green' },
      3: { label: 'L3',  color: 'orange' },
    };
    return map[depth] ?? { label: `L${depth}`, color: 'purple' };
  };

  // ── 그룹 행 생성 (메뉴 1개 = 1행, roles[] 묶음) ──────────────────────
  const groupedRows = useMemo<MappingRow[]>(() => {
    // role_cd 고정 우선순위
    const ROLE_CD_ORDER: Record<string, number> = {
      SUPER_ADMIN: 1,
      ADMIN:       2,
      MANAGER:     3,
      USER:        4,
    };
    const roleOrder = (role: Role): number =>
      ROLE_CD_ORDER[role.role_cd] ?? role.sort_order + 100;

    // 조상 체인을 올라가 "00001.00002" 형태의 메뉴 정렬 키 생성
    const getSortKey = (menu: Menu): string => {
      const path: number[] = [];
      let cur: Menu | undefined = menu;
      while (cur) {
        path.unshift(cur.menu_order);
        if (!cur.parent_menu_id) break;
        cur = allMenus.find((m) => m.menu_id === cur!.parent_menu_id);
      }
      return path.map((n) => String(n).padStart(5, '0')).join('.');
    };

    const rows: MappingRow[] = Object.entries(mappings).map(([menuId, roleIds]) => {
      const menu = allMenus.find((m) => m.menu_id === menuId);
      if (!menu) return null;
      const assignedRoles = roleIds
        .map((id) => roles.find((r) => r.role_id === id))
        .filter(Boolean) as Role[];
      assignedRoles.sort((a, b) => roleOrder(a) - roleOrder(b));
      return { key: menuId, menu, roles: assignedRoles };
    }).filter(Boolean) as MappingRow[];

    rows.sort((a, b) => getSortKey(a.menu).localeCompare(getSortKey(b.menu)));
    return rows;
  }, [mappings, allMenus, roles]);

  // ── 필터 적용 ────────────────────────────────────────────────────────
  const filteredRows = useMemo<MappingRow[]>(() => {
    let list = [...groupedRows];
    if (filterDepth) list = list.filter((r) => String(r.menu.menu_depth) === filterDepth);
    if (filterRole)  list = list.filter((r) => r.roles.some((ro) => ro.role_id === filterRole));
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.menu.menu_nm.toLowerCase().includes(kw) ||
          r.menu.menu_url.toLowerCase().includes(kw) ||
          r.roles.some((ro) =>
            ro.role_cd.toLowerCase().includes(kw) ||
            ro.role_nm.toLowerCase().includes(kw),
          ),
      );
    }
    return list;
  }, [groupedRows, filterDepth, filterRole, searchText]);

  // ── Role 단건 삭제 ───────────────────────────────────────────────────
  const handleDeleteRole = (menu: Menu, role: Role) => {
    modal.confirm({
      title:  `"${menu.menu_nm}" 에서 [${role.role_cd}] 권한을 제거하시겠습니까?`,
      okText:  '제거',
      okType:  'danger',
      onOk: async () => {
        const newRoleIds = (mappings[menu.menu_id] ?? []).filter((id) => id !== role.role_id);
        setMappings((prev) => ({ ...prev, [menu.menu_id]: newRoleIds }));
        try {
          await batchSave.mutateAsync({ menuId: menu.menu_id, roleIds: newRoleIds });
          message.success('삭제했습니다.');
        } catch {
          setMappings((prev) => ({
            ...prev,
            [menu.menu_id]: [...(prev[menu.menu_id] ?? []), role.role_id],
          }));
          message.error('삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  // ── 전체 저장 ────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    try {
      const menuIds = groupedRows.map((r) => r.menu.menu_id);
      await Promise.all(
        menuIds.map((menuId) =>
          batchSave.mutateAsync({ menuId, roleIds: mappings[menuId] ?? [] }),
        ),
      );
      message.success(`${menuIds.length}개 메뉴 권한이 저장됐습니다.`);
    } catch {
      message.error('일부 저장에 실패했습니다.');
    }
  };

  // ── 매핑 추가 모달 열기/저장 ─────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    setModalDepthFilter(null);
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const prev   = mappings[values.menu_id] ?? [];
      const newIds = values.role_ids.filter((id) => !prev.includes(id));
      if (newIds.length === 0) {
        message.warning('이미 등록된 Role입니다.');
        setSaving(false);
        return;
      }
      const next = [...prev, ...newIds];
      setMappings((s) => ({ ...s, [values.menu_id]: next }));
      await batchSave.mutateAsync({ menuId: values.menu_id, roleIds: next });
      message.success('매핑이 추가됐습니다.');
      setModalOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 모달에서 선택한 메뉴의 미배정 role 목록
  const getAvailableRoles = (menuId: string) => {
    const existing = mappings[menuId] ?? [];
    return roles.filter((r) => !existing.includes(r.role_id));
  };

  const watchMenuId = Form.useWatch('menu_id', form);

  // ── 수정 모달 (Role 추가/삭제) ────────────────────────────────────────
  const [editOpen,   setEditOpen]   = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMenuId, setEditMenuId] = useState<string>('');
  const [editForm]                  = Form.useForm<{ role_ids: string[] }>();

  const openEdit = (row: MappingRow) => {
    setEditMenuId(row.menu.menu_id);
    editForm.setFieldsValue({ role_ids: row.roles.map((r) => r.role_id) });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    const values = await editForm.validateFields();
    setEditSaving(true);
    try {
      await batchSave.mutateAsync({ menuId: editMenuId, roleIds: values.role_ids });
      setMappings((prev) => ({ ...prev, [editMenuId]: values.role_ids }));
      message.success('Role 매핑이 수정됐습니다.');
      setEditOpen(false);
    } catch {
      message.error('저장 중 오류가 발생했습니다.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── 메뉴 정보 수정 모달 ─────────────────────────────────────────────
  const [menuEditOpen,   setMenuEditOpen]   = useState(false);
  const [menuEditSaving, setMenuEditSaving] = useState(false);
  const [menuEditTarget, setMenuEditTarget] = useState<Menu | null>(null);
  const [menuEditForm]                      = Form.useForm<{ menu_nm: string; menu_url: string; parent_menu_id?: string }>();

  const openMenuEdit = (menu: Menu) => {
    setMenuEditTarget(menu);
    menuEditForm.setFieldsValue({
      menu_nm:        menu.menu_nm,
      menu_url:       menu.menu_url,
      parent_menu_id: menu.parent_menu_id ?? undefined,
    });
    setMenuEditOpen(true);
  };

  const handleMenuEditSave = async () => {
    const values = await menuEditForm.validateFields();
    if (!menuEditTarget) return;
    setMenuEditSaving(true);
    try {
      await menuApi.update(menuEditTarget.menu_id, {
        menu_nm:        values.menu_nm,
        menu_url:       values.menu_url,
        parent_menu_id: values.parent_menu_id ?? null,
      } as any);
      await qc.invalidateQueries({ queryKey: MENU_KEYS.all });
      message.success(`'${values.menu_nm}' 메뉴가 수정됐습니다.`);
      setMenuEditOpen(false);
    } catch {
      message.error('메뉴 수정에 실패했습니다.');
    } finally {
      setMenuEditSaving(false);
    }
  };

  // ── 행 전체 삭제 (메뉴의 모든 Role 매핑 제거) ────────────────────────
  const handleDeleteRow = (row: MappingRow) => {
    modal.confirm({
      title:   `"${row.menu.menu_nm}" 의 Role 매핑을 삭제하시겠습니까?`,
      content: `(${row.roles.map((r) => r.role_cd).join(', ')})`,
      okText:  '삭제',
      okType:  'danger',
      onOk: async () => {
        try {
          await batchSave.mutateAsync({ menuId: row.menu.menu_id, roleIds: [] });
          setMappings((prev) => ({ ...prev, [row.menu.menu_id]: [] }));
          message.success('삭제됐습니다.');
        } catch {
          message.error('삭제 중 오류가 발생했습니다.');
        }
      },
    });
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
      width:  200,
      render: (_: any, r: MappingRow) => {
        const prefix = getIndentPrefix(r.menu.menu_depth);
        const tag    = getDepthTag(r.menu.menu_depth);
        return (
          <Tooltip title="메뉴Role 권한수정" mouseEnterDelay={0.4}>
            <Space
              style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
              onClick={() => openEdit(r)}
            >
              {prefix && (
                <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{prefix}</Text>
              )}
              <Text strong={r.menu.menu_depth === 1} style={{ fontSize: 13 }}>{r.menu.menu_nm}</Text>
              <Tag color={tag.color} style={{ fontSize: 11 }}>{tag.label}</Tag>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title:  '상위 메뉴',
      key:    'parent',
      width:  130,
      render: (_: any, r: MappingRow) => (
        <Tooltip title="메뉴Role 권한수정" mouseEnterDelay={0.4}>
          <div style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
            {r.menu.menu_depth > 1 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>{getParentName(r.menu.parent_menu_id)}</Text>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </div>
        </Tooltip>
      ),
    },
    {
      title:  'URL',
      key:    'menu_url',
      width:  180,
      render: (_: any, r: MappingRow) => (
        <Tooltip title="메뉴Role 권한수정" mouseEnterDelay={0.4}>
          <div style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
            <code style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.menu.menu_url}</code>
          </div>
        </Tooltip>
      ),
    },
    {
      title:  'Role',
      key:    'roles',
      render: (_: any, r: MappingRow) => (
        <Space wrap size={4}>
          {r.roles.map((role) => (
            <Tooltip key={role.role_id} title={`${role.role_cd} · ${role.role_nm}`}>
              <Tag
                color={role.role_color ?? 'blue'}
                style={{ fontWeight: 600, cursor: 'default' }}
                closable
                onClose={(e) => { e.preventDefault(); handleDeleteRole(r.menu, role); }}
              >
                {getRoleAlias(role.role_cd)}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title:  '메뉴 사용',
      key:    'use_yn',
      width:  80,
      align:  'center' as const,
      render: (_: any, r: MappingRow) => (
        <Switch
          checked={r.menu.use_yn === 'Y'}
          size="small"
          loading={togglingIds.has(r.menu.menu_id)}
          onChange={(checked) => handleToggleUseYn(r.menu, checked)}
        />
      ),
    },
    {
      title:  '관리',
      key:    'action',
      width:  90,
      align:  'center' as const,
      render: (_: any, r: MappingRow) => (
        <Space size={12}>
          <Tooltip title="메뉴Role 권한수정">
            <Button
              size="small"
              type="default"
              icon={<EditOutlined />}
              onClick={() => openEdit(r)}
            />
          </Tooltip>
          <Tooltip title="삭제">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteRow(r)}
            />
          </Tooltip>
        </Space>
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
              onChange={(v) => { setFilterDepth(v ?? ''); setPage(1); }}
              style={{ width: 120 }}
              options={[
                { value: '', label: '전체' },
                ...Array.from(
                  new Set(allMenus.map((m) => m.menu_depth))
                ).sort()
                  .map((d) => ({
                    value: String(d),
                    label: getDepthTag(d).label + '만',
                  })),
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
        <style>{`
          .compact-menurole-table .ant-table-cell {
            padding: 3px 6px !important;
            line-height: 1.3 !important;
          }
          .compact-menurole-table .ant-table-thead .ant-table-cell {
            padding: 4px 6px !important;
            font-size: 11px !important;
          }
        `}</style>
        <div style={{ overflowX: 'scroll' }} className="compact-menurole-table">
          <Table<MappingRow>
            rowKey="key"
            columns={columns}
            dataSource={filteredRows.slice((page - 1) * pageSize, page * pageSize)}
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

      {/* ── 메뉴 정보 수정 모달 ───────────────────────────────────────── */}
      <Modal
        title={`메뉴 수정 — ${menuEditTarget?.menu_nm ?? ''}`}
        open={menuEditOpen}
        onOk={handleMenuEditSave}
        confirmLoading={menuEditSaving}
        onCancel={() => { setMenuEditOpen(false); menuEditForm.resetFields(); }}
        okText="저장"
        cancelText="취소"
        destroyOnClose
        width={480}
      >
        <Form form={menuEditForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="menu_nm"
            label="메뉴명"
            rules={[{ required: true, message: '메뉴명을 입력해주세요.' }]}
          >
            <Input placeholder="메뉴명" />
          </Form.Item>
          <Form.Item
            name="menu_url"
            label="URL"
            rules={[{ required: true, message: 'URL을 입력해주세요.' }]}
          >
            <Input placeholder="/path" />
          </Form.Item>
          <Form.Item name="parent_menu_id" label="상위 메뉴 (선택)">
            <Select
              allowClear
              placeholder="상위 메뉴 없음 (GNB)"
              showSearch
              optionFilterProp="label"
              options={allMenus
                .filter((m) => m.menu_id !== menuEditTarget?.menu_id)
                .map((m) => ({
                  value: m.menu_id,
                  label: `${m.menu_depth > 1 ? '    '.repeat(m.menu_depth - 1) + '└ ' : ''}${m.menu_nm}`,
                }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Role 수정 모달 ────────────────────────────────────────── */}
      <Modal
        title={`Role 수정 — ${allMenus.find((m) => m.menu_id === editMenuId)?.menu_nm ?? ''}`}
        open={editOpen}
        onOk={handleEditSave}
        confirmLoading={editSaving}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        okText="저장"
        cancelText="취소"
        destroyOnClose
        width={480}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="role_ids"
            label="할당 Role (추가·제거 가능)"
            rules={[{ required: false }]}
          >
            <Select
              mode="multiple"
              placeholder="Role을 선택하세요"
              options={roles.map((r) => ({
                value: r.role_id,
                label: `[${getRoleAlias(r.role_cd)}] ${r.role_nm}`,
              }))}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 매핑 추가 모달 ─────────────────────────────────────────── */}
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
          {/* 레벨 필터 버튼 */}
          <div style={{ marginBottom: 6 }}>
            <Space size={4} wrap>
              <Text style={{ fontSize: 11, marginRight: 4 }}>레벨:</Text>
              <Tag
                style={{ cursor: 'pointer', fontWeight: modalDepthFilter === null ? 700 : 400 }}
                color={modalDepthFilter === null ? 'default' : undefined}
                onClick={() => { setModalDepthFilter(null); form.setFieldValue('menu_id', undefined); }}
              >
                전체
              </Tag>
              {menuDepthLevels.map((lv) => (
                <Tag
                  key={lv.depth}
                  color={modalDepthFilter === lv.depth ? lv.color : undefined}
                  style={{
                    cursor: 'pointer',
                    fontWeight: modalDepthFilter === lv.depth ? 700 : 400,
                    border: modalDepthFilter === lv.depth ? undefined : '1px solid #d9d9d9',
                  }}
                  onClick={() => { setModalDepthFilter(modalDepthFilter === lv.depth ? null : lv.depth); form.setFieldValue('menu_id', undefined); }}
                >
                  {lv.label}
                </Tag>
              ))}
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({filteredMenuTreeOptions.length}개)
              </Text>
            </Space>
          </div>

          <Form.Item
            name="menu_id"
            label="메뉴 선택"
            rules={[{ required: true, message: '메뉴를 선택해주세요.' }]}
          >
            <Select
              showSearch
              placeholder="메뉴를 선택해주세요."
              optionFilterProp="label"
              options={filteredMenuTreeOptions}
            />
          </Form.Item>

          <Form.Item
            name="role_ids"
            label="Role 선택 (복수 선택 가능)"
            rules={[{ required: true, message: 'Role을 하나 이상 선택해주세요.' }]}
          >
            <Select
              mode="multiple"
              placeholder={watchMenuId ? '부여할 Role을 선택해주세요.' : '먼저 메뉴를 선택해주세요.'}
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
    </PageLayout>
  );
}
