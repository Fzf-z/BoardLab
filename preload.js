const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Función genérica para medir
  measureMultimeter: (config) => ipcRenderer.invoke('measure-multimeter', config),
  measureScope: (config) => ipcRenderer.invoke('measure-scope', config),
  
  // Verificación de entorno
  isElectron: true
});