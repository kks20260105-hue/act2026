import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadApi } from '../api/uploadApi';
import { useUploadStore } from '../stores/uploadStore';
import type { ExcelRow } from '../types/upload';

/** 업로드 프리뷰 요청 */
export function useUploadPreview() {
  const { setPreview, setStep } = useUploadStore();

  return useMutation({
    mutationFn: ({ fileName, rows }: { fileName: string; rows: ExcelRow[] }) =>
      uploadApi.preview(fileName, rows),
    onMutate: () => setStep('previewing'),
    onSuccess: (data) => {
      setPreview(data.fileName, data.rows, data.summary);
    },
    onError: () => setStep('selected'),
  });
}

/** 업로드 확정 */
export function useUploadConfirm() {
  const qc = useQueryClient();
  const { setStep, reset } = useUploadStore();

  return useMutation({
    mutationFn: ({ fileName, rows }: { fileName: string; rows: ExcelRow[] }) =>
      uploadApi.confirm(fileName, rows),
    onMutate: () => setStep('confirming'),
    onSuccess: () => {
      setStep('done');
      qc.invalidateQueries({ queryKey: ['menus'] });
      qc.invalidateQueries({ queryKey: ['upload-logs'] });
    },
    onError: () => setStep('previewed'),
  });
}

/** 업로드 이력 목록 */
export function useUploadLogs(page = 1) {
  const { useQuery } = require('@tanstack/react-query');
  return useQuery({
    queryKey: ['upload-logs', page],
    queryFn:  () => uploadApi.getLogs(page),
  });
}
