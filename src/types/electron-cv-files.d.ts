export type CvFsReadResult =
  | { ok: true; content: string | null }
  | { ok: false; error: string; content: null };

export type CvFsWriteResult = { ok: true } | { ok: false; error: string };

export type CvFsBundledDirResult = { ok: true; path: string } | { ok: false; error: string };

export type CvFsPickFolderResult = { ok: true; path: string | null } | { ok: false; error: string };

export type CvPdfSaveResult =
  | { ok: true; canceled: true }
  | { ok: true; canceled: false; path: string }
  | { ok: false; error: string };

export type CvUiLangResult = { ok: true } | { ok: false; error: string };

export type CvRecentSetListResult = { ok: true } | { ok: false; error: string };

export type CvDocumentStatusPayload = { fileName: string; dirty: boolean };

export type CvTemplateFromPathPayload = { path?: string; name: string; content: string };

export type CvMenuAction = "save" | "saveAs" | "printPdf";

export type CvMenuActionPayload = { action: CvMenuAction };

export interface CvFilesApi {
  /** Ścieżka dyskowa pliku z `<input type="file">` (Electron `webUtils.getPathForFile`). */
  getPathForFile?: (file: File) => string;
  getBundledCvDataDir: () => Promise<CvFsBundledDirResult>;
  read: (payload: { folderPath: string | null; fileName: string }) => Promise<CvFsReadResult>;
  write: (payload: { folderPath: string | null; fileName: string; content: string }) => Promise<CvFsWriteResult>;
  pickFolder: () => Promise<CvFsPickFolderResult>;
  savePdf: (payload: { fileName: string }) => Promise<CvPdfSaveResult>;
  setUiLanguage: (lang: "pl" | "en") => Promise<CvUiLangResult>;
  syncRecentFiles: (entries: Array<{ path: string; name: string }>) => Promise<CvRecentSetListResult>;
  setDocumentStatus: (payload: CvDocumentStatusPayload) => Promise<{ ok: true }>;
  subscribeTemplateFromPath: (cb: (payload: CvTemplateFromPathPayload) => void) => () => void;
  subscribeMenuAction?: (cb: (payload: CvMenuActionPayload) => void) => () => void;
}

declare global {
  interface Window {
    cvFiles?: CvFilesApi;
  }
}

export {};
