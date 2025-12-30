const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const puppeteer = require('puppeteer');
const { setOwonConfig, getOwonMeasurement } = require('./src/drivers/owon');
const { getRigolData } = require('./src/drivers/rigol');
const { testConnection } = require('./src/drivers/connection');
const { initDatabase, getDatabase } = require('./src/database');
const { generateReportHtml } = require('./src/report-generator');

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
  // Inicializar la base de datos
  const dbPath = path.join(app.getPath('userData'), 'boardlab.db');
  initDatabase(dbPath);

  // --- IPC Handlers ---

  // Base de Datos
  ipcMain.handle('db:createProject', (event, project) => getDatabase().createProject(project));
  ipcMain.handle('db:getProjects', () => getDatabase().getProjects());
  ipcMain.handle('db:getProject', (event, id) => getDatabase().getProject(id));
  ipcMain.handle('db:updateProject', (event, project) => getDatabase().updateProject(project));
  ipcMain.handle('db:deleteProject', (event, id) => getDatabase().deleteProject(id));
  ipcMain.handle('db:createPoint', (event, point) => getDatabase().createPoint(point));
  ipcMain.handle('db:getPointsForProject', (event, projectId) => getDatabase().getPointsForProject(projectId));
  ipcMain.handle('db:updatePoint', (event, point) => getDatabase().updatePoint(point));
  ipcMain.handle('db:deletePoint', (event, id) => getDatabase().deletePoint(id));
  ipcMain.handle('db:createMeasurement', (event, measurement) => getDatabase().createMeasurement(measurement));
  ipcMain.handle('db:getMeasurementsForPoint', (event, pointId) => getDatabase().getMeasurementsForPoint(pointId));
  ipcMain.handle('db:getMeasurement', (event, id) => getDatabase().getMeasurement(id));
  
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
      const db = getDatabase();
      const project = db.getProject(projectId);
      const points = db.getPointsForProject(projectId);
      
      const pointsWithMeasurements = points.map(p => ({
        ...p,
        measurements: db.getMeasurementsForPoint(p.id)
      }));

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
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });