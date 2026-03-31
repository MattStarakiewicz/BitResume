/**
 * Dane CV w Origin Private File System — folder „wewnątrz aplikacji” (sandbox przeglądarki).
 */
import { DEFAULT_CV_FILE_NAME, sanitizeTemplateFileName } from "./cv-save-config";

/** Katalog roboczy CV w pamięci przeglądarki (OPFS) — odpowiada „folderowi aplikacji” przy pierwszym uruchomieniu. */
export const CV_OPFS_DIRECTORY = "cv-buldier";

export function isCvOpfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === "function"
  );
}

function resolveOpfsFileName(fileName?: string): string {
  return sanitizeTemplateFileName(fileName?.trim() ? fileName : DEFAULT_CV_FILE_NAME);
}

export async function saveCvTemplateToOpfs(json: string, fileName = DEFAULT_CV_FILE_NAME): Promise<boolean> {
  if (!isCvOpfsAvailable()) return false;
  const name = resolveOpfsFileName(fileName);
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(CV_OPFS_DIRECTORY, { create: true });
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(json);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadCvTemplateFromOpfs(fileName = DEFAULT_CV_FILE_NAME): Promise<string | null> {
  if (!isCvOpfsAvailable()) return null;
  const name = resolveOpfsFileName(fileName);
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(CV_OPFS_DIRECTORY);
    const fileHandle = await dir.getFileHandle(name);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}
