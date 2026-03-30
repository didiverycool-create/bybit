import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("bybitApp", {
  version: "0.1.0"
});
