const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sadiya", {
  getState: () => ipcRenderer.invoke("sadiya:get-state"),
  sendMessage: (request) => ipcRenderer.invoke("sadiya:send-message", request),
  cancelTask: (taskId) => ipcRenderer.invoke("sadiya:cancel-task", taskId),
  captureScreen: () => ipcRenderer.invoke("sadiya:capture-screen"),
  getApiStatus: () => ipcRenderer.invoke("sadiya:get-api-status"),
  setApiKey: (apiKey) => ipcRenderer.invoke("sadiya:set-api-key", apiKey),
  testApi: () => ipcRenderer.invoke("sadiya:test-api"),
});
