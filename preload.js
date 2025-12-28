const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Funciones de medición
  measureMultimeter: (config) => ipcRenderer.invoke('measure-multimeter', config),
  measureScope: (config) => ipcRenderer.invoke('measure-scope', config),
  
  // Funciones de configuración
  testConnection: (ip, port) => ipcRenderer.invoke('test-connection', { ip, port }),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),

  // Verificación de entorno
  isElectron: true
});