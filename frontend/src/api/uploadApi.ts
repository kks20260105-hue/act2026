import api from './axiosInstance';
import type { ExcelRow, UploadPreviewResponse, UploadConfirmResponse, UploadLog, UploadError } from '../types/upload';
import type { ApiResponse, PaginatedResponse } from '../types/common';

export const uploadApi = {
  /** 업로드 프리뷰 */
  preview: (fileName: string, rows: ExcelRow[]) =>
    api.post<ApiResponse<UploadPreviewResponse>>('/menus/upload/preview', { fileName, rows })
       .then((r) => r.data.data),

  /** 업로드 확정 */
  confirm: (fileName: string, rows: ExcelRow[]) =>
    api.post<ApiResponse<UploadConfirmResponse>>('/menus/upload/confirm', { fileName, rows })
       .then((r) => r.data.data),

  /** 템플릿 다운로드 URL */
  getTemplateUrl: () => `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/menus/upload/template`,

  /** 업로드 이력 목록 */
  getLogs: (page = 1, limit = 20) =>
    api.get<ApiResponse<PaginatedResponse<UploadLog>>>('/menus/upload/logs', { params: { page, limit } })
       .then((r) => r.data.data),

  /** 업로드 이력 상세 */
  getLogDetail: (logId: string) =>
    api.get<ApiResponse<{ log: UploadLog; errors: UploadError[] }>>(`/menus/upload/logs/${logId}`)
       .then((r) => r.data.data),
};
