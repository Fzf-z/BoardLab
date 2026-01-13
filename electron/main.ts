import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { Worker } from 'worker_threads';
import Store from 'electron-store';
import net from 'net';
import { setOwonConfig, getOwonMeasurement } from './drivers/owon';
import { getRigolData } from './drivers/rigol';
import { testConnection } from './drivers/connection';
import { generateReportHtml } from '../src/report-generator';

const store = new Store();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

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
function dbQuery(type: string, payload?: any) {
  return new Promise((resolve, reject) => {
    const id = queryId++;
    pendingQueries.set(id, { resolve, reject });
    dbWorker.postMessage({ id, type, payload });
  });
}

// =================================================================
// Multimeter Monitor (Persistent Connection)
// =================================================================
let multimeterSocket: net.Socket | null = null;
let monitorReconnectTimeout: NodeJS.Timeout | null = null;

function startMultimeterMonitor(ip: string, port: number) {
  stopMultimeterMonitor(); // Close existing if any

  console.log(`Starting Multimeter Monitor on ${ip}:${port}`);
  multimeterSocket = new net.Socket();
  
  multimeterSocket.connect(port, ip, () => {
    console.log('Multimeter Monitor Connected');
    if (mainWindow) mainWindow.webContents.send('monitor-status', 'connected');
  });

  multimeterSocket.on('data', (data) => {
    const rawData = data.toString().trim();
    if (rawData) {
      console.log('Monitor Data Received:', rawData);
      // Clean the value (remove non-printable)
      const cleanValue = rawData.replace(/[^\x20-\x7E]/g, '');
      
      // Emit as external trigger with the value
      if (mainWindow) {
        mainWindow.webContents.send('external-trigger', cleanValue);
      }
    }
  });

  multimeterSocket.on('error', (err) => {
    console.error('Multimeter Monitor Error:', err);
    if (mainWindow) mainWindow.webContents.send('monitor-status', 'error');
  });

  multimeterSocket.on('close', () => {
    console.log('Multimeter Monitor Closed');
    if (mainWindow) mainWindow.webContents.send('monitor-status', 'disconnected');
    multimeterSocket = null;
  });
}

function stopMultimeterMonitor() {
  if (monitorReconnectTimeout) clearTimeout(monitorReconnectTimeout);
  if (multimeterSocket) {
    multimeterSocket.destroy();
    multimeterSocket = null;
  }
}

ipcMain.handle('start-monitor', async (event, { ip, port }) => {
  try {
    startMultimeterMonitor(ip, port);
    return { status: 'success' };
  } catch (error: any) {
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('stop-monitor', async () => {
   stopMultimeterMonitor();
   return { status: 'success' };
});

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
  dbQuery('close', undefined).finally(() => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

// =================================================================
// IPC Handlers for Database (Now non-blocking)
// =================================================================

ipcMain.handle('db:get-projects', () => dbQuery('db:get-projects', undefined));
ipcMain.handle('db:get-project-with-image', (event, projectId) => dbQuery('db:get-project-with-image', projectId));
ipcMain.handle('db:create-project', (event, projectData) => dbQuery('db:create-project', projectData));
ipcMain.handle('db:get-all-attributes', () => dbQuery('db:get-all-attributes', undefined));
ipcMain.handle('db:save-points', (event, payload) => dbQuery('db:save-points', payload));
ipcMain.handle('db:get-points', (event, projectId) => dbQuery('db:get-points', projectId));
ipcMain.handle('db:save-measurement', (event, payload) => dbQuery('db:save-measurement', payload));
ipcMain.handle('db:createMeasurement', (event, payload) => dbQuery('db:createMeasurement', payload));
ipcMain.handle('db:getMeasurementsForPoint', (event, pointId) => dbQuery('db:getMeasurementsForPoint', pointId));
ipcMain.handle('db:delete-project', (event, projectId) => dbQuery('db:delete-project', projectId));
ipcMain.handle('db:delete-point', (event, pointId) => dbQuery('db:delete-point', pointId));
ipcMain.handle('db:update-project', (event, projectData) => dbQuery('db:update-project', projectData));
ipcMain.handle('db:search-projects-by-point', (event, searchTerm) => dbQuery('db:search-projects-by-point', searchTerm));

// =================================================================
// IPC Handlers for Hardware
// =================================================================

ipcMain.handle('hardware:measure-resistance', async () => {
  // ... (existing hardware code)
});

// Medición
ipcMain.handle('multimeter-set-config', async (event, config) => setOwonConfig(config.ip, config.port, config.configCommand));
ipcMain.handle('multimeter-get-measurement', async (event, config) => getOwonMeasurement(config.ip, config.port, config.measureCommand, config.timeout));
ipcMain.handle('measure-scope', async (event, config) => getRigolData(config.ip, config.port, config.timeout));

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

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await page.pdf({ path: filePath, format: 'A4', printBackground: true });
        await browser.close();

        return { status: 'success', filePath };
    } catch (error: any) {
        console.error('Failed to generate PDF:', error);
        return { status: 'error', message: error.message };
    }
});

// Board Types Management
ipcMain.handle('get-board-types', () => {
    const defaultTypes = ["Laptop", "Desktop", "Industrial", "Mobile", "Other"];
    const savedTypes = store.get('boardTypes', []) as string[];
    return [...new Set([...defaultTypes, ...savedTypes])];
});

ipcMain.handle('add-board-type', (event, newType) => {
    if (!newType) return;
    const currentTypes = store.get('boardTypes', []) as string[];
    if (!currentTypes.includes(newType)) {
        store.set('boardTypes', [...currentTypes, newType]);
    }
    return true;
});