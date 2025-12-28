const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const Store = require('electron-store');

const store = new Store();

// --- DRIVER OWON XDM1241 ---
function readOwon(ip, port, command) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let response = '';
    const timeout = setTimeout(() => { 
        client.destroy(); 
        resolve({ status: 'error', message: 'Timeout' }); 
    }, 2000);
    
    client.connect(parseInt(port), ip, () => { 
        client.write(command.trim() + '\n'); 
    });

    client.on('data', (data) => {
      response += data.toString();
      if (response.includes('\n') || response.length > 0) {
        clearTimeout(timeout); 
        client.destroy(); 
        resolve({ status: 'success', value: response.trim() });
      }
    });
    client.on('error', (err) => { 
        clearTimeout(timeout); 
        resolve({ status: 'error', message: err.message }); 
    });
  });
}

// --- DRIVER RIGOL DHO814 ---
function readRigol(ip, port, commands) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const chunks = [];
    const timeout = setTimeout(() => { 
        client.destroy(); 
        resolve({ status: 'error', message: 'Timeout' });
    }, 3000);
    
    client.connect(port, ip, () => {
      client.write(`${commands.prepare_waveform}\n:WAV:MODE NORM\n:WAV:FORM ASC\n${commands.request_waveform}\n`);
    });

    client.on('data', (data) => {
      chunks.push(data);
      if (data.toString().includes('\n')) {
        clearTimeout(timeout); 
        client.destroy();
        const full = Buffer.concat(chunks).toString('ascii');
        let raw = full.includes('#') ? full.substring(full.indexOf('#') + 11) : full;
        const pts = raw.split(',').map(n => parseFloat(n)).filter(n => !isNaN(n));
        resolve({ status: 'success', value: 'Waveform OK', waveform: pts.slice(0, 300) });
      }
    });

    client.on('error', (err) => { 
        clearTimeout(timeout); 
        resolve({ status: 'error', message: err.message }); 
    });
  });
}

// --- FUNCIÓN DE PRUEBA DE CONEXIÓN ---
function testConnection(ip, port) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: 'Timeout' });
        }, 2000);

        client.connect(parseInt(port), ip, () => {
            clearTimeout(timeout);
            client.end();
            resolve({ status: 'success' });
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ status: 'error', message: err.message });
        });
    });
}


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

  // --- ESTA LÍNEA ES LA CLAVE PARA QUE FUNCIONE AHORA ---
  console.log("Cargando aplicación desde Vite Server...");
  mainWindow.loadURL('http://localhost:5173'); 
  
  // mainWindow.webContents.openDevTools(); // Útil si hay pantalla blanca para ver errores
}

app.whenReady().then(() => {
    // IPC Handlers para Medición
  ipcMain.handle('measure-multimeter', async (event, config) => {
    return await readOwon(config.ip, config.port, config.command);
  });
  
  ipcMain.handle('measure-scope', async (event, config) => {
    return await readRigol(config.ip, config.port, config.commands);
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
  
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });