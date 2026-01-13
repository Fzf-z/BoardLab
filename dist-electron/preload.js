"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Funciones de medición
  multimeterSetConfig: (config) => electron.ipcRenderer.invoke("multimeter-set-config", config),
  multimeterGetMeasurement: (config) => electron.ipcRenderer.invoke("multimeter-get-measurement", config),
  measureScope: (config) => electron.ipcRenderer.invoke("measure-scope", config),
  // Funciones de configuración
  testConnection: (ip, port) => electron.ipcRenderer.invoke("test-connection", { ip, port }),
  saveConfig: (config) => electron.ipcRenderer.invoke("save-config", config),
  loadConfig: () => electron.ipcRenderer.invoke("load-config"),
  saveAppSettings: (settings) => electron.ipcRenderer.invoke("save-app-settings", settings),
  loadAppSettings: () => electron.ipcRenderer.invoke("load-app-settings"),
  // API Key
  saveApiKey: (apiKey) => electron.ipcRenderer.invoke("save-api-key", apiKey),
  loadApiKey: () => electron.ipcRenderer.invoke("load-api-key"),
  // External Monitor (Multimeter)
  startMonitor: (ip, port) => electron.ipcRenderer.invoke("start-monitor", { ip, port }),
  stopMonitor: () => electron.ipcRenderer.invoke("stop-monitor"),
  onMonitorStatus: (callback) => {
    const subscription = (_event, value) => callback(value);
    electron.ipcRenderer.on("monitor-status", subscription);
    return () => electron.ipcRenderer.removeListener("monitor-status", subscription);
  },
  onExternalTrigger: (callback) => {
    const subscription = (_event, value) => callback(value);
    electron.ipcRenderer.on("external-trigger", subscription);
    return () => {
      electron.ipcRenderer.removeListener("external-trigger", subscription);
    };
  },
  // Exportación
  exportPdf: (projectId) => electron.ipcRenderer.invoke("exportPdf", projectId),
  // Verificación de entorno
  isElectron: true,
  // Database
  getProjects: () => electron.ipcRenderer.invoke("db:get-projects"),
  getProjectWithImage: (projectId) => electron.ipcRenderer.invoke("db:get-project-with-image", projectId),
  createProject: (projectData) => electron.ipcRenderer.invoke("db:create-project", projectData),
  getAllAttributes: (boardType) => electron.ipcRenderer.invoke("db:get-all-attributes", { boardType }),
  savePoints: (data) => electron.ipcRenderer.invoke("db:save-points", data),
  // data: { projectId, points }
  getPoints: (projectId) => electron.ipcRenderer.invoke("db:get-points", projectId),
  searchProjectsByPoint: (searchTerm) => electron.ipcRenderer.invoke("db:search-projects-by-point", searchTerm),
  createMeasurement: (data) => electron.ipcRenderer.invoke("db:createMeasurement", data),
  // data: { pointId, type, value }
  getMeasurementsForPoint: (pointId) => electron.ipcRenderer.invoke("db:getMeasurementsForPoint", pointId),
  deletePoint: (pointId) => electron.ipcRenderer.invoke("db:delete-point", pointId),
  deleteProject: (projectId) => electron.ipcRenderer.invoke("db:delete-project", projectId),
  updateProject: (projectData) => electron.ipcRenderer.invoke("db:update-project", projectData),
  // Board Types
  getBoardTypes: () => electron.ipcRenderer.invoke("get-board-types"),
  addBoardType: (newType) => electron.ipcRenderer.invoke("add-board-type", newType)
});
