import { contextBridge, ipcRenderer } from "electron";
import type { ComposeUiRequest, GeneratedUi, ToolOutputEvent, ToolRunRequest } from "../shared/schema";

const api = {
  composeUi: (request: ComposeUiRequest): Promise<GeneratedUi> => ipcRenderer.invoke("ai:compose-ui", request),
  selectFile: (): Promise<string | null> => ipcRenderer.invoke("dialog:select-file"),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("dialog:select-folder"),
  runAction: (request: ToolRunRequest): Promise<{ runId: string; command: string }> =>
    ipcRenderer.invoke("tool:run", request),
  cancelRun: (runId: string): Promise<boolean> => ipcRenderer.invoke("tool:cancel", runId),
  onToolOutput: (callback: (event: ToolOutputEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ToolOutputEvent) => callback(payload);
    ipcRenderer.on("tool:output", listener);
    return () => ipcRenderer.removeListener("tool:output", listener);
  },
  onToggleSidebar: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("app:toggle-sidebar", listener);
    return () => ipcRenderer.removeListener("app:toggle-sidebar", listener);
  }
};

contextBridge.exposeInMainWorld("uiterm", api);

export type UitermApi = typeof api;
