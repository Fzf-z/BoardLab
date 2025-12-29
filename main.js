const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { setOwonConfig, getOwonMeasurement } = require('./src/drivers/owon');
const { getRigolData } = require('./src/drivers/rigol');
const { testConnection } = require('./src/drivers/connection');

const store = new Store();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log("Cargando aplicación desde Vite Server...");
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open the DevTools.
    //mainWindow.webContents.openDevTools();
  } else {
    console.log("Cargando aplicación desde el build de producción...");
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
    // IPC Handlers para Medición
  ipcMain.handle('multimeter-set-config', async (event, config) => {
    return await setOwonConfig(config.ip, config.port, config.configCommand);
  });

  ipcMain.handle('multimeter-get-measurement', async (event, config) => {
    return await getOwonMeasurement(config.ip, config.port, config.measureCommand);
  });
  
  ipcMain.handle('measure-scope', async (event, config) => {
    return await getRigolData(config.ip, config.port);
  });

  // IPC Handlers para Configuración
  ipcMain.handle('test-connection', async (event, { ip, port }) => {
    return await testConnection(ip, port);
  });

  ipcMain.handle('save-config', (event, config) => {
    store.set('instrumentConfig', config);
  });

  ipcMain.handle('load-config', (event) => {
    return store.get('instrumentConfig');
  });

  ipcMain.handle('save-api-key', (event, apiKey) => {
    store.set('geminiApiKey', apiKey);
  });

  ipcMain.handle('load-api-key', (event) => {
    return store.get('geminiApiKey');
  });
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });