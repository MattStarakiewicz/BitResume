const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("cvFiles", {
  getPathForFile: (file) => {
    try {
      if (!file || typeof file !== "object") return "";
      return webUtils.getPathForFile(file);
    } catch {
      return "";
    }
  },
  getBundledCvDataDir: () => ipcRenderer.invoke("cv-fs:get-bundled-dir"),
  read: (payload) => ipcRenderer.invoke("cv-fs:read", payload),
  write: (payload) => ipcRenderer.invoke("cv-fs:write", payload),
  pickFolder: () => ipcRenderer.invoke("cv-fs:pick-folder"),
  savePdf: (payload) => ipcRenderer.invoke("cv-pdf:save", payload),
  setUiLanguage: (lang) => ipcRenderer.invoke("cv-ui:set-language", { lang }),
  syncRecentFiles: (entries) => ipcRenderer.invoke("cv-recent:set-list", entries),
  setDocumentStatus: (payload) => ipcRenderer.invoke("cv-ui:set-document-status", payload),
  subscribeTemplateFromPath: (cb) => {
    const listener = (_event, payload) => {
      cb(payload);
    };
    ipcRenderer.on("cv-template-from-path", listener);
    return () => ipcRenderer.removeListener("cv-template-from-path", listener);
  },
  subscribeMenuAction: (cb) => {
    const listener = (_event, payload) => {
      cb(payload);
    };
    ipcRenderer.on("cv-menu:action", listener);
    return () => ipcRenderer.removeListener("cv-menu:action", listener);
  },
});
