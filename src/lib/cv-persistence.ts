import { loadCvTemplateFromOpfs, saveCvTemplateToOpfs } from "@/lib/cv-app-storage";
import type { CvSaveLocationConfig } from "@/lib/cv-save-config";
import { sanitizeTemplateFileName } from "@/lib/cv-save-config";
import {
  loadUserSaveDirectory,
  readCvJsonFromUserFolder,
  writeCvJsonToUserFolder,
} from "@/lib/cv-user-folder";

export function isElectronFileBridge(): boolean {
  return typeof window !== "undefined" && typeof window.cvFiles !== "undefined";
}

export async function getElectronBundledCvDir(): Promise<string | null> {
  if (!isElectronFileBridge() || !window.cvFiles) return null;
  const r = await window.cvFiles.getBundledCvDataDir();
  return r.ok ? r.path : null;
}

export function getElectronFullFilePath(cfg: CvSaveLocationConfig, bundledDir: string | null): string {
  const file = sanitizeTemplateFileName(cfg.fileName);
  if (cfg.target === "disk") {
    const dir = cfg.diskFolderPath?.trim();
    if (dir) return `${dir.replace(/[/\\]$/, "")}${dir.includes("\\") ? "\\" : "/"}${file}`;
  }
  if (bundledDir) {
    const sep = bundledDir.includes("\\") ? "\\" : "/";
    return `${bundledDir.replace(/[/\\]$/, "")}${sep}${file}`;
  }
  return file;
}

export async function readCvJsonFromLocation(cfg: CvSaveLocationConfig): Promise<string | null> {
  const fileName = sanitizeTemplateFileName(cfg.fileName);
  if (isElectronFileBridge() && window.cvFiles) {
    if (cfg.target === "disk" && !cfg.diskFolderPath?.trim()) {
      return null;
    }
    const r = await window.cvFiles.read({
      folderPath: cfg.target === "disk" ? cfg.diskFolderPath! : null,
      fileName,
    });
    if (!r.ok) return null;
    return r.content?.trim() ? r.content : null;
  }

  if (cfg.target === "disk") {
    const dir = await loadUserSaveDirectory();
    if (!dir) return null;
    return readCvJsonFromUserFolder(dir, fileName);
  }

  return loadCvTemplateFromOpfs(fileName);
}

export async function writeCvJsonToLocation(cfg: CvSaveLocationConfig, json: string): Promise<boolean> {
  const fileName = sanitizeTemplateFileName(cfg.fileName);
  if (isElectronFileBridge() && window.cvFiles) {
    if (cfg.target === "disk" && !cfg.diskFolderPath?.trim()) {
      return false;
    }
    const r = await window.cvFiles.write({
      folderPath: cfg.target === "disk" ? cfg.diskFolderPath! : null,
      fileName,
      content: json,
    });
    return r.ok;
  }

  if (cfg.target === "disk") {
    const dir = await loadUserSaveDirectory();
    if (!dir) return false;
    return writeCvJsonToUserFolder(dir, json, fileName);
  }

  return saveCvTemplateToOpfs(json, fileName);
}

export async function pickFolderElectron(): Promise<string | null> {
  if (!isElectronFileBridge() || !window.cvFiles) return null;
  const r = await window.cvFiles.pickFolder();
  if (!r.ok) return null;
  return r.path ?? null;
}
