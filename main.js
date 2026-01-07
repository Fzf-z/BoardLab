const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const net = require('net');
const db = require('./src/database'); // <-- Importar la base de datos
const Store = require('electron-store');
const puppeteer = require('puppeteer');
const { setOwonConfig, getOwonMeasurement } = require('./src/drivers/owon');
const { getRigolData } = require('./src/drivers/rigol');
const { testConnection } = require('./src/drivers/connection');

const store = new Store();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;

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
    // For production loads (file://) ensure we set a secure Content-Security-Policy header
    // to avoid the Electron insecure-CSP warning in packaged builds.
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      // A reasonably strict CSP for packaged app. Adjust if additional sources are required.
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  db.init(app); // <-- Inicializar la base de datos
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  db.close(); // <-- Cerrar la conexión a la BD
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// =================================================================
// IPC Handlers for Database
// =================================================================

ipcMain.handle('db:get-projects', async () => {
  // Excluimos la imagen para que la carga inicial sea rápida
  const projects = db.db.prepare('SELECT id, board_type, board_model, attributes, created_at FROM projects ORDER BY created_at DESC').all();
  return projects.map(p => ({
    ...p,
    attributes: JSON.parse(p.attributes || '{}') // Parsear el JSON al enviar
  }));
});

ipcMain.handle('db:get-project-with-image', async (event, projectId) => {
    const project = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (project) {
        project.attributes = JSON.parse(project.attributes || '{}');
    }
    return project;
});

ipcMain.handle('db:create-project', async (event, projectData) => {
  const { board_type, board_model, attributes, image_data } = projectData;
  
  // Convertir el Uint8Array (recibido desde el renderer) a un Buffer
  const imageBuffer = Buffer.from(image_data);

  const result = db.db.prepare(
    'INSERT INTO projects (board_type, board_model, attributes, image_data) VALUES (?, ?, ?, ?)'
  ).run(board_type, board_model, JSON.stringify(attributes), imageBuffer);
  
  return { id: result.lastInsertRowid, ...projectData, image_data: imageBuffer };
});

ipcMain.handle('db:get-all-attributes', async () => {
  const projects = db.db.prepare('SELECT attributes FROM projects WHERE attributes IS NOT NULL').all();
  const keys = new Set();
  const values = new Set();

  for (const proj of projects) {
    try {
      const attrs = JSON.parse(proj.attributes);
      for (const key in attrs) {
        keys.add(key);
        if (typeof attrs[key] === 'string' && attrs[key].trim() !== '') {
          values.add(attrs[key]);
        }
      }
    } catch (e) {
      console.error('Error parsing attributes JSON:', e);
    }
  }

  return {
    keys: [...keys].sort(),
    values: [...values].sort(),
  };
});

ipcMain.handle('db:save-points', async (event, { projectId, points }) => {
  const insertStmt = db.db.prepare('INSERT INTO points (project_id, x, y, label, notes, type) VALUES (?, ?, ?, ?, ?, ?)');
  const updateStmt = db.db.prepare('UPDATE points SET x = ?, y = ?, label = ?, notes = ?, type = ? WHERE id = ?');

  const transaction = db.db.transaction((pts) => {
    for (const point of pts) {
      if (typeof point.id === 'string' && point.id.startsWith('temp-')) {
        // Nuevo punto: INSERT
        insertStmt.run(projectId, point.x, point.y, point.label, point.notes || '', point.type || 'voltage');
      } else if (typeof point.id === 'number') {
        // Punto existente: UPDATE
        updateStmt.run(point.x, point.y, point.label, point.notes || '', point.type || 'voltage', point.id);
      }
    }
  });

  transaction(points);

  // Después de guardar, devuelve todos los puntos del proyecto con sus IDs permanentes
  const savedPoints = db.db.prepare('SELECT * FROM points WHERE project_id = ?').all(projectId);
  console.log('Points returned from DB after save:', JSON.stringify(savedPoints, null, 2)); // <-- Log de diagnóstico
  return savedPoints;
});

ipcMain.handle('db:get-points', async (event, projectId) => {
  const points = db.db.prepare('SELECT * FROM points WHERE project_id = ?').all(projectId);
  const getMeasurementsStmt = db.db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');

  // Para cada punto, buscar y adjuntar sus mediciones
  const pointsWithMeasurements = points.map(point => {
    const measurements = getMeasurementsStmt.all(point.id);
    const measurementsByType = {};
    
    // Agrupar las mediciones por tipo (voltage, resistance, etc.)
    for (const m of measurements) {
      if (!measurementsByType[m.type]) { // Solo guardar la más reciente de cada tipo
        try {
          measurementsByType[m.type] = {
            type: m.type,
            value: JSON.parse(m.value),
            capturedAt: m.created_at
          };
        } catch (e) {
          console.error(`Failed to parse measurement value for point ${point.id}:`, m.value);
        }
      }
    }
    return { ...point, measurements: measurementsByType };
  });

  return pointsWithMeasurements;
});

ipcMain.handle('db:save-measurement', async (event, payload) => {
  console.log('Received payload for db:save-measurement:', payload); 
  try {
    const { pointId, type, value } = payload || {};
    if (!pointId || !type) {
      return { status: 'error', message: 'Invalid payload: pointId and type are required' };
    }
    const result = db.db.prepare('INSERT INTO measurements (point_id, type, value) VALUES (?, ?, ?)')
      .run(pointId, type, JSON.stringify(value));
    return { id: result.lastInsertRowid };
  } catch (e) {
    console.error('Error in db:save-measurement:', e);
    return { status: 'error', message: e.message };
  }
});

ipcMain.handle('db:createMeasurement', async (event, payload) => {
  console.log('Received payload for db:createMeasurement:', payload); // <-- Añadir log
  try {
    const { pointId, type, value } = payload || {};
    if (!pointId || !type) {
      return { status: 'error', message: 'Invalid payload: pointId and type are required' };
    }
    const result = db.db.prepare('INSERT INTO measurements (point_id, type, value) VALUES (?, ?, ?)')
      .run(pointId, type, JSON.stringify(value));
    return { id: result.lastInsertRowid };
  } catch (e) {
    console.error('Error in db:createMeasurement:', e);
    return { status: 'error', message: e.message };
  }
});

ipcMain.handle('db:getMeasurementsForPoint', async (event, pointId) => {
  if (!pointId) return [];
  const measurements = db.db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC').all(pointId);
  return measurements;
});

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
        // Corrección: Usar el objeto db.db y los métodos prepare/get/all
        const project = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
        if (project) {
            project.attributes = JSON.parse(project.attributes || '{}');
        }

        const points = db.db.prepare('SELECT * FROM points WHERE project_id = ?').all(projectId);
        const getMeasurementsStmt = db.db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');

        const pointsWithMeasurements = points.map(p => ({
            ...p,
            measurements: getMeasurementsStmt.all(p.id).map(m => ({...m, value: JSON.parse(m.value || '{}')})) // Parsear mediciones
        }));

        // NOTA: generateReportHtml no está definido aquí, asumimos que existe en el scope.
        // const htmlContent = generateReportHtml(project, pointsWithMeasurements);
        const htmlContent = `<h1>Report for ${project.board_model}</h1><p>PDF generation placeholder.</p>`; // Placeholder

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