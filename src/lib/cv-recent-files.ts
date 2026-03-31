export const RECENT_FILES_STORAGE_KEY = "cv-buldier:recent-json-paths-v1";

export type RecentFileEntry = { path: string; name: string };

const MAX_RECENT = 3;

function safeParseList(raw: string | null): RecentFileEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is RecentFileEntry => {
        if (!x || typeof x !== "object") return false;
        const o = x as Record<string, unknown>;
        return typeof o.path === "string" && o.path.length > 0 && typeof o.name === "string";
      })
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function readRecentFiles(): RecentFileEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return safeParseList(localStorage.getItem(RECENT_FILES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeRecentFiles(entries: RecentFileEntry[]): RecentFileEntry[] {
  const next = entries.slice(0, MAX_RECENT);
  if (typeof window === "undefined") return next;
  try {
    localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

/** Dodaje ścieżkę na początku listy (max 3). Zwraca aktualną listę. */
export function pushRecentFile(absolutePath: string, displayName: string): RecentFileEntry[] {
  const pathNorm = absolutePath.trim();
  if (!pathNorm) return readRecentFiles();
  const name = displayName.trim() || pathNorm.split(/[/\\]/).pop() || "template.json";
  const rest = readRecentFiles().filter((e) => e.path !== pathNorm);
  return writeRecentFiles([{ path: pathNorm, name }, ...rest]);
}
