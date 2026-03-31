export type CvSaveTarget = "opfs" | "disk";

export interface CvSaveLocationConfig {
  target: CvSaveTarget;
  fileName: string;
  /** Nazwa katalogu z `FileSystemDirectoryHandle.name` — pełnej ścieżki OS przeglądarka nie udostępnia. */
  diskFolderName?: string;
  /** Pełna ścieżka folderu (Electron / IPC). */
  diskFolderPath?: string;
}

const CONFIG_KEY = "cv-buldier:save-location-v2";
const LEGACY_CONFIG_KEY = "cv-buldier:save-location-v1";
export const DEFAULT_CV_FILE_NAME = "template.json";

/** Bezpieczna nazwa pliku tylko w segmencie (bez ścieżek). */
export function sanitizeTemplateFileName(input: string): string {
  let s = input
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "");
  if (!s.toLowerCase().endsWith(".json")) {
    s = `${s || "template"}.json`;
  }
  if (s.length > 120) {
    s = `${s.slice(0, 112)}.json`;
  }
  return s;
}

function parseStoredPayload(raw: string): CvSaveLocationConfig | null {
  const p = JSON.parse(raw) as {
    target?: string;
    fileName?: string;
    diskFolderName?: string;
    diskFolderPath?: string;
  };
  const target: CvSaveTarget = p.target === "disk" ? "disk" : "opfs";
  const fileName =
    typeof p.fileName === "string" && p.fileName.trim()
      ? sanitizeTemplateFileName(p.fileName)
      : DEFAULT_CV_FILE_NAME;
  const diskFolderName =
    target === "disk" && typeof p.diskFolderName === "string" && p.diskFolderName.trim()
      ? p.diskFolderName.trim()
      : undefined;
  const diskFolderPath =
    target === "disk" && typeof p.diskFolderPath === "string" && p.diskFolderPath.trim()
      ? p.diskFolderPath.trim()
      : undefined;
  return { target, fileName, diskFolderName, diskFolderPath };
}

export function loadSaveConfig(): CvSaveLocationConfig {
  if (typeof window === "undefined") {
    return { target: "opfs", fileName: DEFAULT_CV_FILE_NAME };
  }
  try {
    let raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_CONFIG_KEY);
      if (raw) {
        const parsed = parseStoredPayload(raw);
        if (parsed) {
          storeSaveConfig(parsed);
          localStorage.removeItem(LEGACY_CONFIG_KEY);
          return parsed;
        }
      }
      return { target: "opfs", fileName: DEFAULT_CV_FILE_NAME };
    }
    return parseStoredPayload(raw) ?? { target: "opfs", fileName: DEFAULT_CV_FILE_NAME };
  } catch {
    return { target: "opfs", fileName: DEFAULT_CV_FILE_NAME };
  }
}

export function storeSaveConfig(config: CvSaveLocationConfig): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Record<string, unknown> = {
      target: config.target,
      fileName: sanitizeTemplateFileName(config.fileName),
    };
    if (config.target === "disk" && config.diskFolderName?.trim()) {
      payload.diskFolderName = config.diskFolderName.trim();
    }
    if (config.target === "disk" && config.diskFolderPath?.trim()) {
      payload.diskFolderPath = config.diskFolderPath.trim();
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}
