import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("bybitApp", {
  version: "0.1.0",
  isElectron: true,
  notify(payload: {
    title?: string;
    body?: string;
    urgency?: "normal" | "critical";
    silent?: boolean;
  }) {
    return ipcRenderer.invoke("desktop-notification:show", payload);
  },
  openPath(payload: {
    path?: string;
    revealInFolder?: boolean;
  }) {
    return ipcRenderer.invoke("desktop-path:open", payload);
  },
});
