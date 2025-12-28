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

  // API Key
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),

  // Verificación de entorno
  isElectron: true
});