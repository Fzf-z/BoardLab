import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Funciones de medición
  multimeterSetConfig: (config: any) => ipcRenderer.invoke('multimeter-set-config', config),
  multimeterGetMeasurement: (config: any) => ipcRenderer.invoke('multimeter-get-measurement', config),
  measureScope: (config: any) => ipcRenderer.invoke('measure-scope', config),
  
  // Funciones de configuración
  testConnection: (ip: string, port: number) => ipcRenderer.invoke('test-connection', { ip, port }),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveAppSettings: (settings: any) => ipcRenderer.invoke('save-app-settings', settings),
  loadAppSettings: () => ipcRenderer.invoke('load-app-settings'),

  // API Key
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),

  // External Monitor (Multimeter)
  startMonitor: (ip: string, port: number) => ipcRenderer.invoke('start-monitor', { ip, port }),
  stopMonitor: () => ipcRenderer.invoke('stop-monitor'),
  onMonitorStatus: (callback: (status: string) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('monitor-status', subscription);
    return () => ipcRenderer.removeListener('monitor-status', subscription);
  },
  onExternalTrigger: (callback: (data: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('external-trigger', subscription);
    return () => {
        ipcRenderer.removeListener('external-trigger', subscription);
    };
  },

  // Exportación
  exportPdf: (projectId: number) => ipcRenderer.invoke('exportPdf', projectId),
  exportImage: (projectId: number) => ipcRenderer.invoke('exportImage', projectId),

  // Verificación de entorno
  isElectron: true,



  // Database
  getProjects: () => ipcRenderer.invoke('db:get-projects'),
  getProjectWithImage: (projectId: number) => ipcRenderer.invoke('db:get-project-with-image', projectId),
  createProject: (projectData: any) => ipcRenderer.invoke('db:create-project', projectData),
  getAllAttributes: (boardType?: string) => ipcRenderer.invoke('db:get-all-attributes', { boardType }),
  savePoints: (data: any) => ipcRenderer.invoke('db:save-points', data), // data: { projectId, points }
  getPoints: (projectId: number) => ipcRenderer.invoke('db:get-points', projectId),
  searchProjectsByPoint: (searchTerm: string) => ipcRenderer.invoke('db:search-projects-by-point', searchTerm),
  createMeasurement: (data: any) => ipcRenderer.invoke('db:createMeasurement', data), // data: { pointId, type, value }
  getMeasurementsForPoint: (pointId: number | string) => ipcRenderer.invoke('db:getMeasurementsForPoint', pointId),
  deletePoint: (pointId: number | string) => ipcRenderer.invoke('db:delete-point', pointId),
  deleteProject: (projectId: number) => ipcRenderer.invoke('db:delete-project', projectId),
  updateProject: (projectData: any) => ipcRenderer.invoke('db:update-project', projectData),

  // Board Types
  getBoardTypes: () => ipcRenderer.invoke('get-board-types'),
  addBoardType: (newType: string) => ipcRenderer.invoke('add-board-type', newType),
});