const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Funciones de medición
  multimeterSetConfig: (config) => ipcRenderer.invoke('multimeter-set-config', config),
  multimeterGetMeasurement: (config) => ipcRenderer.invoke('multimeter-get-measurement', config),
  measureScope: (config) => ipcRenderer.invoke('measure-scope', config),
  
  // Funciones de configuración
  testConnection: (ip, port) => ipcRenderer.invoke('test-connection', { ip, port }),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  loadAppSettings: () => ipcRenderer.invoke('load-app-settings'),

  // API Key
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),



  // Exportación
  exportPdf: (projectId) => ipcRenderer.invoke('exportPdf', projectId),

  // Verificación de entorno
  isElectron: true,



  // Database
  getProjects: () => ipcRenderer.invoke('db:get-projects'),
  getProjectWithImage: (projectId) => ipcRenderer.invoke('db:get-project-with-image', projectId),
  createProject: (projectData) => ipcRenderer.invoke('db:create-project', projectData),
  getAllAttributes: () => ipcRenderer.invoke('db:get-all-attributes'),
  savePoints: (data) => ipcRenderer.invoke('db:save-points', data), // data: { projectId, points }
  getPoints: (projectId) => ipcRenderer.invoke('db:get-points', projectId),
  createMeasurement: (data) => ipcRenderer.invoke('db:createMeasurement', data), // data: { pointId, type, value }
  getMeasurementsForPoint: (pointId) => ipcRenderer.invoke('db:getMeasurementsForPoint', pointId),
});