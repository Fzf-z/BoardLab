const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const net = require('net');
const { Worker } = require('worker_threads');
const Store = require('electron-store');
const puppeteer = require('puppeteer');
const { setOwonConfig, getOwonMeasurement } = require('./src/drivers/owon');
const { getRigolData } = require('./src/drivers/rigol');
const { testConnection } = require('./src/drivers/connection');
const { generateReportHtml } = require('./src/report-generator');

const store = new Store();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;

// =================================================================
// Database Worker
// =================================================================

// Initialize the database worker
const dbPath = path.join(app.getPath('userData'), 'boardlab.db');
const dbWorker = new Worker(path.join(__dirname, 'db-worker.js'), {
  workerData: { dbPath }
});

// Keep track of pending queries
const pendingQueries = new Map();
let queryId = 0;

// Listen for messages from the worker
dbWorker.on('message', (msg) => {
  const { id, result, error } = msg;
  if (pendingQueries.has(id)) {
    const { resolve, reject } = pendingQueries.get(id);
    pendingQueries.delete(id);
    if (error) {
      console.error('Database worker error:', error);
      reject(new Error(error.message));
    } else {
      resolve(result);
    }
  }
});

dbWorker.on('error', err => console.error('DB worker error:', err));
dbWorker.on('exit', code => {
  if (code !== 0) console.error(`DB worker stopped with exit code ${code}`);
});

// Helper function to query the database worker
function dbQuery(type, payload) {
  return new Promise((resolve, reject) => {
    const id = queryId++;
    pendingQueries.set(id, { resolve, reject });
    dbWorker.postMessage({ id, type, payload });
  });
}

// =================================================================
// Main Window
// =================================================================

function createWindow() {
  mainWindow = new BrowserWindow({
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
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      responseHeaders['Content-Security-Policy'] = [
        "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:"
      ];
      callback({ responseHeaders });
    });
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  dbQuery('close').finally(() => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

// =================================================================
// IPC Handlers for Database (Now non-blocking)
// =================================================================

ipcMain.handle('db:get-projects', () => dbQuery('db:get-projects'));
ipcMain.handle('db:get-project-with-image', (event, projectId) => dbQuery('db:get-project-with-image', projectId));
ipcMain.handle('db:create-project', (event, projectData) => dbQuery('db:create-project', projectData));
ipcMain.handle('db:get-all-attributes', () => dbQuery('db:get-all-attributes'));
ipcMain.handle('db:save-points', (event, payload) => dbQuery('db:save-points', payload));
ipcMain.handle('db:get-points', (event, projectId) => dbQuery('db:get-points', projectId));
ipcMain.handle('db:save-measurement', (event, payload) => dbQuery('db:save-measurement', payload));
ipcMain.handle('db:createMeasurement', (event, payload) => dbQuery('db:createMeasurement', payload));
ipcMain.handle('db:getMeasurementsForPoint', (event, pointId) => dbQuery('db:getMeasurementsForPoint', pointId));
ipcMain.handle('db:delete-project', (event, projectId) => dbQuery('db:delete-project', projectId));
ipcMain.handle('db:delete-point', (event, pointId) => dbQuery('db:delete-point', pointId));


// =================================================================
// IPC Handlers for Hardware
// =================================================================

ipcMain.handle('hardware:measure-resistance', async () => {
  // ... (existing hardware code)
});

// Medición
ipcMain.handle('multimeter-set-config', async (event, config) => setOwonConfig(config.ip, config.port, config.configCommand));
ipcMain.handle('multimeter-get-measurement', async (event, config) => getOwonMeasurement(config.ip, config.port, config.measureCommand));
ipcMain.handle('measure-scope', async (event, config) => getRigolData(config.ip, config.port));

// Configuración
ipcMain.handle('test-connection', async (event, { ip, port }) => testConnection(ip, port));
ipcMain.handle('save-config', (event, config) => store.set('instrumentConfig', config));
ipcMain.handle('load-config', () => store.get('instrumentConfig'));
ipcMain.handle('save-api-key', (event, apiKey) => store.set('geminiApiKey', apiKey));
ipcMain.handle('load-api-key', () => store.get('geminiApiKey'));
ipcMain.handle('save-app-settings', (event, settings) => store.set('appSettings', settings));
ipcMain.handle('load-app-settings', () => store.get('appSettings'));

// Exportación
ipcMain.handle('exportPdf', async (event, projectId) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Report as PDF',
    defaultPath: `boardlab-report-${projectId}-${Date.now()}.pdf`,
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) {
    return { status: 'cancelled' };
  }

    try {
        const project = await dbQuery('db:get-project-with-image', projectId);
        if (!project) {
            throw new Error(`Project with ID ${projectId} not found.`);
        }
        const pointsWithMeasurements = await dbQuery('db:get-points', projectId);

        const htmlContent = generateReportHtml(project, pointsWithMeasurements);

        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await page.pdf({ path: filePath, format: 'A4', printBackground: true });
        await browser.close();

        return { status: 'success', filePath };
    } catch (error) {
        console.error('Failed to generate PDF:', error);
        return { status: 'error', message: error.message };
    }
});