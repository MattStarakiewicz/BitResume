"use client";

import * as React from "react";
import Image from "next/image";
import { defaultCvTemplate, type CvData, type CvTemplate, type Locale, type SectionKey } from "../../data/cvData";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  BriefcaseBusiness,
  FolderGit2,
  FolderInput,
  Globe,
  GraduationCap,
  GripVertical,
  Moon,
  Plus,
  Save,
  Sun,
  SunMoon,
  Trash2,
  Upload,
  X,
  Mail,
  MapPin,
  Phone,
  Printer,
  Link2,
} from "lucide-react";
import type { ContactItem } from "../../data/cvData";
import { PhotoCropModal } from "@/components/photo-crop-modal";
import { CV_OPFS_DIRECTORY, isCvOpfsAvailable } from "@/lib/cv-app-storage";
import {
  DEFAULT_CV_FILE_NAME,
  loadSaveConfig,
  sanitizeTemplateFileName,
  storeSaveConfig,
  type CvSaveLocationConfig,
} from "@/lib/cv-save-config";
import {
  getElectronBundledCvDir,
  getElectronFullFilePath,
  isElectronFileBridge,
  pickFolderElectron,
  readCvJsonFromLocation,
  writeCvJsonToLocation,
} from "@/lib/cv-persistence";
import { pushRecentFile, readRecentFiles } from "@/lib/cv-recent-files";
import { migrateCvTemplate } from "@/lib/cv-template-migrate";
import {
  isDirectoryPickerAvailable,
  loadUserSaveDirectory,
  readCvJsonFromUserFolder,
  storeUserSaveDirectory,
  writeCvJsonToUserFolder,
} from "@/lib/cv-user-folder";

/** Zasoby z `public/` — przy file:// w Electron ścieżba `/x` wskazuje na zły katalog; wymuszamy `./x`. */
function resolvePublicAssetUrl(href: string | undefined | null): string {
  if (href == null || href === "") return "";
  const s = String(href);
  if (s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("./")) return s;
  if (s.startsWith("/")) return `.${s}`;
  return s;
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <h2 className="mb-2 flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-900">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.5} aria-hidden />
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    </h2>
  );
}

function renderInlineMarkdown(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return chunks.map((chunk, idx) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return (
        <strong key={`${chunk}-${idx}`} className="font-semibold [overflow-wrap:anywhere] text-slate-900">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${chunk}-${idx}`}>{chunk}</React.Fragment>;
  });
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const listItems = lines.filter((line) => line.startsWith("- "));
  if (listItems.length > 0 && listItems.length === lines.length) {
    return (
      <ul className="list-disc min-w-0 space-y-0.5 pl-4 text-[11px] leading-snug text-slate-700 [overflow-wrap:anywhere]">
        {listItems.map((item, idx) => (
          <li key={`${item}-${idx}`} className="min-w-0 [overflow-wrap:anywhere]">
            {renderInlineMarkdown(item.slice(2))}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="min-w-0 space-y-1 text-[11px] leading-snug text-slate-700 [overflow-wrap:anywhere]">
      {lines.map((line, idx) => (
        <p key={`${line}-${idx}`} className="min-w-0 [overflow-wrap:anywhere]">
          {renderInlineMarkdown(line)}
        </p>
      ))}
    </div>
  );
}

function EditableText({
  value,
  onChange,
  isEditMode,
  className,
  elementRef,
}: {
  value: string;
  onChange: (next: string) => void;
  isEditMode: boolean;
  className?: string;
  elementRef?: (node: HTMLSpanElement | null) => void;
}) {
  const internalRef = React.useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!internalRef.current) return;
    if (isFocused) return;
    if (internalRef.current.textContent !== value) {
      internalRef.current.textContent = value;
    }
  }, [isFocused, value]);

  return (
    <span
      ref={(node) => {
        internalRef.current = node;
        elementRef?.(node);
      }}
      contentEditable={isEditMode}
      suppressContentEditableWarning
      onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={`${className ?? ""} ${isEditMode ? "editable-text" : ""} ${isEditMode && isFocused ? "editable-text-focused" : ""}`}
    />
  );
}

const defaultSectionOrder: SectionKey[] = ["experience", "education", "projects", "trainings", "certifications"];

type CvViewMode = "web" | "print" | "mixed";

function cvModeWrapClass(mode: CvViewMode): string {
  if (mode === "web") return "web-mode";
  if (mode === "print") return "print-preview";
  return "cv-mixed-mode";
}
const contactKindOptions: Array<ContactItem["kind"]> = ["email", "phone", "linkedin", "website", "location"];

function ContactIcon({ kind }: { kind: ContactItem["kind"] }) {
  const cls = "mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400";
  if (kind === "email") return <Mail className={cls} strokeWidth={1.5} aria-hidden />;
  if (kind === "phone") return <Phone className={cls} strokeWidth={1.5} aria-hidden />;
  if (kind === "linkedin") return <Link2 className={cls} strokeWidth={1.5} aria-hidden />;
  if (kind === "website") return <Globe className={cls} strokeWidth={1.5} aria-hidden />;
  return <MapPin className={cls} strokeWidth={1.5} aria-hidden />;
}

function buildContactHref(kind: ContactItem["kind"], value: string): string | undefined {
  const clean = value.trim();
  if (!clean) return undefined;
  if (kind === "email") return `mailto:${clean.replace(/^mailto:/i, "")}`;
  if (kind === "phone") {
    const normalized = clean.replace(/\s+/g, "");
    return `tel:${normalized.replace(/^tel:/i, "")}`;
  }
  if (kind === "linkedin" || kind === "website") {
    if (/^https?:\/\//i.test(clean)) return clean;
    return `https://${clean}`;
  }
  return undefined;
}

function normalizeSectionOrder(order: unknown): SectionKey[] {
  if (!Array.isArray(order)) return defaultSectionOrder;
  const valid = order.filter((item): item is SectionKey => defaultSectionOrder.includes(item as SectionKey));
  return valid.filter((item, index) => valid.indexOf(item) === index);
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withItemIds(template: CvTemplate): CvTemplate {
  const enrich = (data: CvData): CvData => ({
    ...data,
    contacts: data.contacts.map((item) => ({ ...item, id: item.id ?? createId("contact") })),
    experience: data.experience.map((item) => ({ ...item, id: item.id ?? createId("exp") })),
    education: data.education.map((item) => ({ ...item, id: item.id ?? createId("edu") })),
    projects: data.projects.map((item) => ({ ...item, id: item.id ?? createId("project") })),
    trainings: data.trainings.map((item) => ({ ...item, id: item.id ?? createId("training") })),
    sectionOrder: normalizeSectionOrder(data.sectionOrder),
  });
  return {
    pl: enrich(template.pl),
    en: enrich(template.en),
  };
}

/** Last validated template (from JSON load or successful save); survives refresh in this browser. */
const LAST_TEMPLATE_STORAGE_KEY = "cv-buldier:last-template-v1";

function persistTemplateToLocalStorage(template: CvTemplate): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
  } catch {
    /* quota / private mode */
  }
}

type DragListKind = "contact" | "skill" | "lang" | "exp" | "edu" | "project" | "training" | "cert";

export default function Home() {
  const [viewMode, setViewMode] = React.useState<CvViewMode>("mixed");
  /** Ten sam stan na SSR i 1. klatce klienta — `loadSaveConfig()` w efekcie startowym. */
  const [saveLocation, setSaveLocation] = React.useState<CvSaveLocationConfig>({
    target: "opfs",
    fileName: DEFAULT_CV_FILE_NAME,
  });
  const [saveAsModalOpen, setSaveAsModalOpen] = React.useState(false);
  const [saveAsFileNameDraft, setSaveAsFileNameDraft] = React.useState(DEFAULT_CV_FILE_NAME);
  const [saveAsDiskPickerName, setSaveAsDiskPickerName] = React.useState<string | null>(null);
  const [electronBundledDir, setElectronBundledDir] = React.useState<string | null>(null);
  /** Po true można bezpiecznie używać ścieżek z Electron (unika rozjazdu SSR vs klient). */
  const [clientUiReady, setClientUiReady] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [pdfSaving, setPdfSaving] = React.useState(false);

  const [templateData, setTemplateData] = React.useState<CvTemplate>(() => withItemIds(defaultCvTemplate));
  const [documentFileLabel, setDocumentFileLabel] = React.useState(DEFAULT_CV_FILE_NAME);
  const [lastPersistedJson, setLastPersistedJson] = React.useState<string | null>(null);
  const [lang, setLang] = React.useState<Locale>("pl");
  const [skillFocusIndex, setSkillFocusIndex] = React.useState<number | null>(null);
  const [dragSkillIndex, setDragSkillIndex] = React.useState<number | null>(null);
  const [dragOverSkillIndex, setDragOverSkillIndex] = React.useState<number | null>(null);
  const [dragExpIndex, setDragExpIndex] = React.useState<number | null>(null);
  const [dragOverExpIndex, setDragOverExpIndex] = React.useState<number | null>(null);
  const [dragEduIndex, setDragEduIndex] = React.useState<number | null>(null);
  const [dragOverEduIndex, setDragOverEduIndex] = React.useState<number | null>(null);
  const [dragLangIndex, setDragLangIndex] = React.useState<number | null>(null);
  const [dragOverLangIndex, setDragOverLangIndex] = React.useState<number | null>(null);
  const [dragCertIndex, setDragCertIndex] = React.useState<number | null>(null);
  const [dragOverCertIndex, setDragOverCertIndex] = React.useState<number | null>(null);
  const [dragProjectIndex, setDragProjectIndex] = React.useState<number | null>(null);
  const [dragOverProjectIndex, setDragOverProjectIndex] = React.useState<number | null>(null);
  const [dragTrainingIndex, setDragTrainingIndex] = React.useState<number | null>(null);
  const [dragOverTrainingIndex, setDragOverTrainingIndex] = React.useState<number | null>(null);
  const [dragContactIndex, setDragContactIndex] = React.useState<number | null>(null);
  const [dragOverContactIndex, setDragOverContactIndex] = React.useState<number | null>(null);
  const activeDragKindRef = React.useRef<DragListKind | null>(null);

  const clearAllDragState = React.useCallback(() => {
    activeDragKindRef.current = null;
    setDragSkillIndex(null);
    setDragOverSkillIndex(null);
    setDragExpIndex(null);
    setDragOverExpIndex(null);
    setDragEduIndex(null);
    setDragOverEduIndex(null);
    setDragLangIndex(null);
    setDragOverLangIndex(null);
    setDragCertIndex(null);
    setDragOverCertIndex(null);
    setDragProjectIndex(null);
    setDragOverProjectIndex(null);
    setDragTrainingIndex(null);
    setDragOverTrainingIndex(null);
    setDragContactIndex(null);
    setDragOverContactIndex(null);
  }, []);

  React.useEffect(() => {
    if (isEditMode) return;
    clearAllDragState();
  }, [isEditMode, clearAllDragState]);

  const cvData = templateData[lang];
  const templateJsonSerialized = React.useMemo(() => JSON.stringify(templateData), [templateData]);
  const isDocumentDirty = lastPersistedJson !== null && templateJsonSerialized !== lastPersistedJson;
  const sectionOrder = React.useMemo(() => normalizeSectionOrder(cvData.sectionOrder), [cvData.sectionOrder]);
  const topSectionKey = sectionOrder[0];
  const hiddenSections = React.useMemo(
    () => defaultSectionOrder.filter((section) => !sectionOrder.includes(section)),
    [sectionOrder],
  );
  const [sectionToAdd, setSectionToAdd] = React.useState<SectionKey | "">("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [photoCropObjectUrl, setPhotoCropObjectUrl] = React.useState<string | null>(null);
  const skillRefs = React.useRef<Array<HTMLSpanElement | null>>([]);

  const updateCurrentLang = React.useCallback((updater: (current: CvData) => CvData) => {
    setTemplateData((prev) => ({
      ...prev,
      [lang]: updater(prev[lang]),
    }));
  }, [lang]);

  const commitSaveLocation = React.useCallback((cfg: CvSaveLocationConfig) => {
    const normalized: CvSaveLocationConfig = {
      target: cfg.target,
      fileName: sanitizeTemplateFileName(cfg.fileName),
      diskFolderName: cfg.target === "disk" ? cfg.diskFolderName?.trim() || undefined : undefined,
      diskFolderPath: cfg.target === "disk" ? cfg.diskFolderPath?.trim() || undefined : undefined,
    };
    storeSaveConfig(normalized);
    setSaveLocation(normalized);
  }, []);

  const persistToConfiguredLocation = React.useCallback(async (template: CvTemplate, cfg: CvSaveLocationConfig) => {
    const content = JSON.stringify(template, null, 2);
    persistTemplateToLocalStorage(template);
    await writeCvJsonToLocation(cfg, content);
  }, []);

  /** Ref: efekt bootstrap ma mieć stałą tablicę zależności ([]). */
  const persistToConfiguredLocationRef = React.useRef(persistToConfiguredLocation);
  persistToConfiguredLocationRef.current = persistToConfiguredLocation;

  const applyLoadedTemplateContent = React.useCallback(
    async (text: string, label: string, absolutePath: string | null) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        window.alert(lang === "pl" ? "Nieprawidłowy plik JSON." : "Invalid JSON file.");
        return;
      }
      const migrated = migrateCvTemplate(parsed);
      if (!migrated) {
        window.alert(
          lang === "pl"
            ? "Nieprawidłowy szablon CV: wymagany obiekt JSON z polem „pl” (dane jednej wersji językowej)."
            : "Invalid CV template: JSON must include a top-level “pl” object.",
        );
        return;
      }
      const next = withItemIds(migrated);
      setTemplateData(next);
      persistTemplateToLocalStorage(next);
      setDocumentFileLabel(label.trim() || DEFAULT_CV_FILE_NAME);
      setLastPersistedJson(JSON.stringify(next));
      if (absolutePath && isElectronFileBridge()) {
        const list = pushRecentFile(absolutePath, label);
        void window.cvFiles?.syncRecentFiles?.(list);
      }
      const cfg = loadSaveConfig();
      await persistToConfiguredLocation(next, cfg);
    },
    [lang, persistToConfiguredLocation],
  );

  React.useEffect(() => {
    setClientUiReady(true);
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const star = isDocumentDirty ? "* " : "";
    document.title = `${star}${documentFileLabel} — BitResume`;
  }, [documentFileLabel, isDocumentDirty]);

  React.useEffect(() => {
    if (!isElectronFileBridge() || !window.cvFiles?.setDocumentStatus) return;
    void window.cvFiles.setDocumentStatus({
      fileName: documentFileLabel,
      dirty: isDocumentDirty,
    });
  }, [documentFileLabel, isDocumentDirty]);

  React.useEffect(() => {
    if (!clientUiReady || !isElectronFileBridge() || !window.cvFiles?.syncRecentFiles) return;
    void window.cvFiles.syncRecentFiles(readRecentFiles());
  }, [clientUiReady]);

  React.useEffect(() => {
    if (!isElectronFileBridge() || !window.cvFiles?.subscribeTemplateFromPath) return;
    const unsub = window.cvFiles.subscribeTemplateFromPath((payload) => {
      if (!payload?.content) return;
      const p = payload.path?.trim() ?? "";
      void applyLoadedTemplateContent(payload.content, payload.name || DEFAULT_CV_FILE_NAME, p || null);
    });
    return unsub;
  }, [applyLoadedTemplateContent]);

  React.useEffect(() => {
    if (!isElectronFileBridge() || !window.cvFiles?.setUiLanguage) return;
    void window.cvFiles.setUiLanguage(lang);
  }, [lang]);

  React.useEffect(() => {
    if (!isElectronFileBridge()) return;
    void getElectronBundledCvDir().then(setElectronBundledDir);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const cfg = loadSaveConfig();
      if (!cancelled) setSaveLocation(cfg);

      const tryApplyTemplate = (raw: string | null): CvTemplate | null => {
        if (!raw || cancelled) return null;
        try {
          const parsed = JSON.parse(raw) as unknown;
          const migrated = migrateCvTemplate(parsed);
          if (!migrated) return null;
          const next = withItemIds(migrated);
          setTemplateData(next);
          persistTemplateToLocalStorage(next);
          return next;
        } catch {
          return null;
        }
      };

      const fileRaw = await readCvJsonFromLocation(cfg);
      const applied = tryApplyTemplate(fileRaw);
      if (applied) {
        if (!cancelled) {
          setDocumentFileLabel(sanitizeTemplateFileName(cfg.fileName));
          setLastPersistedJson(JSON.stringify(applied));
        }
        return;
      }

      /* Brak pliku lub niepoprawny JSON: ten sam szablon co w paczce / po instalacji (data/template.json). */
      const bundled = withItemIds(JSON.parse(JSON.stringify(defaultCvTemplate)) as CvTemplate);
      if (cancelled) return;
      setTemplateData(bundled);
      setDocumentFileLabel(sanitizeTemplateFileName(cfg.fileName));
      setLastPersistedJson(JSON.stringify(bundled));
      void persistToConfiguredLocationRef.current(bundled, cfg);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!saveAsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSaveAsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAsModalOpen]);

  React.useEffect(() => {
    if (isElectronFileBridge()) {
      setSaveAsDiskPickerName(null);
      return;
    }
    if (!saveAsModalOpen || saveLocation.target !== "disk") {
      setSaveAsDiskPickerName(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const dir = await loadUserSaveDirectory();
      if (!cancelled) setSaveAsDiskPickerName(dir?.name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [saveAsModalOpen, saveLocation.target]);

  const fallbackSaveToDiskFile = React.useCallback(
    async (content: string) => {
      const blob = new Blob([content], { type: "application/json" });
      const fileNameDefault = DEFAULT_CV_FILE_NAME;

      type SavePickerWindow = Window & {
        showSaveFilePicker?: (options: {
          suggestedName?: string;
          types?: Array<{ description: string; accept: Record<string, string[]> }>;
        }) => Promise<{
          createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
        }>;
      };

      const pickerWindow = window as SavePickerWindow;

      if (pickerWindow.showSaveFilePicker) {
        try {
          const handle = await pickerWindow.showSaveFilePicker({
            suggestedName: fileNameDefault,
            types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch {
          /* anulowano lub błąd */
        }
      }

      const fileName = window.prompt(lang === "pl" ? "Podaj nazwę pliku:" : "Enter file name:", fileNameDefault) ?? "";
      if (!fileName.trim()) return;
      const safeName = fileName.toLowerCase().endsWith(".json") ? fileName.trim() : `${fileName.trim()}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeName;
      a.click();
      URL.revokeObjectURL(url);
    },
    [lang],
  );

  /** Zapis do bieżącej lokalizacji (Electron: plik na dysku; przeglądarka: OPFS lub folder). */
  const handleQuickSave = React.useCallback(async () => {
    if (isElectronFileBridge()) {
      if (saveLocation.target === "disk" && !saveLocation.diskFolderPath?.trim()) {
        window.alert(
          lang === "pl"
            ? "Nie wybrano folderu na dysku. Otwórz „Zapisz jako” i wybierz folder (Folder na dysku…)."
            : "No disk folder selected. Open “Save as” and pick a folder (“Folder on disk…”).",
        );
        return;
      }
      await persistToConfiguredLocation(templateData, saveLocation);
      setLastPersistedJson(JSON.stringify(templateData));
      return;
    }
    if (saveLocation.target === "disk") {
      const dir = await loadUserSaveDirectory();
      if (!dir) {
        window.alert(
          lang === "pl"
            ? "Brak dostępu do folderu na dysku. Otwórz „Zapisz jako” i wybierz folder ponownie."
            : "Cannot access the disk folder. Open “Save as” and pick the folder again.",
        );
        return;
      }
    } else if (!isCvOpfsAvailable()) {
      window.alert(
        lang === "pl"
          ? "Pamięć aplikacji (OPFS) jest niedostępna w tej przeglądarce. Użyj „Zapisz jako” i wybierz folder na dysku."
          : "App storage (OPFS) is not available. Use “Save as” and choose a folder on disk.",
      );
      return;
    }
    await persistToConfiguredLocation(templateData, saveLocation);
    setLastPersistedJson(JSON.stringify(templateData));
  }, [lang, persistToConfiguredLocation, saveLocation, templateData]);

  const openSaveAsModal = React.useCallback(() => {
    setSaveAsFileNameDraft(saveLocation.fileName);
    setSaveAsModalOpen(true);
    if (isElectronFileBridge()) {
      void getElectronBundledCvDir().then(setElectronBundledDir);
    }
  }, [saveLocation.fileName]);

  /** Zapis w modalu: bieżąca lokalizacja, ewentualnie nowa nazwa pliku. */
  const handleSaveAsModalConfirm = React.useCallback(async () => {
    const fileName = sanitizeTemplateFileName(saveAsFileNameDraft);
    const nextCfg: CvSaveLocationConfig = { ...saveLocation, fileName };
    commitSaveLocation(nextCfg);
    await persistToConfiguredLocation(templateData, nextCfg);
    setDocumentFileLabel(fileName);
    setLastPersistedJson(JSON.stringify(templateData));
    setSaveAsModalOpen(false);
  }, [commitSaveLocation, persistToConfiguredLocation, saveAsFileNameDraft, saveLocation, templateData]);

  /** Folder na dysku: zapamiętanie, odczyt pliku jeśli istnieje, zapis bieżących danych. */
  const handleSaveAsPickDiskFolder = React.useCallback(async () => {
    if (isElectronFileBridge()) {
      try {
        const picked = await pickFolderElectron();
        if (!picked) return;
        const fileName = sanitizeTemplateFileName(saveAsFileNameDraft);
        const folderBasename = picked.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "";
        const tempCfg: CvSaveLocationConfig = {
          target: "disk",
          fileName,
          diskFolderPath: picked,
          diskFolderName: folderBasename,
        };
        const diskRaw = await readCvJsonFromLocation(tempCfg);
        let dataToWrite = templateData;
        if (diskRaw) {
          try {
            const parsed = JSON.parse(diskRaw) as unknown;
            const migrated = migrateCvTemplate(parsed);
            if (migrated) {
              const next = withItemIds(migrated);
              setTemplateData(next);
              persistTemplateToLocalStorage(next);
              dataToWrite = next;
            }
          } catch {
            /* zły JSON — zapisujemy to co było w edytorze */
          }
        }
        commitSaveLocation(tempCfg);
        const ok = await writeCvJsonToLocation(tempCfg, JSON.stringify(dataToWrite, null, 2));
        if (!ok) {
          window.alert(
            lang === "pl"
              ? "Nie udało się zapisać w wybranym folderze."
              : "Could not save to the selected folder.",
          );
        } else {
          setDocumentFileLabel(fileName);
          setLastPersistedJson(JSON.stringify(dataToWrite));
        }
        setSaveAsModalOpen(false);
      } catch {
        /* anulowano wybór folderu */
      }
      return;
    }
    if (!isDirectoryPickerAvailable()) {
      const content = JSON.stringify(templateData, null, 2);
      await fallbackSaveToDiskFile(content);
      return;
    }
    const pick = window.showDirectoryPicker;
    if (!pick) return;
    try {
      const dir = await pick.call(window);
      const fileName = sanitizeTemplateFileName(saveAsFileNameDraft);
      await storeUserSaveDirectory(dir);

      const diskRaw = await readCvJsonFromUserFolder(dir, fileName);
      let dataToWrite = templateData;
      if (diskRaw) {
        try {
          const parsed = JSON.parse(diskRaw) as unknown;
          const migrated = migrateCvTemplate(parsed);
          if (migrated) {
            const next = withItemIds(migrated);
            setTemplateData(next);
            persistTemplateToLocalStorage(next);
            dataToWrite = next;
          }
        } catch {
          /* zły JSON — zapisujemy to co było w edytorze */
        }
      }

      const nextCfg: CvSaveLocationConfig = { target: "disk", fileName, diskFolderName: dir.name };
      commitSaveLocation(nextCfg);
      const ok = await writeCvJsonToUserFolder(dir, JSON.stringify(dataToWrite, null, 2), fileName);
      if (!ok) {
        window.alert(
          lang === "pl"
            ? "Nie udało się zapisać w wybranym folderze."
            : "Could not save to the selected folder.",
        );
      } else {
        setDocumentFileLabel(fileName);
        setLastPersistedJson(JSON.stringify(dataToWrite));
      }
      setSaveAsModalOpen(false);
    } catch {
      /* anulowano wybór folderu */
    }
  }, [
    commitSaveLocation,
    fallbackSaveToDiskFile,
    lang,
    saveAsFileNameDraft,
    templateData,
  ]);

  const handleLoadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePhotoLoadClick = React.useCallback(() => {
    photoInputRef.current?.click();
  }, []);

  const handlePhotoFileLoad = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        window.alert(lang === "pl" ? "Wybierz plik obrazu." : "Please select an image file.");
        event.target.value = "";
        return;
      }
      setPhotoCropObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      event.target.value = "";
    },
    [lang],
  );

  const closePhotoCrop = React.useCallback(() => {
    setPhotoCropObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const applyPhotoCrop = React.useCallback(
    (dataUrl: string) => {
      updateCurrentLang((current) => ({
        ...current,
        profile: { ...current.profile, photoUrl: dataUrl },
      }));
      setPhotoCropObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    },
    [updateCurrentLang],
  );

  const handlePhotoRemove = React.useCallback(() => {
    updateCurrentLang((current) => ({
      ...current,
      profile: { ...current.profile, photoUrl: "./profile-placeholder.svg" },
    }));
  }, [updateCurrentLang]);

  const moveSkill = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      updateCurrentLang((current) => {
        const nextSkills = [...current.skills];
        const [moved] = nextSkills.splice(fromIndex, 1);
        nextSkills.splice(toIndex, 0, moved);
        return { ...current, skills: nextSkills };
      });
    },
    [updateCurrentLang],
  );

  const moveExperience = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      updateCurrentLang((current) => {
        const nextExperience = [...current.experience];
        const [moved] = nextExperience.splice(fromIndex, 1);
        nextExperience.splice(toIndex, 0, moved);
        return { ...current, experience: nextExperience };
      });
    },
    [updateCurrentLang],
  );

  const reorderList = React.useCallback(<T,>(list: T[], fromIndex: number, toIndex: number) => {
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }, []);

  const moveSection = React.useCallback(
    (section: SectionKey, direction: "up" | "down") => {
      updateCurrentLang((current) => {
        const currentOrder = normalizeSectionOrder(current.sectionOrder);
        const index = currentOrder.indexOf(section);
        if (index === -1) return current;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= currentOrder.length) return current;
        return { ...current, sectionOrder: reorderList(currentOrder, index, targetIndex) };
      });
    },
    [reorderList, updateCurrentLang],
  );

  const removeSection = React.useCallback(
    (section: SectionKey) => {
      updateCurrentLang((current) => {
        const currentOrder = normalizeSectionOrder(current.sectionOrder);
        if (!currentOrder.includes(section) || currentOrder.length <= 1) return current;
        return { ...current, sectionOrder: currentOrder.filter((item) => item !== section) };
      });
    },
    [updateCurrentLang],
  );

  const addSection = React.useCallback(
    (section: SectionKey) => {
      updateCurrentLang((current) => {
        const currentOrder = normalizeSectionOrder(current.sectionOrder);
        if (currentOrder.includes(section)) return current;
        return { ...current, sectionOrder: [...currentOrder, section] };
      });
    },
    [updateCurrentLang],
  );

  /** Druk/PDF w aktualnym trybie kolorystycznym (web/print/mixed). */
  const handlePrintToPdf = React.useCallback(async () => {
    if (pdfSaving) return;

    const useElectronPdf = isElectronFileBridge() && typeof window.cvFiles?.savePdf === "function";

    if (!useElectronPdf) {
      const wasEditing = isEditMode;
      setIsEditMode(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          if (wasEditing) setIsEditMode(true);
        });
      });
      return;
    }

    const wasEditing = isEditMode;
    setPdfSaving(true);
    try {
      setIsEditMode(false);
      await new Promise<void>((r) => setTimeout(r, 0));
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const raw = cvData.profile.fullName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim();
      const safeName = (raw.replace(/\s+/g, "_").slice(0, 80) || "CV") + ".pdf";

      const r = await window.cvFiles!.savePdf({ fileName: safeName });
      if (!r.ok) throw new Error(r.error);
    } catch (err) {
      console.error(err);
      window.alert(lang === "pl" ? "Nie udało się zapisać pliku PDF." : "Could not save PDF file.");
    } finally {
      if (wasEditing) setIsEditMode(true);
      setPdfSaving(false);
    }
  }, [cvData.profile.fullName, isEditMode, lang, pdfSaving]);

  React.useEffect(() => {
    if (!isElectronFileBridge() || !window.cvFiles?.subscribeMenuAction) return;
    const unsub = window.cvFiles.subscribeMenuAction((payload) => {
      const a = payload?.action;
      if (a === "save") void handleQuickSave();
      else if (a === "saveAs") openSaveAsModal();
      else if (a === "printPdf") void handlePrintToPdf();
    });
    return unsub;
  }, [handlePrintToPdf, handleQuickSave, openSaveAsModal]);

  React.useEffect(() => {
    if (skillFocusIndex === null) return;
    const node = skillRefs.current[skillFocusIndex];
    if (!node) return;
    node.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    setSkillFocusIndex(null);
  }, [cvData.skills.length, skillFocusIndex]);

  const handleFileLoad = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const fromBridge =
          typeof window.cvFiles?.getPathForFile === "function"
            ? window.cvFiles.getPathForFile(file)
            : "";
        const pathRaw =
          typeof fromBridge === "string" && fromBridge.trim()
            ? fromBridge.trim()
            : (file as File & { path?: string }).path;
        const filePath = typeof pathRaw === "string" && pathRaw.trim() ? pathRaw.trim() : null;
        await applyLoadedTemplateContent(text, file.name || DEFAULT_CV_FILE_NAME, filePath);
      } catch {
        window.alert(lang === "pl" ? "Nie udało się wczytać pliku." : "Could not load file.");
      } finally {
        event.target.value = "";
      }
    },
    [applyLoadedTemplateContent, lang],
  );

  const labels = React.useMemo(
    () => ({
      webMode: lang === "pl" ? "Tryb ciemny" : "Dark mode",
      printMode: lang === "pl" ? "Tryb jasny" : "Light mode",
      mixedMode: lang === "pl" ? "Tryb mieszany (jasna karta, kolorowe akcenty)" : "Mixed theme (light card, color accents)",
      editMode: lang === "pl" ? "Tryb edycji" : "Edit mode",
      printToPdf: lang === "pl" ? "Drukuj do pdf" : "Print to PDF",
      printToPdfBusy: lang === "pl" ? "Zapisywanie PDF…" : "Saving PDF…",
      printToPdfHint:
        lang === "pl"
          ? "Otwiera okno druku — jako drukarkę wybierz „Zapisz jako PDF” lub Microsoft Print to PDF."
          : "Opens the print dialog — choose “Save as PDF” or Microsoft Print to PDF.",
      printToPdfHintElectron:
        lang === "pl"
          ? "Zapis PDF (Chromium, bez tagów struktury — mniejsze zaznaczenia w Acrobat)."
          : "PDF via Chromium (no structure tags — cleaner selection in Acrobat).",
      save: lang === "pl" ? "Zapisz" : "Save",
      saveTemplate: lang === "pl" ? "Zapisz jako" : "Save as",
      saveHint: lang === "pl" ? "Zapis do ustawionej lokalizacji i nazwy pliku" : "Save to the configured location and file name",
      saveAsTitle: lang === "pl" ? "Zapisz jako" : "Save as",
      saveAsFileLabel: lang === "pl" ? "Nazwa pliku" : "File name",
      saveAsTargetLabel: lang === "pl" ? "Lokalizacja zapisu i domyślnego odczytu" : "Save and default load location",
      saveAsDiskFolder: lang === "pl" ? "Folder na dysku…" : "Folder on disk…",
      saveAsCurrentDisk: lang === "pl" ? "Folder na dysku" : "Disk folder",
      saveAsOpfsKind: lang === "pl" ? "Wbudowany katalog w przeglądarce (sandbox OPFS)" : "Built-in browser workspace (OPFS sandbox)",
      saveAsOpfsPathPrefix: lang === "pl" ? "Ścieżka robocza" : "Workspace path",
      saveAsElectronBundled:
        lang === "pl"
          ? "Domyślny katalog: Dokumenty → CV_Data"
          : "Default folder: Documents → CV_Data",
      saveAsElectronPathCaption: lang === "pl" ? "Pełna ścieżka pliku" : "Full file path",
      saveAsDiskKind: lang === "pl" ? "Wybrany folder na dysku" : "Folder on disk you granted access to",
      saveAsDiskPathNote:
        lang === "pl"
          ? "Pełnej ścieżki systemowej przeglądarka nie udostępnia — widać tylko nazwę folderu."
          : "Browsers do not expose the full file path; only the folder name is available.",
      saveAsDiskNoAccess: lang === "pl" ? "(brak zapisanego dostępu — wybierz folder ponownie)" : "(no saved access — pick the folder again)",
      saveAsSave: lang === "pl" ? "Zapisz" : "Save",
      saveAsCancel: lang === "pl" ? "Anuluj" : "Cancel",
      saveAsDiskHint:
        lang === "pl"
          ? "Przy starcie aplikacja wczytuje plik z tej samej lokalizacji co zapis. „Wczytaj szablon” pozwala jednorazowo wskazać inny plik z dowolnego miejsca."
          : "On startup the app loads from the same place you save to. “Load template” can one-off open a file from anywhere.",
      loadTemplate: lang === "pl" ? "Wczytaj szablon" : "Load template",
      editingFile: lang === "pl" ? "Edytujesz:" : "Editing:",
      uploadPhoto: lang === "pl" ? "Wgraj zdjęcie" : "Upload photo",
      removePhoto: lang === "pl" ? "Usuń" : "Remove",
      rodo: lang === "pl" ? "Klauzula RODO" : "GDPR clause",
      contact: lang === "pl" ? "Kontakt" : "Contact",
      skills: lang === "pl" ? "Umiejętności" : "Skills",
      spokenLanguages: lang === "pl" ? "Języki" : "Languages",
      experience: lang === "pl" ? "Doświadczenie zawodowe" : "Professional experience",
      education: lang === "pl" ? "Edukacja" : "Education",
      projects: lang === "pl" ? "Projekty" : "Projects",
      trainings: lang === "pl" ? "Szkolenia" : "Trainings",
      certificates: lang === "pl" ? "Certyfikaty" : "Certifications",
      addSection: lang === "pl" ? "Dodaj sekcję" : "Add section",
      removeSection: lang === "pl" ? "Usuń sekcję" : "Remove section",
      addSelectedSection: lang === "pl" ? "Dodaj" : "Add",
      chooseSectionToAdd: lang === "pl" ? "Wybierz sekcję" : "Choose section",
      noHiddenSections: lang === "pl" ? "Brak ukrytych sekcji" : "No hidden sections",
      present: lang === "pl" ? "obecnie" : "present",
      reorderAriaLabel: lang === "pl" ? "Przeciągnij, aby zmienić kolejność" : "Drag to reorder",
    }),
    [lang],
  );
  const sectionLabelsByKey = React.useMemo(
    () => ({
      experience: labels.experience,
      education: labels.education,
      projects: labels.projects,
      trainings: labels.trainings,
      certifications: labels.certificates,
    }),
    [labels.certificates, labels.education, labels.experience, labels.projects, labels.trainings],
  );

  const [printPdfTitle, setPrintPdfTitle] = React.useState(labels.printToPdfHint);
  React.useEffect(() => {
    setPrintPdfTitle(isElectronFileBridge() ? labels.printToPdfHintElectron : labels.printToPdfHint);
  }, [labels.printToPdfHint, labels.printToPdfHintElectron]);
  React.useEffect(() => {
    if (hiddenSections.length === 0) {
      setSectionToAdd("");
      return;
    }
    if (!sectionToAdd || !hiddenSections.includes(sectionToAdd)) {
      setSectionToAdd(hiddenSections[0]);
    }
  }, [hiddenSections, sectionToAdd]);

  const quickSaveTitle = React.useMemo(() => {
    const useElectronPath = clientUiReady && isElectronFileBridge();
    const pathSuffix = useElectronPath
      ? getElectronFullFilePath(saveLocation, electronBundledDir)
      : saveLocation.target === "opfs"
        ? `opfs:/${CV_OPFS_DIRECTORY}/${saveLocation.fileName}`
        : `${labels.saveAsCurrentDisk} «${saveLocation.diskFolderName ?? "?"}» / ${saveLocation.fileName}`;
    return `${labels.saveHint} — ${pathSuffix}`;
  }, [clientUiReady, electronBundledDir, labels.saveAsCurrentDisk, labels.saveHint, saveLocation]);

  /** Stałe szerokości toolbaru — brak „skakania” przy PL/EN (dłuższy wariant + zapas). */
  const toolbarMinW = React.useMemo(() => {
    const iconCh = 3.75;
    const pad = 2.35;
    const w = (pl: string, en: string, extra = 0) =>
      `${Math.max(pl.length, en.length) + extra + pad}ch` as const;
    return {
      editMode: w("Tryb edycji", "Edit mode"),
      save: w("Zapisz", "Save", iconCh),
      saveTemplate: w("Zapisz jako", "Save as", iconCh),
      loadTemplate: w("Wczytaj szablon", "Load template", iconCh),
      printToPdf: w("Drukuj do pdf", "Print to PDF", iconCh),
    };
  }, []);

  const photoCropLabels = React.useMemo(
    () =>
      lang === "pl"
        ? {
            title: "Kadruj zdjęcie",
            apply: "Zastosuj",
            cancel: "Anuluj",
            zoom: "Powiększenie",
            dragHint: "Przeciągnij obraz. Suwak lub kółko myszy zmienia przybliżenie.",
          }
        : {
            title: "Crop photo",
            apply: "Apply",
            cancel: "Cancel",
            zoom: "Zoom",
            dragHint: "Drag the image. Use the slider or mouse wheel to zoom.",
          },
    [lang],
  );

  const showSectionMoveControls = isEditMode;

  return (
    <div className={`${cvModeWrapClass(viewMode)} cv-mode-wrap min-h-screen w-full`}>
      <div className="mx-auto w-full min-w-0 max-w-[980px] px-2 py-3 sm:px-4 sm:py-4 print:p-0">
      <div className="no-print mb-3 flex flex-col gap-2 print:hidden">
        <div className="doc-file-status" title={`${documentFileLabel}${isDocumentDirty ? "*" : ""}`}>
          <span className="doc-file-status-label">{labels.editingFile}</span>
          <span className="flex min-w-0 flex-1 items-baseline gap-0.5">
            <span className="doc-file-status-name">{documentFileLabel}</span>
            {isDocumentDirty ? (
              <span className="doc-file-status-dirty" aria-label="— niezapisane zmiany">
                *
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex shrink-0 overflow-hidden rounded-md border cv-divider print:hidden">
          <button
            type="button"
            onClick={() => setLang("pl")}
            className={`toolbar-btn min-w-[2.5rem] justify-center px-2.5 py-1.5 text-center text-xs font-medium transition ${
              lang === "pl" ? "toolbar-btn-active" : "toolbar-btn-idle"
            }`}
          >
            PL
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`toolbar-btn min-w-[2.5rem] justify-center border-l cv-divider px-2.5 py-1.5 text-center text-xs font-medium transition ${
              lang === "en" ? "toolbar-btn-active" : "toolbar-btn-idle"
            }`}
          >
            EN
          </button>
        </div>
        <div className="inline-flex shrink-0 overflow-hidden rounded-md border cv-divider print:hidden">
          <button
            type="button"
            onClick={() => setViewMode("web")}
            style={{ minWidth: "2.75rem" }}
            title={labels.webMode}
            aria-label={labels.webMode}
            className={`toolbar-btn inline-flex items-center justify-center px-2 py-2 text-xs font-medium transition ${
              viewMode === "web" ? "toolbar-btn-active" : "toolbar-btn-idle"
            }`}
          >
            <Moon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("mixed")}
            style={{ minWidth: "2.75rem" }}
            title={labels.mixedMode}
            aria-label={labels.mixedMode}
            className={`toolbar-btn inline-flex items-center justify-center border-l cv-divider px-2 py-2 text-xs font-medium transition ${
              viewMode === "mixed" ? "toolbar-btn-active" : "toolbar-btn-idle"
            }`}
          >
            <SunMoon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("print")}
            style={{ minWidth: "2.75rem" }}
            title={labels.printMode}
            aria-label={labels.printMode}
            className={`toolbar-btn inline-flex items-center justify-center border-l cv-divider px-2 py-2 text-xs font-medium transition ${
              viewMode === "print" ? "toolbar-btn-active" : "toolbar-btn-idle"
            }`}
          >
            <Sun className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsEditMode((prev) => !prev)}
          style={{ minWidth: toolbarMinW.editMode }}
          className={`toolbar-btn inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border cv-divider px-2.5 py-1.5 text-center text-xs font-medium transition print:hidden ${
            isEditMode ? "toolbar-btn-active toolbar-btn-edit-on" : "toolbar-btn-idle"
          }`}
        >
          {labels.editMode}
        </button>
        <button
          type="button"
          onClick={() => void handleQuickSave()}
          style={{ minWidth: toolbarMinW.save }}
          title={quickSaveTitle}
          className="toolbar-btn toolbar-btn-idle inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border cv-divider px-2.5 py-1.5 text-xs font-medium transition print:hidden"
        >
          <Save className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
          {labels.save}
        </button>
        <button
          type="button"
          onClick={openSaveAsModal}
          style={{ minWidth: toolbarMinW.saveTemplate }}
          title={
            lang === "pl"
              ? "Ustaw lokalizację zapisu i nazwę pliku — stąd też domyślny odczyt przy starcie"
              : "Set save location and file name — also the default on startup"
          }
          className="toolbar-btn toolbar-btn-idle inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border cv-divider px-2.5 py-1.5 text-xs font-medium transition print:hidden"
        >
          <FolderInput className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
          {labels.saveTemplate}
        </button>
        <button
          type="button"
          onClick={handleLoadClick}
          style={{ minWidth: toolbarMinW.loadTemplate }}
          className="toolbar-btn toolbar-btn-idle inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border cv-divider px-2.5 py-1.5 text-xs font-medium transition print:hidden"
        >
          <Upload className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
          {labels.loadTemplate}
        </button>
        <button
          type="button"
          disabled={pdfSaving}
          aria-busy={pdfSaving}
          onClick={() => void handlePrintToPdf()}
          style={{ minWidth: toolbarMinW.printToPdf }}
          title={printPdfTitle}
          className="toolbar-btn toolbar-btn-idle inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border cv-divider px-2.5 py-1.5 text-xs font-medium transition print:hidden disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Printer className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
          {pdfSaving ? labels.printToPdfBusy : labels.printToPdf}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileLoad}
          className="hidden"
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoFileLoad}
          className="hidden"
        />
        </div>
      </div>

      <main
        className={`${cvModeWrapClass(viewMode)} ${
          isEditMode ? "edit-mode" : ""
        } print-sheet cv-sheet mt-1 w-full overflow-hidden rounded-xl border-[0.5px] border-slate-100 bg-white p-4 shadow-sm sm:mt-1.5 sm:p-6 print:w-[210mm] print:min-h-0 print:overflow-visible print:rounded-none print:border-0 print:p-0`}
      >
        <div className="cv-grid-print grid min-h-[297mm] w-full min-w-0 max-w-full grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] print:grid print:min-h-0 print:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <aside className="min-w-0 border-b border-[0.5px] border-slate-100 p-4 md:border-r md:border-b-0 print:border-r print:border-b-0 print:p-4">
            <div className="mb-5 flex items-center gap-3">
              <div className="relative size-[78px] min-h-[78px] min-w-[78px] shrink-0">
                <div className="cv-photo-frame relative size-full overflow-hidden rounded-2xl border border-slate-100">
                  <Image
                    src={resolvePublicAssetUrl(cvData.profile.photoUrl)}
                    alt={cvData.profile.fullName}
                    fill
                    sizes="78px"
                    className="object-cover object-center"
                    priority
                  />
                </div>
                {isEditMode ? (
                  <div className="no-print pointer-events-none absolute inset-0 rounded-2xl print:hidden">
                    <div className="pointer-events-auto absolute bottom-0 right-0 z-10 flex translate-x-px translate-y-px gap-0.5">
                      <button
                        type="button"
                        onClick={handlePhotoLoadClick}
                        title={labels.uploadPhoto}
                        aria-label={labels.uploadPhoto}
                        className="flex h-7 w-7 items-center justify-center rounded-full border cv-divider bg-white/95 text-zinc-900 shadow-sm backdrop-blur-sm dark:bg-zinc-900/95 dark:text-zinc-100"
                      >
                        <Upload className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.5} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={handlePhotoRemove}
                        title={labels.removePhoto}
                        aria-label={labels.removePhoto}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-red-400/80 bg-white/95 text-red-600 shadow-sm backdrop-blur-sm dark:bg-zinc-900/95"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="min-w-0 text-[16px] font-semibold leading-tight text-slate-900">
                  <EditableText
                    value={cvData.profile.fullName}
                    isEditMode={isEditMode}
                    onChange={(fullName) =>
                      updateCurrentLang((current) => ({
                        ...current,
                        profile: { ...current.profile, fullName },
                      }))
                    }
                  />
                </p>
                <p className="mt-1 min-w-0 text-[11px] leading-tight text-slate-600">
                  <EditableText
                    value={cvData.profile.title}
                    isEditMode={isEditMode}
                    onChange={(title) =>
                      updateCurrentLang((current) => ({
                        ...current,
                        profile: { ...current.profile, title },
                      }))
                    }
                  />
                </p>
              </div>
            </div>

            <p className="mb-4 min-w-0 text-[11px] leading-relaxed text-slate-700">
              <EditableText
                value={cvData.profile.summary}
                isEditMode={isEditMode}
                onChange={(summary) =>
                  updateCurrentLang((current) => ({
                    ...current,
                    profile: { ...current.profile, summary },
                  }))
                }
              />
            </p>

            <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <SectionTitle icon={Phone} label={labels.contact} />
              </div>
              {isEditMode ? (
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentLang((current) => ({
                      ...current,
                      contacts: [
                        ...current.contacts,
                        {
                          id: createId("contact"),
                          kind: "email",
                          label: "Email",
                          value: "",
                          href: "",
                        },
                      ],
                    }))
                  }
                  className="no-print inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border cv-divider text-[10px] font-semibold hover:bg-zinc-200/60 print:hidden"
                  aria-label="Dodaj kontakt"
                >
                  <Plus className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <ul className="cv-contact-list space-y-1.5 text-[11px] text-slate-700">
              {cvData.contacts.map((item, index) => (
                <li
                  key={item.id ?? `contact-${index}`}
                  onDragEnter={() =>
                    isEditMode && activeDragKindRef.current === "contact" && setDragOverContactIndex(index)
                  }
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "contact") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "contact" || dragContactIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    updateCurrentLang((current) => ({
                      ...current,
                      contacts: reorderList(current.contacts, dragContactIndex, index),
                    }));
                    clearAllDragState();
                  }}
                  className={`flex min-w-0 items-start gap-1 leading-tight transition-[transform,opacity,box-shadow] duration-100 ease-out ${
                    isEditMode && dragContactIndex === index ? "dragging-item" : ""
                  } ${
                    isEditMode && dragOverContactIndex === index && dragContactIndex !== index ? "drop-target-item" : ""
                  }`}
                >
                  <ContactIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    {isEditMode ? (
                      <div className="mb-1 flex flex-wrap items-center gap-1 no-print print:hidden">
                        {contactKindOptions.map((kindOption) => (
                          <button
                            key={`${item.id ?? index}-${kindOption}`}
                            type="button"
                            draggable={false}
                            onClick={() =>
                              updateCurrentLang((current) => ({
                                ...current,
                                contacts: current.contacts.map((contact, contactIndex) =>
                                  contactIndex === index
                                    ? {
                                        ...contact,
                                        kind: kindOption,
                                        href: buildContactHref(kindOption, contact.value),
                                      }
                                    : contact,
                                ),
                              }))
                            }
                            className={`rounded border cv-divider px-1.5 py-0.5 text-[9px] ${
                              item.kind === kindOption ? "toolbar-btn-active" : "toolbar-btn-idle"
                            }`}
                          >
                            {kindOption}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {buildContactHref(item.kind, item.value) && !isEditMode ? (
                      <a
                        href={buildContactHref(item.kind, item.value)}
                        className="break-all hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <EditableText
                        value={item.value}
                        isEditMode={isEditMode}
                        onChange={(value) =>
                          updateCurrentLang((current) => ({
                            ...current,
                            contacts: current.contacts.map((contact, contactIndex) =>
                              contactIndex === index
                                ? { ...contact, value, href: buildContactHref(contact.kind, value) }
                                : contact,
                            ),
                          }))
                        }
                      />
                    )}
                  </div>
                  {isEditMode ? (
                    <>
                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            contacts: current.contacts.filter((_, contactIndex) => contactIndex !== index),
                          }))
                        }
                        className="no-print mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-red-600 print:hidden"
                        aria-label="Usuń kontakt"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span
                        draggable={isEditMode}
                        onDragStart={(event) => {
                          if (!isEditMode) return;
                          activeDragKindRef.current = "contact";
                          setDragContactIndex(index);
                          setDragOverContactIndex(index);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", "contact");
                        }}
                        onDragEnd={() => {
                          clearAllDragState();
                        }}
                        className="no-print mt-0.5 shrink-0 cursor-grab touch-none select-none active:cursor-grabbing print:hidden"
                        aria-label={labels.reorderAriaLabel}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                      </span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="cv-section-rule my-5" aria-hidden />

            <SectionTitle icon={BriefcaseBusiness} label={labels.skills} />
            <div className="flex flex-wrap gap-1.5">
              {cvData.skills.map((skill, skillIndex) => (
                <span
                  key={`skill-${skillIndex}`}
                  onDragEnter={() =>
                    isEditMode && activeDragKindRef.current === "skill" && setDragOverSkillIndex(skillIndex)
                  }
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "skill") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "skill" || dragSkillIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    moveSkill(dragSkillIndex, skillIndex);
                    clearAllDragState();
                  }}
                  className={`skill-pill skill-pill-premium group relative inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 print:border-slate-200 print:bg-white print:text-slate-700 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact] ${
                    isEditMode && dragSkillIndex === skillIndex ? "skill-dragging" : ""
                  } ${
                    isEditMode && dragOverSkillIndex === skillIndex && dragSkillIndex !== skillIndex ? "skill-drop-target" : ""
                  }`}
                >
                  <EditableText
                    elementRef={(node) => {
                      skillRefs.current[skillIndex] = node;
                    }}
                    value={skill}
                    isEditMode={isEditMode}
                    className={`${isEditMode ? "skill-editable min-w-0 flex-1" : ""}`}
                    onChange={(nextSkill) =>
                      updateCurrentLang((current) => ({
                        ...current,
                        skills: current.skills.map((value, index) => (index === skillIndex ? nextSkill : value)),
                      }))
                    }
                  />
                  {isEditMode ? (
                    <>
                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            skills: current.skills.filter((_, index) => index !== skillIndex),
                          }))
                        }
                        className="skill-delete no-print hidden h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-[10px] text-red-600 group-hover:inline-flex print:hidden"
                        aria-label="Usuń umiejętność"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span
                        draggable={isEditMode}
                        onDragStart={(event) => {
                          if (!isEditMode) return;
                          activeDragKindRef.current = "skill";
                          setDragSkillIndex(skillIndex);
                          setDragOverSkillIndex(skillIndex);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", "skill");
                        }}
                        onDragEnd={() => {
                          clearAllDragState();
                        }}
                        className="no-print shrink-0 cursor-grab touch-none select-none active:cursor-grabbing print:hidden"
                        aria-label={labels.reorderAriaLabel}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                      </span>
                    </>
                  ) : null}
                </span>
              ))}
              {isEditMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setSkillFocusIndex(cvData.skills.length);
                    updateCurrentLang((current) => ({
                      ...current,
                      skills: [...current.skills, ""],
                    }));
                  }}
                  className="no-print inline-flex h-5 w-5 items-center justify-center rounded-full border cv-divider text-[10px] font-semibold hover:bg-zinc-200/60 print:hidden"
                  aria-label="Dodaj umiejętność"
                >
                  <Plus className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            <div className="cv-section-rule my-5" aria-hidden />

            <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <SectionTitle icon={GraduationCap} label={labels.spokenLanguages} />
              </div>
              {isEditMode ? (
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentLang((current) => ({
                      ...current,
                      languages: [...current.languages, ""],
                    }))
                  }
                  className="no-print inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border cv-divider text-[10px] font-semibold hover:bg-zinc-200/60 print:hidden"
                  aria-label="Dodaj język"
                >
                  <Plus className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <ul className="space-y-1 text-[11px] text-slate-700">
              {cvData.languages.map((language, languageIndex) => (
                <li
                  key={`language-${languageIndex}`}
                  onDragEnter={() =>
                    isEditMode && activeDragKindRef.current === "lang" && setDragOverLangIndex(languageIndex)
                  }
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "lang") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "lang" || dragLangIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    updateCurrentLang((current) => ({
                      ...current,
                      languages: reorderList(current.languages, dragLangIndex, languageIndex),
                    }));
                    clearAllDragState();
                  }}
                  className={`draggable-item flex min-w-0 items-start gap-1.5 ${
                    isEditMode && dragLangIndex === languageIndex ? "dragging-item" : ""
                  } ${
                    isEditMode && dragOverLangIndex === languageIndex && dragLangIndex !== languageIndex ? "drop-target-item" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <EditableText
                      value={language}
                      isEditMode={isEditMode}
                      onChange={(nextLanguage) =>
                        updateCurrentLang((current) => ({
                          ...current,
                          languages: current.languages.map((value, index) =>
                            index === languageIndex ? nextLanguage : value,
                          ),
                        }))
                      }
                    />
                  </div>
                  {isEditMode ? (
                    <>
                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            languages: current.languages.filter((_, index) => index !== languageIndex),
                          }))
                        }
                        className="no-print mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-red-600 print:hidden"
                        aria-label="Usuń język"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span
                        draggable={isEditMode}
                        onDragStart={(event) => {
                          if (!isEditMode) return;
                          activeDragKindRef.current = "lang";
                          setDragLangIndex(languageIndex);
                          setDragOverLangIndex(languageIndex);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", "lang");
                        }}
                        onDragEnd={() => {
                          clearAllDragState();
                        }}
                        className="no-print mt-0.5 shrink-0 cursor-grab touch-none select-none active:cursor-grabbing print:hidden"
                        aria-label={labels.reorderAriaLabel}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                      </span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-clip p-4 print:gap-3 print:p-4">
            {isEditMode ? (
              <div className="no-print -mb-1 flex flex-wrap items-center gap-1.5 print:hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{labels.addSection}:</span>
                <select
                  value={sectionToAdd}
                  onChange={(event) => setSectionToAdd(event.target.value as SectionKey | "")}
                  disabled={hiddenSections.length === 0}
                  className="toolbar-btn toolbar-btn-idle min-w-[10rem] rounded border cv-divider px-2 py-0.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={labels.addSection}
                >
                  {hiddenSections.length === 0 ? (
                    <option value="">{labels.noHiddenSections}</option>
                  ) : null}
                  {hiddenSections.length > 0 ? (
                    <option value="" disabled>
                      {labels.chooseSectionToAdd}
                    </option>
                  ) : null}
                  {hiddenSections.map((section) => (
                    <option key={`add-section-option-${section}`} value={section}>
                      {sectionLabelsByKey[section]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => sectionToAdd && addSection(sectionToAdd)}
                  disabled={!sectionToAdd}
                  className="toolbar-btn toolbar-btn-idle rounded border cv-divider px-2 py-0.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {labels.addSelectedSection}
                </button>
              </div>
            ) : null}
            {sectionOrder.includes("experience") ? (
            <div
              className={`section-order-block min-w-0 max-w-full overflow-x-clip ${topSectionKey === "experience" ? "" : "cv-section-rule pt-4"}`}
              style={{ order: sectionOrder.indexOf("experience") }}
            >
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <SectionTitle icon={BriefcaseBusiness} label={labels.experience} />
                </div>
                <div className="no-print flex shrink-0 items-center gap-1 print:hidden">
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentLang((current) => ({
                          ...current,
                          experience: [
                            ...current.experience,
                            {
                              id: createId("exp"),
                              role: "",
                              company: "",
                              location: "",
                              period: "",
                              bullets: [],
                              descriptionMd: "- ",
                            },
                          ],
                        }))
                      }
                      className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1"
                      aria-label="Dodaj doświadczenie"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  ) : null}
                  {showSectionMoveControls ? (
                    <>
                      <button type="button" onClick={() => moveSection("experience", "up")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => moveSection("experience", "down")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection("experience")}
                        className="toolbar-btn toolbar-btn-idle rounded border border-red-300 p-1 text-red-600"
                        title={`${labels.removeSection}: ${labels.experience}`}
                        aria-label={`${labels.removeSection}: ${labels.experience}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            <div className="min-w-0 space-y-6">
              {cvData.experience.map((job, jobIndex) => (
                <article
                  key={job.id ?? `experience-${jobIndex}`}
                  onDragEnter={() => {
                    if (isEditMode && activeDragKindRef.current === "exp") setDragOverExpIndex(jobIndex);
                  }}
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "exp") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "exp" || dragExpIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    moveExperience(dragExpIndex, jobIndex);
                    clearAllDragState();
                  }}
                  className={`experience-item min-w-0 max-w-full overflow-x-clip ${
                    isEditMode && dragExpIndex === jobIndex ? "experience-dragging" : ""
                  } ${
                    isEditMode && dragOverExpIndex === jobIndex && dragExpIndex !== jobIndex ? "experience-drop-target" : ""
                  }`}
                >
                  <div className="mb-1 grid grid-cols-[minmax(0,1fr)_minmax(0,min(12rem,38%))] items-start gap-x-2 gap-y-1">
                    <h3 className="min-w-0 max-w-full text-[13px] font-semibold [overflow-wrap:anywhere] text-slate-900">
                      <EditableText
                        value={job.role}
                        isEditMode={isEditMode}
                        onChange={(role) =>
                          updateCurrentLang((current) => ({
                            ...current,
                            experience: current.experience.map((item, index) =>
                              index === jobIndex ? { ...item, role } : item,
                            ),
                          }))
                        }
                      />{" "}
                      <span className="text-[11px] font-medium leading-snug [overflow-wrap:anywhere] text-slate-600">
                        @{" "}
                        <EditableText
                          value={job.company}
                          isEditMode={isEditMode}
                          onChange={(company) =>
                            updateCurrentLang((current) => ({
                              ...current,
                              experience: current.experience.map((item, index) =>
                                index === jobIndex ? { ...item, company } : item,
                              ),
                            }))
                          }
                        />
                      </span>
                    </h3>
                    <div className="flex min-w-0 w-full items-start justify-end gap-1 text-right">
                      <p className="min-w-0 max-w-full text-[10px] font-medium uppercase tracking-wide text-slate-500 [overflow-wrap:anywhere]">
                        <EditableText
                          value={job.period.replace("obecnie", labels.present)}
                          isEditMode={isEditMode}
                          onChange={(period) =>
                            updateCurrentLang((current) => ({
                              ...current,
                              experience: current.experience.map((item, index) =>
                                index === jobIndex ? { ...item, period } : item,
                              ),
                            }))
                          }
                        />
                      </p>
                      {isEditMode ? (
                        <>
                          <button
                            type="button"
                            draggable={false}
                            onClick={() =>
                              updateCurrentLang((current) => ({
                                ...current,
                                experience: current.experience.filter((_, index) => index !== jobIndex),
                              }))
                            }
                            className="no-print inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-red-600 print:hidden"
                            aria-label="Usuń doświadczenie"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                          <span
                            draggable={isEditMode}
                            onDragStart={(event) => {
                              if (!isEditMode) return;
                              activeDragKindRef.current = "exp";
                              setDragExpIndex(jobIndex);
                              setDragOverExpIndex(jobIndex);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", "exp");
                            }}
                            onDragEnd={() => {
                              clearAllDragState();
                            }}
                            className="no-print shrink-0 cursor-grab touch-none select-none active:cursor-grabbing print:hidden"
                            aria-label={labels.reorderAriaLabel}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="mb-1 min-w-0 text-[10px] text-slate-500">
                    <EditableText
                      value={job.location}
                      isEditMode={isEditMode}
                      onChange={(location) =>
                        updateCurrentLang((current) => ({
                          ...current,
                          experience: current.experience.map((item, index) =>
                            index === jobIndex ? { ...item, location } : item,
                          ),
                        }))
                      }
                    />
                  </p>
                  {isEditMode ? (
                    <textarea
                      value={job.descriptionMd ?? job.bullets.map((bullet) => `- ${bullet}`).join("\n")}
                      onChange={(event) =>
                        updateCurrentLang((current) => ({
                          ...current,
                          experience: current.experience.map((item, index) =>
                            index === jobIndex ? { ...item, descriptionMd: event.target.value } : item,
                          ),
                        }))
                      }
                      className="no-print mb-2 min-h-20 min-w-0 w-full max-w-full resize-y overflow-x-auto rounded-md border cv-divider bg-transparent p-2 text-[11px] leading-snug outline-none [overflow-wrap:anywhere]"
                      placeholder="- bullet point&#10;- **bold** text"
                    />
                  ) : null}
                  <MarkdownPreview markdown={job.descriptionMd ?? job.bullets.map((bullet) => `- ${bullet}`).join("\n")} />
                </article>
              ))}
            </div>
            </div>
            ) : null}

            {sectionOrder.includes("education") ? (
            <div
              className={`section-order-block min-w-0 max-w-full overflow-x-clip ${topSectionKey === "education" ? "" : "cv-section-rule pt-4"}`}
              style={{ order: sectionOrder.indexOf("education") }}
            >
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <SectionTitle icon={GraduationCap} label={labels.education} />
                </div>
                {showSectionMoveControls ? (
                  <div className="no-print flex shrink-0 items-center gap-1 print:hidden">
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            education: [...current.education, { id: createId("edu"), school: "", degree: "", period: "", notes: "" }],
                          }))
                        }
                        className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1"
                        aria-label="Dodaj edukację"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button type="button" onClick={() => moveSection("education", "up")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => moveSection("education", "down")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection("education")}
                      className="toolbar-btn toolbar-btn-idle rounded border border-red-300 p-1 text-red-600"
                      title={`${labels.removeSection}: ${labels.education}`}
                      aria-label={`${labels.removeSection}: ${labels.education}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            <div className="min-w-0 space-y-2">
              {cvData.education.map((edu, eduIndex) => (
                <article
                  key={edu.id ?? `education-${eduIndex}`}
                  onDragEnter={() =>
                    isEditMode && activeDragKindRef.current === "edu" && setDragOverEduIndex(eduIndex)
                  }
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "edu") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "edu" || dragEduIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    updateCurrentLang((current) => ({
                      ...current,
                      education: reorderList(current.education, dragEduIndex, eduIndex),
                    }));
                    clearAllDragState();
                  }}
                  className={`draggable-item relative min-w-0 max-w-full overflow-x-clip ${isEditMode ? "pr-16" : ""} ${
                    isEditMode && dragEduIndex === eduIndex ? "dragging-item" : ""
                  } ${
                    isEditMode && dragOverEduIndex === eduIndex && dragEduIndex !== eduIndex ? "drop-target-item" : ""
                  }`}
                >
                  {isEditMode ? (
                    <div className="no-print absolute right-0 top-0 z-[1] flex items-center gap-0.5 print:hidden">
                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            education: current.education.filter((_, index) => index !== eduIndex),
                          }))
                        }
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-red-600"
                        aria-label="Usuń edukację"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span
                        draggable={isEditMode}
                        onDragStart={(event) => {
                          if (!isEditMode) return;
                          activeDragKindRef.current = "edu";
                          setDragEduIndex(eduIndex);
                          setDragOverEduIndex(eduIndex);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", "edu");
                        }}
                        onDragEnd={() => {
                          clearAllDragState();
                        }}
                        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
                        aria-label={labels.reorderAriaLabel}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                      </span>
                    </div>
                  ) : null}
                  <p className="min-w-0 text-[12px] font-semibold text-slate-900">
                    <EditableText
                      value={edu.school}
                      isEditMode={isEditMode}
                      onChange={(school) =>
                        updateCurrentLang((current) => ({
                          ...current,
                          education: current.education.map((item, index) => (index === eduIndex ? { ...item, school } : item)),
                        }))
                      }
                    />
                  </p>
                  <p className="min-w-0 max-w-full text-[11px] [overflow-wrap:anywhere] text-slate-700">
                    <EditableText
                      value={edu.degree}
                      isEditMode={isEditMode}
                      onChange={(degree) =>
                        updateCurrentLang((current) => ({
                          ...current,
                          education: current.education.map((item, index) => (index === eduIndex ? { ...item, degree } : item)),
                        }))
                      }
                    />{" "}
                    |{" "}
                    <EditableText
                      value={edu.period}
                      isEditMode={isEditMode}
                      onChange={(period) =>
                        updateCurrentLang((current) => ({
                          ...current,
                          education: current.education.map((item, index) => (index === eduIndex ? { ...item, period } : item)),
                        }))
                      }
                    />
                  </p>
                  {edu.notes ? (
                    <p className="min-w-0 text-[10px] text-slate-600">
                      <EditableText
                        value={edu.notes}
                        isEditMode={isEditMode}
                        onChange={(notes) =>
                          updateCurrentLang((current) => ({
                            ...current,
                            education: current.education.map((item, index) => (index === eduIndex ? { ...item, notes } : item)),
                          }))
                        }
                      />
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
            </div>
            ) : null}

            {sectionOrder.includes("projects") ? (
            <div
              className={`section-order-block min-w-0 max-w-full overflow-x-clip ${topSectionKey === "projects" ? "" : "cv-section-rule pt-4"}`}
              style={{ order: sectionOrder.indexOf("projects") }}
            >
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <SectionTitle icon={FolderGit2} label={labels.projects} />
                </div>
                {showSectionMoveControls ? (
                  <div className="no-print flex shrink-0 items-center gap-1 print:hidden">
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            projects: [...current.projects, { id: createId("project"), name: "", period: "", description: "- ", link: "" }],
                          }))
                        }
                        className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1"
                        aria-label="Dodaj projekt"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button type="button" onClick={() => moveSection("projects", "up")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => moveSection("projects", "down")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection("projects")}
                      className="toolbar-btn toolbar-btn-idle rounded border border-red-300 p-1 text-red-600"
                      title={`${labels.removeSection}: ${labels.projects}`}
                      aria-label={`${labels.removeSection}: ${labels.projects}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            <div className="min-w-0 space-y-6">
              {cvData.projects.map((project, projectIndex) => (
                <article
                  key={project.id ?? `project-${projectIndex}`}
                  onDragEnter={() =>
                    isEditMode && activeDragKindRef.current === "project" && setDragOverProjectIndex(projectIndex)
                  }
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "project") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "project" || dragProjectIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    updateCurrentLang((current) => ({
                      ...current,
                      projects: reorderList(current.projects, dragProjectIndex, projectIndex),
                    }));
                    clearAllDragState();
                  }}
                  className={`experience-item min-w-0 max-w-full overflow-x-clip ${
                    isEditMode && dragProjectIndex === projectIndex ? "experience-dragging" : ""
                  } ${
                    isEditMode && dragOverProjectIndex === projectIndex && dragProjectIndex !== projectIndex
                      ? "drop-target-item"
                      : ""
                  }`}
                >
                  <div className="mb-1 grid grid-cols-[minmax(0,1fr)_minmax(0,min(12rem,38%))] items-start gap-x-2 gap-y-1">
                    <h3 className="min-w-0 max-w-full text-[13px] font-semibold [overflow-wrap:anywhere] text-slate-900">
                      <EditableText
                        value={project.name}
                        isEditMode={isEditMode}
                        onChange={(name) =>
                          updateCurrentLang((current) => ({
                            ...current,
                            projects: current.projects.map((item, index) => (index === projectIndex ? { ...item, name } : item)),
                          }))
                        }
                      />
                      {project.link?.trim() || isEditMode ? (
                        <span className="text-[11px] font-medium leading-snug [overflow-wrap:anywhere] text-slate-600">
                          {" "}
                          @{" "}
                          <EditableText
                            value={project.link ?? ""}
                            isEditMode={isEditMode}
                            onChange={(link) =>
                              updateCurrentLang((current) => ({
                                ...current,
                                projects: current.projects.map((item, index) => (index === projectIndex ? { ...item, link } : item)),
                              }))
                            }
                          />
                        </span>
                      ) : null}
                    </h3>
                    <div className="flex min-w-0 w-full items-start justify-end gap-1 text-right">
                      <p className="min-w-0 max-w-full text-[10px] font-medium uppercase tracking-wide text-slate-500 [overflow-wrap:anywhere]">
                        <EditableText
                          value={project.period}
                          isEditMode={isEditMode}
                          onChange={(period) =>
                            updateCurrentLang((current) => ({
                              ...current,
                              projects: current.projects.map((item, index) => (index === projectIndex ? { ...item, period } : item)),
                            }))
                          }
                        />
                      </p>
                      {isEditMode ? (
                        <>
                          <button
                            type="button"
                            draggable={false}
                            onClick={() =>
                              updateCurrentLang((current) => ({
                                ...current,
                                projects: current.projects.filter((_, index) => index !== projectIndex),
                              }))
                            }
                            className="no-print inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-red-600 print:hidden"
                            aria-label="Usuń projekt"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                          <span
                            draggable={isEditMode}
                            onDragStart={(event) => {
                              if (!isEditMode) return;
                              activeDragKindRef.current = "project";
                              setDragProjectIndex(projectIndex);
                              setDragOverProjectIndex(projectIndex);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", "project");
                            }}
                            onDragEnd={() => {
                              clearAllDragState();
                            }}
                            className="no-print shrink-0 cursor-grab touch-none select-none active:cursor-grabbing print:hidden"
                            aria-label={labels.reorderAriaLabel}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {isEditMode ? (
                    <textarea
                      value={project.description}
                      onChange={(event) =>
                        updateCurrentLang((current) => ({
                          ...current,
                          projects: current.projects.map((item, index) =>
                            index === projectIndex ? { ...item, description: event.target.value } : item,
                          ),
                        }))
                      }
                      className="no-print mb-2 min-h-20 min-w-0 w-full max-w-full resize-y overflow-x-auto rounded-md border cv-divider bg-transparent p-2 text-[11px] leading-snug outline-none [overflow-wrap:anywhere]"
                      placeholder="- bullet point&#10;- **bold** text"
                    />
                  ) : null}
                  <MarkdownPreview markdown={project.description} />
                </article>
              ))}
            </div>
            </div>
            ) : null}

            {sectionOrder.includes("trainings") ? (
            <div
              className={`section-order-block min-w-0 max-w-full overflow-x-clip ${topSectionKey === "trainings" ? "" : "cv-section-rule pt-4"}`}
              style={{ order: sectionOrder.indexOf("trainings") }}
            >
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <SectionTitle icon={BookOpen} label={labels.trainings} />
                </div>
                {showSectionMoveControls ? (
                  <div className="no-print flex shrink-0 items-center gap-1 print:hidden">
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            trainings: [...current.trainings, { id: createId("training"), title: "", provider: "", year: "" }],
                          }))
                        }
                        className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1"
                        aria-label="Dodaj szkolenie"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button type="button" onClick={() => moveSection("trainings", "up")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => moveSection("trainings", "down")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection("trainings")}
                      className="toolbar-btn toolbar-btn-idle rounded border border-red-300 p-1 text-red-600"
                      title={`${labels.removeSection}: ${labels.trainings}`}
                      aria-label={`${labels.removeSection}: ${labels.trainings}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            <ul className="list-disc min-w-0 max-w-full space-y-1 pl-4 text-[11px] leading-tight text-slate-700">
              {cvData.trainings.map((training, trainingIndex) => (
                <li
                  key={training.id ?? `training-${trainingIndex}`}
                  onDragEnter={() =>
                    isEditMode && activeDragKindRef.current === "training" && setDragOverTrainingIndex(trainingIndex)
                  }
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "training") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "training" || dragTrainingIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    updateCurrentLang((current) => ({
                      ...current,
                      trainings: reorderList(current.trainings, dragTrainingIndex, trainingIndex),
                    }));
                    clearAllDragState();
                  }}
                  className={`relative min-w-0 leading-tight draggable-item marker:text-slate-400 ${isEditMode ? "pr-16" : ""} ${
                    isEditMode && dragTrainingIndex === trainingIndex ? "dragging-item" : ""
                  } ${
                    isEditMode && dragOverTrainingIndex === trainingIndex && dragTrainingIndex !== trainingIndex
                      ? "drop-target-item"
                      : ""
                  }`}
                >
                  {isEditMode ? (
                    <div className="no-print absolute right-0 top-0 z-[1] flex items-center gap-0.5 print:hidden">
                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            trainings: current.trainings.filter((_, index) => index !== trainingIndex),
                          }))
                        }
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-red-600"
                        aria-label="Usuń szkolenie"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span
                        draggable={isEditMode}
                        onDragStart={(event) => {
                          if (!isEditMode) return;
                          activeDragKindRef.current = "training";
                          setDragTrainingIndex(trainingIndex);
                          setDragOverTrainingIndex(trainingIndex);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", "training");
                        }}
                        onDragEnd={() => {
                          clearAllDragState();
                        }}
                        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
                        aria-label={labels.reorderAriaLabel}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                      </span>
                    </div>
                  ) : null}
                  <EditableText
                    value={training.title}
                    isEditMode={isEditMode}
                    onChange={(title) =>
                      updateCurrentLang((current) => ({
                        ...current,
                        trainings: current.trainings.map((item, index) => (index === trainingIndex ? { ...item, title } : item)),
                      }))
                    }
                  />{" "}
                  -{" "}
                  <EditableText
                    value={training.provider}
                    isEditMode={isEditMode}
                    onChange={(provider) =>
                      updateCurrentLang((current) => ({
                        ...current,
                        trainings: current.trainings.map((item, index) =>
                          index === trainingIndex ? { ...item, provider } : item,
                        ),
                      }))
                    }
                  />{" "}
                  (
                  <EditableText
                    value={training.year}
                    isEditMode={isEditMode}
                    onChange={(year) =>
                      updateCurrentLang((current) => ({
                        ...current,
                        trainings: current.trainings.map((item, index) => (index === trainingIndex ? { ...item, year } : item)),
                      }))
                    }
                  />
                  )
                </li>
              ))}
            </ul>
            </div>
            ) : null}

            {sectionOrder.includes("certifications") ? (
            <div
              className={`section-order-block min-w-0 max-w-full overflow-x-clip ${topSectionKey === "certifications" ? "" : "cv-section-rule pt-4"}`}
              style={{ order: sectionOrder.indexOf("certifications") }}
            >
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <SectionTitle icon={GraduationCap} label={labels.certificates} />
                </div>
                {showSectionMoveControls ? (
                  <div className="no-print flex shrink-0 items-center gap-1 print:hidden">
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            certifications: [...current.certifications, ""],
                          }))
                        }
                        className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1"
                        aria-label="Dodaj certyfikat"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button type="button" onClick={() => moveSection("certifications", "up")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => moveSection("certifications", "down")} className="toolbar-btn toolbar-btn-idle rounded border cv-divider p-1">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection("certifications")}
                      className="toolbar-btn toolbar-btn-idle rounded border border-red-300 p-1 text-red-600"
                      title={`${labels.removeSection}: ${labels.certificates}`}
                      aria-label={`${labels.removeSection}: ${labels.certificates}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            <ul className="list-disc min-w-0 max-w-full space-y-1 pl-4 text-[11px] leading-tight text-slate-700">
              {cvData.certifications.map((certificate, certIndex) => (
                <li
                  key={`cert-${certIndex}`}
                  onDragEnter={() =>
                    isEditMode && activeDragKindRef.current === "cert" && setDragOverCertIndex(certIndex)
                  }
                  onDragOver={(event) => {
                    if (!isEditMode || activeDragKindRef.current !== "cert") return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!isEditMode) return;
                    event.preventDefault();
                    if (activeDragKindRef.current !== "cert" || dragCertIndex === null) {
                      clearAllDragState();
                      return;
                    }
                    updateCurrentLang((current) => ({
                      ...current,
                      certifications: reorderList(current.certifications, dragCertIndex, certIndex),
                    }));
                    clearAllDragState();
                  }}
                  className={`relative min-w-0 leading-tight draggable-item marker:text-slate-400 ${isEditMode ? "pr-16" : ""} ${
                    isEditMode && dragCertIndex === certIndex ? "dragging-item" : ""
                  } ${
                    isEditMode && dragOverCertIndex === certIndex && dragCertIndex !== certIndex ? "drop-target-item" : ""
                  }`}
                >
                  {isEditMode ? (
                    <div className="no-print absolute right-0 top-0 z-[1] flex items-center gap-0.5 print:hidden">
                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          updateCurrentLang((current) => ({
                            ...current,
                            certifications: current.certifications.filter((_, index) => index !== certIndex),
                          }))
                        }
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 bg-white text-red-600"
                        aria-label="Usuń certyfikat"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                      <span
                        draggable={isEditMode}
                        onDragStart={(event) => {
                          if (!isEditMode) return;
                          activeDragKindRef.current = "cert";
                          setDragCertIndex(certIndex);
                          setDragOverCertIndex(certIndex);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", "cert");
                        }}
                        onDragEnd={() => {
                          clearAllDragState();
                        }}
                        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
                        aria-label={labels.reorderAriaLabel}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} aria-hidden />
                      </span>
                    </div>
                  ) : null}
                  <EditableText
                    value={certificate}
                    isEditMode={isEditMode}
                    onChange={(nextCertificate) =>
                      updateCurrentLang((current) => ({
                        ...current,
                        certifications: current.certifications.map((value, index) =>
                          index === certIndex ? nextCertificate : value,
                        ),
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
            </div>
            ) : null}
          </section>
        </div>
        <footer className="cv-section-rule mt-3 pt-2 print-footer">
          <p className="min-w-0 text-[9px] leading-tight text-slate-600">
            <span className="mr-1 font-semibold text-slate-900">{labels.rodo}:</span>
            <EditableText
              value={cvData.footer.rodoClause}
              isEditMode={isEditMode}
              onChange={(rodoClause) =>
                updateCurrentLang((current) => ({
                  ...current,
                  footer: { ...current.footer, rodoClause },
                }))
              }
            />
          </p>
        </footer>
      </main>
      </div>
      {saveAsModalOpen ? (
        <div
          role="presentation"
          className="no-print fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 print:hidden"
          onClick={() => setSaveAsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-as-title"
            className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="save-as-title" className="text-sm font-semibold text-slate-900">
              {labels.saveAsTitle}
            </h3>
            <div className="mt-2 space-y-1.5 rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs text-slate-700">
              <p className="font-medium text-slate-800">{labels.saveAsTargetLabel}</p>
              {isElectronFileBridge() ? (
                <>
                  <p className="leading-snug">
                    {saveLocation.target === "opfs" ? labels.saveAsElectronBundled : labels.saveAsDiskKind}
                  </p>
                  <p className="text-[11px] font-medium text-slate-600">{labels.saveAsElectronPathCaption}</p>
                  <p className="break-all font-mono text-[11px] leading-snug text-slate-800">
                    <span className="select-all">
                      {getElectronFullFilePath(
                        {
                          ...saveLocation,
                          fileName: sanitizeTemplateFileName(saveAsFileNameDraft),
                        },
                        electronBundledDir,
                      )}
                    </span>
                  </p>
                </>
              ) : saveLocation.target === "opfs" ? (
                <>
                  <p className="leading-snug">{labels.saveAsOpfsKind}</p>
                  <p className="font-mono text-[11px] leading-snug text-slate-800">
                    {labels.saveAsOpfsPathPrefix}:{" "}
                    <span className="select-all">opfs:/{CV_OPFS_DIRECTORY}/</span>
                  </p>
                  <p className="font-mono text-[11px] leading-snug text-slate-800">
                    {labels.saveAsFileLabel}:{" "}
                    <span className="select-all">{sanitizeTemplateFileName(saveAsFileNameDraft)}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="leading-snug">{labels.saveAsDiskKind}</p>
                  <p className="font-mono text-[11px] leading-snug text-slate-800">
                    {saveAsDiskPickerName ?? saveLocation.diskFolderName ? (
                      <span className="select-all">
                        …/{saveAsDiskPickerName ?? saveLocation.diskFolderName}/
                      </span>
                    ) : (
                      <span className="text-amber-800">{labels.saveAsDiskNoAccess}</span>
                    )}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-500">{labels.saveAsDiskPathNote}</p>
                  <p className="font-mono text-[11px] leading-snug text-slate-800">
                    {labels.saveAsFileLabel}:{" "}
                    <span className="select-all">{sanitizeTemplateFileName(saveAsFileNameDraft)}</span>
                  </p>
                </>
              )}
            </div>
            <label htmlFor="save-as-filename" className="mt-4 block text-xs font-medium text-slate-700">
              {labels.saveAsFileLabel}
            </label>
            <input
              id="save-as-filename"
              type="text"
              value={saveAsFileNameDraft}
              onChange={(e) => setSaveAsFileNameDraft(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              autoComplete="off"
            />
            <p className="mt-3 text-[11px] leading-snug text-slate-500">{labels.saveAsDiskHint}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setSaveAsModalOpen(false)}
                className="order-last rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 sm:order-none"
              >
                {labels.saveAsCancel}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAsPickDiskFolder()}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                {labels.saveAsDiskFolder}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAsModalConfirm()}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {labels.saveAsSave}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {photoCropObjectUrl ? (
        <PhotoCropModal
          imageSrc={photoCropObjectUrl}
          labels={photoCropLabels}
          onCancel={closePhotoCrop}
          onComplete={applyPhotoCrop}
        />
      ) : null}
    </div>
  );
}
