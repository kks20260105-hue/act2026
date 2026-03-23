import { create } from 'zustand';
import type { PreviewRow, UploadSummary } from '../types/upload';

type UploadStep = 'idle' | 'selected' | 'previewing' | 'previewed' | 'confirming' | 'done';

interface UploadState {
  step:         UploadStep;
  fileName:     string | null;
  previewRows:  PreviewRow[];
  summary:      UploadSummary | null;
  errorRows:    PreviewRow[];

  setStep:       (step: UploadStep) => void;
  setPreview:    (fileName: string, rows: PreviewRow[], summary: UploadSummary) => void;
  reset:         () => void;
}

export const useUploadStore = create<UploadState>()((set, get) => ({
  step:        'idle',
  fileName:    null,
  previewRows: [],
  summary:     null,
  errorRows:   [],

  setStep: (step) => set({ step }),

  setPreview: (fileName, rows, summary) => {
    const safeRows = rows ?? [];
    set({
      fileName,
      previewRows: safeRows,
      summary,
      errorRows:   safeRows.filter((r) => r.status === 'error'),
      step:        'previewed',
    });
  },

  reset: () =>
    set({ step: 'idle', fileName: null, previewRows: [], summary: null, errorRows: [] }),
}));
