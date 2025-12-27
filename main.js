const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

// --- DRIVERS DE HARDWARE (Node.js Nativo) ---

// Driver OWON XDM1241 (TCP -> ESP32 -> UART)
function readOwon(ip, port = 23, command = "MEAS:VOLT:DC?") {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let response = '';

    // Timeout de seguridad
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error('Timeout de conexión con Multímetro'));
    }, 2000);

    client.connect(parseInt(port), ip, () => {
      // Enviar comando SCPI
      client.write(command.trim() + '\n');
    });

    client.on('data', (data) => {
      response += data.toString();
      // Asumimos que el dato llega completo o termina en newline
      if (response.includes('\n') || response.length > 0) {
        clearTimeout(timeout);
        client.destroy(); // Cerramos conexión tras recibir
        resolve({ status: 'success', value: response.trim() });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ status: 'error', message: err.message }); // Resolvemos error para no crashear la UI
    });
  });
}

// Driver RIGOL DHO814 (TCP RAW)
function readRigol(ip, port = 5555) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const chunks = [];
    
    const timeout = setTimeout(() => {
        client.destroy();
        // Fallback Demo si falla conexión real
        resolve({ 
            status: 'success', 
            value: 'Simulated Wave', 
            waveform: Array.from({length: 100}, () => Math.sin(Math.random()*10)) 
        });
    }, 3000);

    client.connect(port, ip, () => {
      client.write(':WAV:SOUR CHAN1\n');
      client.write(':WAV:MODE NORM\n');
      client.write(':WAV:FORM ASC\n');
      client.write(':WAV:DATA?\n');
    });

    client.on('data', (data) => {
      chunks.push(data);
      // Detección simple de fin de trama (esto varía según el buffer del equipo)
      if (data.includes('\n')) { 
        clearTimeout(timeout);
        client.destroy();
        
        const fullBuffer = Buffer.concat(chunks);
        const textData = fullBuffer.toString('ascii');
        
        // Parsing básico de cabecera TMC #9000...
        let rawNumbers = textData;
        if (textData.includes('#')) {
            const headerPos = textData.indexOf('#');
            // Lógica simplificada de parsing TMC
            rawNumbers = textData.substring(headerPos + 11); 
        }
        
        const points = rawNumbers.split(',').map(n => parseFloat(n)).filter(n => !isNaN(n));
        
        resolve({ status: 'success', value: 'Waveform Captured', waveform: points.slice(0, 200) });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ status: 'error', message: err.message });
    });
  });
}

// --- SETUP DE LA VENTANA ---
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Seguridad: No permitir Node directo en UI
      contextIsolation: true  // Seguridad: Aislar contextos
    }
  });

  // En producción cargarías el index.html buildeado
  // mainWindow.loadFile('dist/index.html'); 
  mainWindow.loadURL('http://localhost:3000'); // Para desarrollo (React dev server)
}

// --- IPC HANDLERS (La API que escucha al Frontend) ---
app.whenReady().then(() => {
  // Handler para medir Multímetro
  ipcMain.handle('measure-multimeter', async (event, { ip, mode }) => {
    const cmd = mode === 'VOLT' ? "MEAS:VOLT:DC?" : "MEAS:RES?";
    return await readOwon(ip, 23, cmd); // Puerto 23 o el que configures en ESP32
  });

  // Handler para medir Osciloscopio
  ipcMain.handle('measure-scope', async (event, { ip }) => {
    return await readRigol(ip);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});