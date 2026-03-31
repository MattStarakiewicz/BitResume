const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const isDev = process.env.ELECTRON_DEV === "1";
const isMac = process.platform === "darwin";

const packageJson = require("../package.json");
const APP_VERSION = packageJson.version ?? "0.8.1-beta";
const APP_DISPLAY_NAME = "BitResume";
const APP_NAME_WITH_VERSION = `${APP_DISPLAY_NAME} ${APP_VERSION}`;

const DEFAULT_TEMPLATE_FILE = "template.json";

/** Ostatnio otwarte szablony JSON — synchronizacja z localStorage renderera (max 3). */
let recentTemplateEntries = [];

/** Domyślny katalog danych CV w folderze Dokumenty użytkownika, tworzony przy pierwszym użyciu. */
function getDefaultCvDataDir() {
  return path.join(app.getPath("documents"), "CV_Data");
}

function getBundledTemplatePath() {
  return isDev
    ? path.join(__dirname, "../data/template.json")
    : path.join(process.resourcesPath, DEFAULT_TEMPLATE_FILE);
}

/**
 * Fabryczny szablon sprzed rozbudowy (jedna pozycja doświadczenia „Stanowisko” / placeholder PL+EN).
 * Zamieniamy na wersję z paczki przy starcie, żeby po aktualizacji instalacji nie zostawał stary JSON.
 */
function isLegacyMinimalTemplate(obj) {
  try {
    const pl = obj?.pl;
    const en = obj?.en;
    if (!pl || !en || typeof pl !== "object" || typeof en !== "object") return false;
    if (pl.profile?.fullName !== "Imię Nazwisko") return false;
    if (en.profile?.fullName !== "Your Name") return false;
    const sk = pl.skills;
    if (Array.isArray(sk) && sk.length === 5 && sk[0] === "Umiejętność 1") return true;
    const ex = pl.experience;
    if (Array.isArray(ex) && ex.length === 1 && ex[0]?.role === "Stanowisko") return true;
    return false;
  } catch {
    return false;
  }
}

/** Brak pliku, uszkodzony JSON albo rozpoznany stary szablon → kopia z resources; istniejący plik → backup .backup-<timestamp>. */
async function seedOrUpgradeUserTemplateFromBundle() {
  const userDir = await ensureDefaultCvDir();
  const dest = path.join(userDir, DEFAULT_TEMPLATE_FILE);
  const bundled = getBundledTemplatePath();

  let shouldWrite = false;
  let backupExisting = false;

  try {
    await fs.access(dest);
    const userText = await fs.readFile(dest, "utf8");
    let userJson;
    try {
      userJson = JSON.parse(userText);
    } catch {
      shouldWrite = true;
      backupExisting = true;
    }
    if (!shouldWrite && isLegacyMinimalTemplate(userJson)) {
      shouldWrite = true;
      backupExisting = true;
    }
  } catch {
    shouldWrite = true;
    backupExisting = false;
  }

  if (!shouldWrite) return;

  try {
    const text = await fs.readFile(bundled, "utf8");
    if (backupExisting) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const bak = path.join(userDir, `template.json.backup-${stamp}`);
      try {
        await fs.copyFile(dest, bak);
      } catch (e) {
        console.warn("BitResume: could not backup template.json before upgrade", e);
      }
    }
    await fs.writeFile(dest, text, "utf8");
  } catch (e) {
    console.error("BitResume: could not seed/upgrade template.json", e);
  }
}

function getWindowIconPath() {
  const candidates = [
    path.join(__dirname, "app-icon.ico"),
    path.join(__dirname, "app-icon.png"),
    path.join(__dirname, "../public/bitresume-certificate.png"),
  ];
  for (const p of candidates) {
    try {
      if (fsSync.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function sanitizeTemplateFileName(input) {
  let s = String(input ?? "")
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

function resolveSafeFilePath(dir, fileName) {
  const safeName = sanitizeTemplateFileName(fileName);
  const base = path.resolve(dir);
  const full = path.resolve(base, safeName);
  const rel = path.relative(base, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid file path");
  }
  return full;
}

async function ensureDefaultCvDir() {
  const dir = getDefaultCvDataDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function resolveDir(folderPath) {
  if (folderPath == null || folderPath === "") {
    return ensureDefaultCvDir();
  }
  return Promise.resolve(path.resolve(folderPath));
}

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let helpWindow = null;
/** @type {BrowserWindow | null} */
let aboutAuthorWindow = null;
/** @type {BrowserWindow | null} */
let licenseWindow = null;
/** @type {"pl" | "en"} */
let currentUiLanguage = "en";

function normalizeUiLanguage(input) {
  return input === "pl" ? "pl" : "en";
}

function uiText() {
  if (currentUiLanguage === "pl") {
    return {
      appMenu: "BitResume",
      file: "Plik",
      edit: "Edycja",
      view: "Widok",
      help: "Pomoc",
      quit: "Zakończ",
      undo: "Cofnij",
      redo: "Ponów",
      cut: "Wytnij",
      copy: "Kopiuj",
      paste: "Wklej",
      selectAll: "Zaznacz wszystko",
      reload: "Odśwież",
      fullscreen: "Pełny ekran",
      devtools: "Narzędzia deweloperskie",
      helpDoc: "Instrukcja obsługi",
      recentFiles: "Ostatnio otwarte",
      recentEmpty: "(brak)",
      openTemplate: "Otwórz szablon…",
      openTemplateDialogTitle: "Wybierz szablon JSON",
      saveFile: "Zapisz",
      saveFileAs: "Zapisz jako",
      printToPdfMenu: "Drukuj do PDF",
      licenseThirdParty: "Licencja i komponenty stron trzecich",
      aboutAuthor: "O autorze",
      aboutApp: `O programie ${APP_DISPLAY_NAME}`,
      aboutAppMac: `O programie ${APP_DISPLAY_NAME}`,
      helpWindowTitle: `Instrukcja obsługi — ${APP_DISPLAY_NAME}`,
      authorWindowTitle: `O autorze — ${APP_DISPLAY_NAME}`,
      licenseWindowTitle: `Licencja — ${APP_DISPLAY_NAME}`,
      aboutDialogTitle: `O programie — ${APP_NAME_WITH_VERSION}`,
      aboutDialogDetail:
        "Edytor CV z dwiema wersjami językowymi w jednym szablonie, zapisem do pliku JSON i eksportem do PDF.\n\n" +
        "Pomoc: menu Pomoc -> Instrukcja obsługi.",
      ok: "OK",
      helpFile: "help.html",
      authorFile: "about-author.html",
      licenseFile: "license.html",
    };
  }

  return {
    appMenu: "BitResume",
    file: "File",
    edit: "Edit",
    view: "View",
    help: "Help",
    quit: "Quit",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select All",
    reload: "Reload",
    fullscreen: "Toggle Full Screen",
    devtools: "Toggle Developer Tools",
    helpDoc: "Documentation",
      recentFiles: "Recent files",
      recentEmpty: "(none)",
      openTemplate: "Open template…",
      openTemplateDialogTitle: "Choose JSON template",
      saveFile: "Save",
      saveFileAs: "Save as",
      printToPdfMenu: "Print to PDF",
    licenseThirdParty: "License & third-party components",
    aboutAuthor: "About author",
    aboutApp: `About ${APP_DISPLAY_NAME}`,
    aboutAppMac: `About ${APP_DISPLAY_NAME}`,
    helpWindowTitle: `Documentation — ${APP_DISPLAY_NAME}`,
    authorWindowTitle: `About author — ${APP_DISPLAY_NAME}`,
    licenseWindowTitle: `License — ${APP_DISPLAY_NAME}`,
    aboutDialogTitle: `About — ${APP_NAME_WITH_VERSION}`,
    aboutDialogDetail:
      "CV editor with two language versions in one template, JSON file save, and PDF export.\n\n" +
      "Help: Help menu -> Documentation.",
    ok: "OK",
    helpFile: "help.en.html",
    authorFile: "about-author.en.html",
    licenseFile: "license.en.html",
  };
}

function attachExternalLinks(win) {
  win.webContents.setWindowOpenHandler((details) => {
    const url = details.url;
    if (url.startsWith("http:") || url.startsWith("https:")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

function openHelpWindow() {
  const t = uiText();
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.setTitle(t.helpWindowTitle);
    helpWindow.loadFile(path.join(__dirname, t.helpFile));
    helpWindow.focus();
    return;
  }
  helpWindow = new BrowserWindow({
    title: t.helpWindowTitle,
    width: 640,
    height: 720,
    minWidth: 480,
    minHeight: 400,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  attachExternalLinks(helpWindow);
  helpWindow.loadFile(path.join(__dirname, t.helpFile));
  helpWindow.on("closed", () => {
    helpWindow = null;
  });
}

function openAboutAuthorWindow() {
  const t = uiText();
  if (aboutAuthorWindow && !aboutAuthorWindow.isDestroyed()) {
    aboutAuthorWindow.setTitle(t.authorWindowTitle);
    aboutAuthorWindow.loadFile(path.join(__dirname, t.authorFile));
    aboutAuthorWindow.focus();
    return;
  }
  aboutAuthorWindow = new BrowserWindow({
    title: t.authorWindowTitle,
    width: 420,
    height: 360,
    resizable: true,
    minimizable: true,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  attachExternalLinks(aboutAuthorWindow);
  aboutAuthorWindow.loadFile(path.join(__dirname, t.authorFile));
  aboutAuthorWindow.on("closed", () => {
    aboutAuthorWindow = null;
  });
}

function openLicenseWindow() {
  const t = uiText();
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.setTitle(t.licenseWindowTitle);
    licenseWindow.loadFile(path.join(__dirname, t.licenseFile));
    licenseWindow.focus();
    return;
  }
  licenseWindow = new BrowserWindow({
    title: t.licenseWindowTitle,
    width: 640,
    height: 720,
    minWidth: 480,
    minHeight: 400,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  attachExternalLinks(licenseWindow);
  licenseWindow.loadFile(path.join(__dirname, t.licenseFile));
  licenseWindow.on("closed", () => {
    licenseWindow = null;
  });
}

async function readAndSendTemplateToRenderer(filePath, displayName) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!win || win.isDestroyed()) return;
    const name =
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : path.basename(filePath);
    win.webContents.send("cv-template-from-path", {
      path: filePath,
      name,
      content: text,
    });
  } catch (e) {
    dialog.showErrorBox(APP_DISPLAY_NAME, String(e?.message ?? e));
  }
}

function sendCvMenuAction(action) {
  let win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  if (!win) win = BrowserWindow.getFocusedWindow();
  if (!win || win.isDestroyed()) return;
  win.webContents.send("cv-menu:action", { action });
}

function buildRecentSubmenu() {
  const t = uiText();
  if (!recentTemplateEntries.length) {
    return [{ label: t.recentEmpty, enabled: false }];
  }
  return recentTemplateEntries.map((entry) => ({
    label: entry.name,
    click: () => {
      void readAndSendTemplateToRenderer(entry.path, entry.name);
    },
  }));
}

function buildFileSubmenu() {
  const t = uiText();
  const openTemplate = {
    label: t.openTemplate,
    click: () => {
      void (async () => {
        const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
        const result = await dialog.showOpenDialog(win ?? undefined, {
          title: t.openTemplateDialogTitle,
          filters: [{ name: "JSON", extensions: ["json"] }],
          properties: ["openFile"],
        });
        if (result.canceled || !result.filePaths?.length) return;
        const fp = result.filePaths[0];
        await readAndSendTemplateToRenderer(fp, path.basename(fp));
      })();
    },
  };
  const saveItem = {
    label: t.saveFile,
    accelerator: "CmdOrCtrl+S",
    click: () => sendCvMenuAction("save"),
  };
  const saveAsItem = {
    label: t.saveFileAs,
    accelerator: "CmdOrCtrl+Shift+S",
    click: () => sendCvMenuAction("saveAs"),
  };
  const printPdfItem = {
    label: t.printToPdfMenu,
    accelerator: "CmdOrCtrl+P",
    click: () => sendCvMenuAction("printPdf"),
  };
  const recent = { label: t.recentFiles, submenu: buildRecentSubmenu() };
  const tail = [openTemplate, { type: "separator" }, saveItem, saveAsItem, { type: "separator" }, printPdfItem, { type: "separator" }, recent];
  if (isMac) {
    return tail;
  }
  return [...tail, { type: "separator" }, { role: "quit", label: t.quit }];
}

function showAboutAppDialog() {
  const t = uiText();
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  dialog.showMessageBox(win ?? undefined, {
    type: "info",
    title: t.aboutDialogTitle,
    message: APP_NAME_WITH_VERSION,
    detail: t.aboutDialogDetail,
    buttons: [t.ok],
    defaultId: 0,
  });
}

function buildApplicationMenu() {
  const t = uiText();
  const helpSubmenu = [
    {
      label: t.helpDoc,
      click: () => openHelpWindow(),
    },
    {
      label: t.licenseThirdParty,
      click: () => openLicenseWindow(),
    },
    {
      label: t.aboutAuthor,
      click: () => openAboutAuthorWindow(),
    },
    { type: "separator" },
    {
      label: t.aboutApp,
      click: () => showAboutAppDialog(),
    },
  ];

  /** Bez `role: 'help'`, aby Electron nie doklejał „Community”, „Search Issues” itd. */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: t.aboutAppMac, click: () => showAboutAppDialog() },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          {
            label: t.file,
            submenu: buildFileSubmenu(),
          },
        ]
      : [
          {
            label: t.file,
            submenu: buildFileSubmenu(),
          },
        ]),
    {
      label: t.edit,
      submenu: [
        { role: "undo", label: t.undo },
        { role: "redo", label: t.redo },
        { type: "separator" },
        { role: "cut", label: t.cut },
        { role: "copy", label: t.copy },
        { role: "paste", label: t.paste },
        { role: "selectAll", label: t.selectAll },
      ],
    },
    {
      label: t.view,
      submenu: [
        { role: "reload", label: t.reload },
        { role: "togglefullscreen", label: t.fullscreen },
        ...(isDev ? [{ role: "toggleDevTools", label: t.devtools }] : []),
      ],
    },
    {
      label: t.help,
      submenu: helpSubmenu,
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: APP_DISPLAY_NAME,
    icon: getWindowIconPath(),
    width: 1100,
    height: 920,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../out/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function sanitizePdfFileName(input) {
  let s = String(input ?? "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_");
  if (!s.toLowerCase().endsWith(".pdf")) {
    s = `${s || "CV"}.pdf`;
  }
  if (s.length > 120) {
    s = `${s.slice(0, 116)}.pdf`;
  }
  return s;
}

/** Print-abstraction: rozciągające flex/h-full pudła → block przed rasterem PDF (mniejsze dziwne hitboxy w Acrobat). */
const CV_PDF_PRINT_ABSTRACT_PATCH = `(() => {
  const root = document.querySelector("main.print-sheet") || document.querySelector(".print-sheet");
  if (!root) return;
  const undo = [];
  root.querySelectorAll("div, section").forEach((el) => {
    const cs = getComputedStyle(el);
    const flexOne = cs.flexGrow === "1";
    const sa = el.getAttribute("style") || "";
    const height100 =
      /height\\s*:\\s*100%/.test(sa) || el.classList.contains("h-full");
    if (!flexOne && !height100) return;
    undo.push({
      el,
      d: el.style.getPropertyValue("display"),
      dPri: el.style.getPropertyPriority("display"),
      f: el.style.getPropertyValue("float"),
      fPri: el.style.getPropertyPriority("float"),
    });
    el.style.setProperty("display", "block", "important");
    el.style.setProperty("float", "none", "important");
  });
  window.__cvPdfAbstractUndo = undo;
})()`;

const CV_PDF_PRINT_ABSTRACT_UNDO = `(() => {
  const u = window.__cvPdfAbstractUndo;
  if (!u || !Array.isArray(u)) return;
  u.forEach((r) => {
    if (!r || !r.el) return;
    r.el.style.removeProperty("display");
    r.el.style.removeProperty("float");
    if (r.d) r.el.style.setProperty("display", r.d, r.dPri || "");
    if (r.f) r.el.style.setProperty("float", r.f, r.fPri || "");
  });
  delete window.__cvPdfAbstractUndo;
})()`;

/* PDF-only: stabilny układ ikon kontaktu (nie wpływa na GUI poza chwilą generowania PDF). */
const CV_PDF_CONTACT_LAYOUT_PATCH = `(() => {
  if (document.getElementById("__cvPdfTempStyle")) return;
  const style = document.createElement("style");
  style.id = "__cvPdfTempStyle";
  style.textContent =
    ".print-sheet .cv-contact-list { display:block !important; width:100% !important; }" +
    ".print-sheet .cv-contact-list li { display:flex !important; align-items:flex-start !important; gap:.35em !important; width:100% !important; }" +
    ".print-sheet .cv-contact-list li > svg { display:inline-block !important; width:1.25em !important; flex:0 0 1.25em !important; margin-top:.05em !important; padding:0 !important; }" +
    ".print-sheet .cv-contact-list li .min-w-0.flex-1 { display:block !important; flex:1 1 auto !important; min-height:0 !important; padding:0 0 .35em 0 !important; }";
  document.head.appendChild(style);
})()`;

const CV_PDF_CONTACT_LAYOUT_UNDO = `(() => {
  document.getElementById("__cvPdfTempStyle")?.remove();
})()`;

function registerCvIpcHandlers() {
  ipcMain.handle("cv-recent:set-list", (_event, list) => {
    try {
      if (!Array.isArray(list)) {
        recentTemplateEntries = [];
      } else {
        recentTemplateEntries = list
          .filter((x) => x && typeof x.path === "string" && x.path.length > 0)
          .slice(0, 3)
          .map((x) => ({
            path: x.path,
            name:
              typeof x.name === "string" && x.name.trim()
                ? x.name.trim()
                : path.basename(x.path),
          }));
      }
      buildApplicationMenu();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle("cv-ui:set-document-status", (_event, payload) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (win && !win.isDestroyed()) {
      const fileName =
        typeof payload?.fileName === "string" && payload.fileName.trim()
          ? payload.fileName.trim()
          : "template.json";
      const dirty = !!payload?.dirty;
      win.setTitle(dirty ? `* ${fileName} — ${APP_DISPLAY_NAME}` : `${fileName} — ${APP_DISPLAY_NAME}`);
    }
    return { ok: true };
  });

  ipcMain.handle("cv-fs:get-bundled-dir", async () => {
    try {
      const dir = await ensureDefaultCvDir();
      return { ok: true, path: dir };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle("cv-fs:read", async (_event, payload) => {
    try {
      const dir = await resolveDir(payload?.folderPath);
      const full = resolveSafeFilePath(dir, payload?.fileName ?? DEFAULT_TEMPLATE_FILE);
      const text = await fs.readFile(full, "utf8");
      return { ok: true, content: text.trim() ? text : null };
    } catch (e) {
      if (e && e.code === "ENOENT") {
        return { ok: true, content: null };
      }
      return { ok: false, error: String(e?.message ?? e), content: null };
    }
  });

  ipcMain.handle("cv-fs:write", async (_event, payload) => {
    try {
      const dir = await resolveDir(payload?.folderPath);
      await fs.mkdir(dir, { recursive: true });
      const full = resolveSafeFilePath(dir, payload?.fileName ?? DEFAULT_TEMPLATE_FILE);
      const content = typeof payload?.content === "string" ? payload.content : "";
      await fs.writeFile(full, content, "utf8");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle("cv-fs:pick-folder", async () => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? undefined, {
      properties: ["openDirectory", "createDirectory"],
      title: "Wybierz folder zapisu CV",
    });
    if (result.canceled || !result.filePaths?.length) {
      return { ok: true, path: null };
    }
    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle("cv-ui:set-language", async (_event, payload) => {
    try {
      currentUiLanguage = normalizeUiLanguage(payload?.lang);
      buildApplicationMenu();
      if (helpWindow && !helpWindow.isDestroyed()) {
        const t = uiText();
        helpWindow.setTitle(t.helpWindowTitle);
        void helpWindow.loadFile(path.join(__dirname, t.helpFile));
      }
      if (aboutAuthorWindow && !aboutAuthorWindow.isDestroyed()) {
        const t = uiText();
        aboutAuthorWindow.setTitle(t.authorWindowTitle);
        void aboutAuthorWindow.loadFile(path.join(__dirname, t.authorFile));
      }
      if (licenseWindow && !licenseWindow.isDestroyed()) {
        const t = uiText();
        licenseWindow.setTitle(t.licenseWindowTitle);
        void licenseWindow.loadFile(path.join(__dirname, t.licenseFile));
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
}

app.whenReady().then(async () => {
  app.setName(APP_DISPLAY_NAME);
  await seedOrUpgradeUserTemplateFromBundle();
  buildApplicationMenu();
  registerCvIpcHandlers();

  ipcMain.removeHandler("cv-pdf:save");
  /* Rejestracja w whenReady, przed createWindow — invoke('cv-pdf:save') musi mieć handler. */
  ipcMain.handle("cv-pdf:save", async (event, data) => {
    const wc = event.sender;
    const win = BrowserWindow.fromWebContents(wc) ?? mainWindow;
    const suggested = sanitizePdfFileName(data?.fileName ?? "CV.pdf");
    const defaultPath = path.join(app.getPath("documents"), suggested);

    const result = await dialog.showSaveDialog(win ?? undefined, {
      title: "Zapisz CV jako PDF",
      defaultPath,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (result.canceled || !result.filePath) {
      return { ok: true, canceled: true };
    }

    try {
      await wc.executeJavaScript(CV_PDF_PRINT_ABSTRACT_PATCH, true);
      await wc.executeJavaScript(CV_PDF_CONTACT_LAYOUT_PATCH, true);
      const pdfBuffer = await wc.printToPDF({
        printBackground: true,
        pageSize: "A4",
        preferCSSPageSize: true,
        margins: { marginType: "none" },
        generateTaggedPDF: false,
        generateDocumentOutline: false,
      });
      await fs.writeFile(result.filePath, pdfBuffer);
      return { ok: true, canceled: false, path: result.filePath };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    } finally {
      try {
        await wc.executeJavaScript(CV_PDF_CONTACT_LAYOUT_UNDO, true);
      } catch {
        /* ignore */
      }
      try {
        await wc.executeJavaScript(CV_PDF_PRINT_ABSTRACT_UNDO, true);
      } catch {
        /* ignore */
      }
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
