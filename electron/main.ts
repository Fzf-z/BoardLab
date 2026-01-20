import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import path from 'node:path'
import fs from 'fs';
import { Worker } from 'worker_threads';
import Store from 'electron-store';
import net from 'net';
import { SerialPort } from 'serialport';
import { getRigolData } from './drivers/rigol';
import { testConnection } from './drivers/connection';
import { GenericSCPIDriver, InstrumentConfig } from './drivers/GenericSCPIDriver';

const store = new Store();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow: BrowserWindow | null = null;
let activeMultimeter: GenericSCPIDriver | null = null;
let activeOscilloscope: GenericSCPIDriver | null = null;

// =================================================================
// Serial Ports
// =================================================================

ipcMain.handle('get-serial-ports', async () => {
    try {
        const ports = await SerialPort.list();
        return ports.map(p => p.path);
    } catch (e) {
        console.error("Error listing serial ports:", e);
        return [];
    }
});

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
// Multimeter Monitor (Delegated to Driver)
// =================================================================

ipcMain.handle('start-monitor', async (event, { ip, port }) => {
    try {
        if (activeMultimeter) {
            await activeMultimeter.startMonitor((data) => {
                if (mainWindow) {
                    console.log('Monitor Data Received:', data);
                    mainWindow.webContents.send('external-trigger', data);
                }
            });
            if (mainWindow) mainWindow.webContents.send('monitor-status', 'connected');
            return { status: 'success' };
        }
        return { status: 'error', message: 'No active multimeter driver' };
    } catch (error: any) {
        if (mainWindow) mainWindow.webContents.send('monitor-status', 'error');
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('stop-monitor', async () => {
    if (activeMultimeter) {
        activeMultimeter.stopMonitor();
    }
    if (mainWindow) mainWindow.webContents.send('monitor-status', 'disconnected');
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

    // ---------------------------------------------------------
    // CORRECCIÓN AQUÍ
    // ---------------------------------------------------------
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        // CAMBIO: Usar '../dist/index.html' porque main.js está dentro de 'dist-electron'
        // y necesita salir para encontrar la carpeta 'dist'.
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', async () => {
    createWindow();

    // Load Active Instruments
    try {
        const instruments = await dbQuery('db:get-active-instruments') as InstrumentConfig[];
        if (Array.isArray(instruments)) {
            instruments.forEach(inst => {
                const driver = new GenericSCPIDriver(inst);
                if (inst.type === 'multimeter') {
                    activeMultimeter = driver;
                    console.log(`[Main] Loaded Multimeter: ${inst.name} (${inst.ip_address})`);
                } else if (inst.type === 'oscilloscope') {
                    activeOscilloscope = driver;
                    console.log(`[Main] Loaded Oscilloscope: ${inst.name} (${inst.ip_address})`);
                }
            });
        }
    } catch (err) {
        console.error("[Main] Failed to load instruments:", err);
    }
});

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
ipcMain.handle('db:get-all-instruments', () => dbQuery('db:get-all-instruments'));
ipcMain.handle('db:save-instrument', (event, data) => dbQuery('db:save-instrument', data));
ipcMain.handle('db:delete-instrument', (event, id) => dbQuery('db:delete-instrument', id));
ipcMain.handle('db:get-active-instruments', () => dbQuery('db:get-active-instruments'));

// =================================================================
// IPC Handlers for Hardware
// =================================================================

ipcMain.handle('instrument:execute', async (event, { type, actionKey }) => {
    const driver = type === 'multimeter' ? activeMultimeter : activeOscilloscope;
    if (!driver) {
        return { status: 'error', message: `No active ${type} configured.` };
    }
    return driver.execute(actionKey);
});

ipcMain.handle('instrument:test-connection', async (event, config) => {
    try {
        // Ensure command_map is a string as expected by GenericSCPIDriver
        const driverConfig = { ...config };
        if (typeof driverConfig.command_map === 'object') {
            driverConfig.command_map = JSON.stringify(driverConfig.command_map);
        }

        const tempDriver = new GenericSCPIDriver(driverConfig);
        // 'IDN' is the standard key for identification in our map
        return await tempDriver.execute('IDN');
    } catch (e: any) {
        return { status: 'error', message: e.message || 'Connection failed' };
    }
});

ipcMain.handle('hardware:measure-resistance', async () => {
    // ... (existing hardware code)
});

// Osciloscopio (Legacy - To be migrated to Binary Generic Driver)
ipcMain.handle('measure-scope', async (event, config) => getRigolData(config.ip, config.port, config.timeout));

// Configuración
ipcMain.handle('test-connection', async (event, { ip, port }) => testConnection(ip, port));
ipcMain.handle('save-config', (event, config) => store.set('instrumentConfig', config));
ipcMain.handle('load-config', () => store.get('instrumentConfig'));
ipcMain.handle('save-api-key', (event, apiKey) => store.set('geminiApiKey', apiKey));
ipcMain.handle('load-api-key', () => store.get('geminiApiKey'));
ipcMain.handle('save-app-settings', (event, settings) => store.set('appSettings', settings));
ipcMain.handle('load-app-settings', () => store.get('appSettings'));

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