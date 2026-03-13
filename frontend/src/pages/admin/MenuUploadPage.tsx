import React, { useRef, useState } from 'react';
import {
  Button, Space, Table, Typography, Upload, Alert,
  Progress, Tag, Statistic, Row, Col, Card, App,
} from 'antd';
import { UploadOutlined, DownloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { parseExcelFile, validateUploadFile } from '../../utils/excelParser';
import { useUploadPreview, useUploadConfirm } from '../../hooks/useUploadPreview';
import { useUploadStore } from '../../stores/uploadStore';
import { uploadApi } from '../../api/uploadApi';
import PageLayout from '../../components/layout/PageLayout';
import type { PreviewRow } from '../../types/upload';

const { Title, Text } = Typography;

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  valid: { color: 'green',  label: '정상' },
  error: { color: 'red',    label: '오류' },
  skip:  { color: 'orange', label: '건너뜀' },
};

export default function MenuUploadPage() {
  const { message } = App.useApp();
  const { step, fileName, previewRows, summary, reset } = useUploadStore();
  const previewMutation = useUploadPreview();
  const confirmMutation = useUploadConfirm();
  const [parsedRows, setParsedRows] = useState<any[]>([]);

  const handleFileChange = async (file: File) => {
    const validErr = validateUploadFile(file);
    if (validErr) { message.error(validErr); return false; }

    try {
      const rows = await parseExcelFile(file);
      setParsedRows(rows);
      await previewMutation.mutateAsync({ fileName: file.name, rows });
    } catch (e: any) {
      message.error(e.message ?? '파싱 오류');
    }
    return false;
  };

  const handleConfirm = async () => {
    if (!fileName || parsedRows.length === 0) return;
    const validRows = previewRows.filter((r) => r.status === 'valid');
    await confirmMutation.mutateAsync({ fileName, rows: validRows });
    message.success(`${validRows.length}건이 저장되었습니다.`);
  };

  const columns = [
    { title: '행번호', dataIndex: 'rowNo',   key: 'rowNo',   width: 70 },
    { title: '메뉴명', dataIndex: 'menu_nm', key: 'menu_nm' },
    { title: 'URL',    dataIndex: 'menu_url', key: 'menu_url', render: (v: string) => <code>{v}</code> },
    { title: '깊이',   dataIndex: 'menu_depth', key: 'menu_depth', width: 60 },
    { title: '순서',   dataIndex: 'menu_order', key: 'menu_order', width: 60 },
    {
      title: '상태',
      key:   'status',
      width: 80,
      render: (_: any, r: PreviewRow) => (
        <Tag color={STATUS_TAG[r.status]?.color}>{STATUS_TAG[r.status]?.label}</Tag>
      ),
    },
    {
      title: '오류',
      key:   'errors',
      render: (_: any, r: PreviewRow) =>
        r.errors.length > 0
          ? <Text type="danger" style={{ fontSize: 12 }}>{r.errors.join(' | ')}</Text>
          : null,
    },
  ];

  return (
    <PageLayout
      breadcrumbs={[{ title: '홈', href: '/' }, { title: '관리' }, { title: '메뉴 엑셀 업로드' }]}
      parentMenuUrl="/admin"
    >
      <Title level={4}>메뉴 엑셀 업로드</Title>

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 안내 및 템플릿 */}
        <Alert
          type="info"
          showIcon
          message="업로드 형식 안내"
          description="xlsx, xls, csv 파일을 지원합니다. 최대 500행, 5MB 제한."
          action={
            <Button
              size="small"
              icon={<DownloadOutlined />}
              href={uploadApi.getTemplateUrl()}
            >
              템플릿 다운로드
            </Button>
          }
        />

        {/* 파일 선택 */}
        {step === 'idle' || step === 'selected' ? (
          <Upload
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
            beforeUpload={handleFileChange}
          >
            <Button
              icon={<UploadOutlined />}
              loading={previewMutation.isPending}
              size="large"
            >
              파일 선택
            </Button>
          </Upload>
        ) : null}

        {/* 프리뷰 결과 */}
        {(step === 'previewed' || step === 'confirming' || step === 'done') && summary && (
          <>
            <Row gutter={16}>
              <Col span={6}><Card><Statistic title="전체"   value={summary.total} /></Card></Col>
              <Col span={6}><Card><Statistic title="정상"   value={summary.valid} valueStyle={{ color: '#52c41a' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="오류"   value={summary.error} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="건너뜀" value={summary.skip}  valueStyle={{ color: '#faad14' }} /></Card></Col>
            </Row>

            {step !== 'done' && (
              <Space>
                <Button onClick={reset}>다시 선택</Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={summary.valid === 0}
                  loading={confirmMutation.isPending}
                  onClick={handleConfirm}
                >
                  {summary.valid}건 저장
                </Button>
              </Space>
            )}

            {step === 'done' && (
              <Alert
                type="success"
                showIcon
                message="업로드가 완료되었습니다."
                action={<Button size="small" onClick={reset}>다시 업로드</Button>}
              />
            )}

            <Table
              rowKey="rowNo"
              columns={columns}
              dataSource={previewRows}
              size="small"
              bordered
              pagination={{ pageSize: 20, showSizeChanger: false }}
              rowClassName={(r: PreviewRow) => r.status === 'error' ? 'ant-table-row-red' : ''}
              scroll={{ x: 800 }}
            />
          </>
        )}
      </Space>
    </PageLayout>
  );
}
