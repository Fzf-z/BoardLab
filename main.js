const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

// --- DRIVER OWON XDM1241 ---
function readOwon(ip, port = 23, command = "MEAS:VOLT:DC?") {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let response = '';
    const timeout = setTimeout(() => { client.destroy(); resolve({ status: 'error', message: 'Timeout' }); }, 2000);
    client.connect(parseInt(port), ip, () => { client.write(command.trim() + '\n'); });
    client.on('data', (data) => {
      response += data.toString();
      if (response.includes('\n') || response.length > 0) {
        clearTimeout(timeout); client.destroy(); resolve({ status: 'success', value: response.trim() });
      }
    });
    client.on('error', (err) => { clearTimeout(timeout); resolve({ status: 'error', message: err.message }); });
  });
}

// --- DRIVER RIGOL DHO814 ---
function readRigol(ip, port = 5555) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const chunks = [];
    const timeout = setTimeout(() => { 
        client.destroy(); 
        // Demo Wave si falla
        resolve({ status: 'success', value: 'Demo Wave', waveform: Array.from({length:100},()=>Math.sin(Math.random()*10)) }); 
    }, 3000);
    client.connect(port, ip, () => {
      client.write(':WAV:SOUR CHAN1\n:WAV:MODE NORM\n:WAV:FORM ASC\n:WAV:DATA?\n');
    });
    client.on('data', (data) => {
      chunks.push(data);
      if (data.includes('\n')) {
        clearTimeout(timeout); client.destroy();
        const full = Buffer.concat(chunks).toString('ascii');
        // Parsing simple
        let raw = full.includes('#') ? full.substring(full.indexOf('#') + 11) : full;
        const pts = raw.split(',').map(n=>parseFloat(n)).filter(n=>!isNaN(n));
        resolve({ status: 'success', value: 'OK', waveform: pts.slice(0,300) });
      }
    });
    client.on('error', (err) => { clearTimeout(timeout); resolve({ status: 'error', message: err.message }); });
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
  ipcMain.handle('measure-multimeter', async (e, args) => {
    const cmd = args.mode === 'VOLT' ? "MEAS:VOLT:DC?" : "MEAS:RES?";
    return await readOwon(args.ip, 80, cmd); // Verifica si tu ESP32 usa puerto 80 o 23
  });
  ipcMain.handle('measure-scope', async (e, args) => readRigol(args.ip));
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });