const DB_NAME = "cv-buldier-user-folder";
const STORE_NAME = "kv";
const DIR_KEY = "save-directory";
import { DEFAULT_CV_FILE_NAME } from "./cv-save-config";

const DEFAULT_FILE = DEFAULT_CV_FILE_NAME;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
  });
}

export function isDirectoryPickerAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function loadUserSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const st = tx.objectStore(STORE_NAME);
      const g = st.get(DIR_KEY);
      g.onsuccess = () => resolve((g.result as FileSystemDirectoryHandle | undefined) ?? null);
      g.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function storeUserSaveDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put(handle, DIR_KEY);
  });
}

type DirPerm = FileSystemDirectoryHandle & {
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
};

async function ensureDirWritable(dir: FileSystemDirectoryHandle): Promise<boolean> {
  const d = dir as DirPerm;
  try {
    const opts = { mode: "readwrite" as const };
    if (typeof d.queryPermission === "function") {
      let p = await d.queryPermission(opts);
      if (p === "granted") return true;
      if (typeof d.requestPermission === "function") {
        p = await d.requestPermission(opts);
        return p === "granted";
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Odczyt pliku z folderu na dysku (bez tworzenia). */
export async function readCvJsonFromUserFolder(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string | null> {
  try {
    const fh = await dir.getFileHandle(fileName);
    const file = await fh.getFile();
    const text = await file.text();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

/** Zapis pliku JSON w wybranym przez użytkownika folderze. */
export async function writeCvJsonToUserFolder(
  dir: FileSystemDirectoryHandle,
  json: string,
  fileName = DEFAULT_FILE,
): Promise<boolean> {
  const ok = await ensureDirWritable(dir);
  if (!ok) return false;
  try {
    const fh = await dir.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    await w.write(json);
    await w.close();
    return true;
  } catch {
    return false;
  }
}

export const USER_CV_FILENAME = DEFAULT_FILE;

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};
