"use strict";
const electron = require("electron");
const path = require("path");
const worker_threads = require("worker_threads");
const Store = require("electron-store");
const net = require("net");
function setOwonConfig(ip, port, configCommand) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const debug_info = `[Config CMD: ${configCommand}]`;
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ status: "error", message: `Timeout setting config. ${debug_info}` });
    }, 2e3);
    client.connect(typeof port === "string" ? parseInt(port) : port, ip, () => {
      client.write(configCommand.trim() + "\n", () => {
        clearTimeout(timeout);
        client.end();
        resolve({ status: "success" });
      });
    });
    client.on("error", (err) => {
      clearTimeout(timeout);
      client.destroy();
      resolve({ status: "error", message: `${err.message}. ${debug_info}` });
    });
  });
}
function getOwonMeasurement(ip, port, measureCommand, timeoutMs = 2e3) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let response = "";
    const debug_info = `[Measure CMD: ${measureCommand}]`;
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ status: "error", message: `Timeout getting measurement. ${debug_info}` });
    }, timeoutMs);
    client.connect(typeof port === "string" ? parseInt(port) : port, ip, () => {
      client.write(measureCommand.trim() + "\n");
    });
    client.on("data", (data) => {
      response += data.toString();
      if (response.length > 0) {
        clearTimeout(timeout);
        client.destroy();
        const cleanValue = response.replace(/[^\x20-\x7E]/g, "").trim();
        resolve({ status: "success", value: cleanValue });
      }
    });
    client.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ status: "error", message: `${err.message}. ${debug_info}` });
    });
  });
}
function getRigolData(ip, port, timeoutMs = 4e3) {
  return new Promise((resolve) => {
    let processingDone = false;
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ status: "error", message: "Timeout de conexión (4s)" });
    }, timeoutMs);
    const commandString = [
      ":WAV:SOUR CHAN1",
      ":WAV:MODE NORM",
      ":WAV:FORM BYTE",
      ":CHAN1:SCAL?",
      ":MEAS:VPP?",
      ":MEAS:FREQ?",
      ":WAV:PRE?",
      ":WAV:DATA?"
    ].join("\n") + "\n";
    let receivedData = Buffer.alloc(0);
    const processAndResolve = () => {
      if (processingDone) return;
      processingDone = true;
      clearTimeout(timeout);
      client.destroy();
      try {
        if (receivedData.length === 0) throw new Error("No se recibió respuesta alguna del instrumento.");
        const binaryStartIndex = receivedData.indexOf(35);
        if (binaryStartIndex === -1) throw new Error("No se encontró el bloque de datos binarios (#).");
        const textPart = receivedData.subarray(0, binaryStartIndex).toString("utf-8");
        const lines = textPart.trim().split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 0) {
          throw new Error(`No se recibieron líneas de configuración antes de los datos binarios.`);
        }
        const preambleStr = lines[lines.length - 1];
        const preamble = preambleStr.split(",");
        if (preamble.length < 10) throw new Error(`Preamble incompleto: ${preambleStr}`);
        const freqStr = lines.length >= 2 ? lines[lines.length - 2] : "0";
        const vppStr = lines.length >= 3 ? lines[lines.length - 3] : "0";
        const vScaleStr = lines.length >= 4 ? lines[lines.length - 4] : "1";
        const voltageScale = parseFloat(vScaleStr) || 1;
        let vpp = parseFloat(vppStr);
        if (isNaN(vpp) || vpp > 1e30) vpp = 0;
        let freq = parseFloat(freqStr);
        if (isNaN(freq) || freq > 1e30) freq = 0;
        const xInc = parseFloat(preamble[4]);
        const yInc = parseFloat(preamble[7]);
        const yOrg = parseFloat(preamble[8]);
        const yRef = parseFloat(preamble[9]);
        const numDigitsChar = String.fromCharCode(receivedData[binaryStartIndex + 1]);
        const numDigits = parseInt(numDigitsChar);
        if (isNaN(numDigits)) throw new Error("Error parseando el número de dígitos del bloque binario.");
        const rawDataStart = binaryStartIndex + 2 + numDigits;
        const rawData = receivedData.subarray(rawDataStart);
        const waveform = [];
        for (let i = 0; i < rawData.length; i++) {
          if (rawData[i] === 10 && i === rawData.length - 1) continue;
          const rawVal = rawData[i];
          const voltage = (rawVal - yRef) * yInc + yOrg;
          waveform.push(voltage);
        }
        const timeScale = xInc * waveform.length / 10;
        resolve({
          status: "success",
          waveform,
          timeScale,
          // s/div
          voltageScale,
          // V/div
          voltageOffset: yOrg,
          // Approx offset
          vpp,
          freq
        });
      } catch (err) {
        console.error("Error procesando datos Rigol:", err);
        resolve({ status: "error", message: err.message });
      }
    };
    client.connect(typeof port === "string" ? parseInt(port) : port, ip, () => {
      client.write(commandString);
    });
    client.on("data", (data) => {
      receivedData = Buffer.concat([receivedData, data]);
      if (receivedData.length > 50) {
        const hashIdx = receivedData.indexOf(35);
        if (hashIdx !== -1) {
          if (receivedData.length > hashIdx + 1) {
            const nDigits = parseInt(String.fromCharCode(receivedData[hashIdx + 1]));
            if (!isNaN(nDigits)) {
              if (receivedData.length >= hashIdx + 2 + nDigits) {
                const lengthStr = receivedData.subarray(hashIdx + 2, hashIdx + 2 + nDigits).toString("utf-8");
                const dataLength = parseInt(lengthStr);
                if (!isNaN(dataLength)) {
                  const totalExpected = hashIdx + 2 + nDigits + dataLength;
                  if (receivedData.length >= totalExpected) {
                    processAndResolve();
                  }
                }
              }
            }
          }
        }
      }
    });
    client.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ status: "error", message: err.message });
    });
    client.on("end", () => {
      processAndResolve();
    });
  });
}
function testConnection(ip, port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ status: "error", message: "Timeout" });
    }, 2e3);
    client.connect(typeof port === "string" ? parseInt(port) : port, ip, () => {
      clearTimeout(timeout);
      client.end();
      resolve({ status: "success" });
    });
    client.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ status: "error", message: err.message });
    });
  });
}
const bufferToBase64 = (buffer) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  } else {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
};
function generateWaveformSvg(measurement) {
  if (!measurement || !measurement.waveform || !Array.isArray(measurement.waveform)) return "No waveform data";
  const waveform = measurement.waveform || [];
  const voltageScale = measurement.voltageScale || 1;
  const voltageOffset = measurement.voltageOffset || 0;
  const timeScale = measurement.timeScale || 1;
  const vpp = measurement.vpp;
  const freq = measurement.freq;
  const svgWidth = 500, svgHeight = 300;
  const numDivX = 10, numDivY = 8;
  const stepX = svgWidth / numDivX, stepY = svgHeight / numDivY;
  let gridLines = "";
  for (let i = 1; i < numDivX; i++) gridLines += `<line x1="${i * stepX}" y1="0" x2="${i * stepX}" y2="${svgHeight}" stroke="#e5e7eb" stroke-width="1" />`;
  for (let i = 1; i < numDivY; i++) gridLines += `<line x1="0" y1="${i * stepY}" x2="${svgWidth}" y2="${i * stepY}" stroke="#e5e7eb" stroke-width="1" />`;
  gridLines += `<line x1="${svgWidth / 2}" y1="0" x2="${svgWidth / 2}" y2="${svgHeight}" stroke="#9ca3af" stroke-width="1" />`;
  gridLines += `<line x1="0" y1="${svgHeight / 2}" x2="${svgWidth}" y2="${svgHeight / 2}" stroke="#9ca3af" stroke-width="1" />`;
  const vRange = numDivY * voltageScale;
  const vBottom = voltageOffset - vRange / 2;
  const pointsStr = waveform.map((val, i) => {
    const x = i / (waveform.length - 1) * svgWidth;
    const yPercent = vRange === 0 ? 0.5 : (val - vBottom) / vRange;
    const y = Math.max(0, Math.min(svgHeight, svgHeight - yPercent * svgHeight));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `
        <div style="font-family: monospace; background: #fff; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; display: inline-block;">
            <div style="background: #f3f4f6; padding: 5px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #374151; display: flex; justify-content: space-between;">
                <span><strong>Scale:</strong> ${voltageScale} V/div | ${timeScale} s/div</span>
                <span><strong>Vpp:</strong> ${vpp ? vpp.toFixed(2) + " V" : "--"} | <strong>Freq:</strong> ${freq ? freq.toFixed(2) + " Hz" : "--"}</span>
            </div>
            <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="display: block;">
                <rect width="100%" height="100%" fill="#ffffff" />
                ${gridLines}
                <polyline points="${pointsStr}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" />
            </svg>
        </div>
    `;
}
function renderMeasurementValue(measurement) {
  if (measurement.type === "oscilloscope") {
    return generateWaveformSvg(measurement);
  }
  if (typeof measurement.value === "object" && measurement.value !== null) {
    return `<pre>${JSON.stringify(measurement.value, null, 2)}</pre>`;
  }
  return String(measurement.value ?? "");
}
function generateReportHtml(project, points) {
  const imageAsBase64 = project.image_data ? `data:image/png;base64,${bufferToBase64(project.image_data)}` : "";
  let attributesHtml = "<li>No attributes defined.</li>";
  if (project.attributes) {
    let attrs = {};
    if (typeof project.attributes === "string") {
      try {
        attrs = JSON.parse(project.attributes);
      } catch (e) {
      }
    } else {
      attrs = project.attributes;
    }
    attributesHtml = Object.entries(attrs).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join("");
  }
  const pointsHtml = points.map((p, index) => {
    let measurementsHtml = "<p><em>No measurements recorded.</em></p>";
    if (p.measurements && Object.keys(p.measurements).length > 0) {
      measurementsHtml = Object.entries(p.measurements).map(([type, data]) => `
                <div style="margin-bottom: 15px; border-left: 3px solid #ddd; padding-left: 10px;">
                    <div style="font-weight: bold; text-transform: capitalize; color: #555;">${type}</div>
                    <div style="margin-top: 5px;">${renderMeasurementValue(data)}</div>
                    <div style="font-size: 10px; color: #888; margin-top: 2px;">Captured: ${data.capturedAt ? new Date(data.capturedAt).toLocaleString() : "N/A"}</div>
                </div>
            `).join("");
    }
    const pointX = (p.x * 1).toFixed(0);
    const pointY = (p.y * 1).toFixed(0);
    return `
            <div class="point-section">
                <h3>Point ${index + 1}: ${p.label} <span style="font-size: 12px; font-weight: normal; color: #666;">(X:${pointX}, Y:${pointY})</span></h3>
                ${p.notes ? `<p style="background: #fff3cd; padding: 10px; border-radius: 4px; font-style: italic;"><strong>Note:</strong> ${p.notes}</p>` : ""}
                <div style="margin-top: 10px;">
                    ${measurementsHtml}
                </div>
                <hr style="border: 0; border-top: 1px dashed #ddd; margin: 20px 0;">
            </div>
        `;
  }).join("");
  return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Diagnóstico: ${project.board_model}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #333; }
                h1, h2, h3 { color: #000; }
                h1 { font-size: 28px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
                h2 { font-size: 22px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 40px; }
                h3 { font-size: 18px; }
                .project-details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                .project-details ul { list-style: none; padding: 0; }
                .point-section { margin-bottom: 30px; page-break-inside: avoid; }
                .board-image { max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 8px; margin-top: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; vertical-align: top; }
                th { background-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                pre { margin: 0; padding: 0; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; }
            </style>
        </head>
        <body>
            <h1>Reporte de Diagnóstico</h1>
            <div class="project-details">
                <h2>${project.board_type} - ${project.board_model}</h2>
                <ul>${attributesHtml}</ul>
                <p><i>Generado el: ${(/* @__PURE__ */ new Date()).toLocaleString()}</i></p>
            </div>

            <h2>Imagen de la Placa</h2>
            ${imageAsBase64 ? `<img src="${imageAsBase64}" class="board-image" />` : "<p>No image available.</p>"}

            <h2>Puntos de Medición</h2>
            ${pointsHtml || "<p>No measurement points recorded.</p>"}
        </body>
        </html>
    `;
}
const store = new Store();
if (require("electron-squirrel-startup")) {
  electron.app.quit();
}
let mainWindow = null;
const dbPath = path.join(electron.app.getPath("userData"), "boardlab.db");
const dbWorker = new worker_threads.Worker(path.join(__dirname, "db-worker.js"), {
  workerData: { dbPath }
});
const pendingQueries = /* @__PURE__ */ new Map();
let queryId = 0;
dbWorker.on("message", (msg) => {
  const { id, result, error } = msg;
  if (pendingQueries.has(id)) {
    const { resolve, reject } = pendingQueries.get(id);
    pendingQueries.delete(id);
    if (error) {
      console.error("Database worker error:", error);
      reject(new Error(error.message));
    } else {
      resolve(result);
    }
  }
});
dbWorker.on("error", (err) => console.error("DB worker error:", err));
dbWorker.on("exit", (code) => {
  if (code !== 0) console.error(`DB worker stopped with exit code ${code}`);
});
function dbQuery(type, payload) {
  return new Promise((resolve, reject) => {
    const id = queryId++;
    pendingQueries.set(id, { resolve, reject });
    dbWorker.postMessage({ id, type, payload });
  });
}
let multimeterSocket = null;
function startMultimeterMonitor(ip, port) {
  stopMultimeterMonitor();
  console.log(`Starting Multimeter Monitor on ${ip}:${port}`);
  multimeterSocket = new net.Socket();
  multimeterSocket.connect(port, ip, () => {
    console.log("Multimeter Monitor Connected");
    if (mainWindow) mainWindow.webContents.send("monitor-status", "connected");
  });
  multimeterSocket.on("data", (data) => {
    const rawData = data.toString().trim();
    if (rawData) {
      console.log("Monitor Data Received:", rawData);
      const cleanValue = rawData.replace(/[^\x20-\x7E]/g, "");
      if (mainWindow) {
        mainWindow.webContents.send("external-trigger", cleanValue);
      }
    }
  });
  multimeterSocket.on("error", (err) => {
    console.error("Multimeter Monitor Error:", err);
    if (mainWindow) mainWindow.webContents.send("monitor-status", "error");
  });
  multimeterSocket.on("close", () => {
    console.log("Multimeter Monitor Closed");
    if (mainWindow) mainWindow.webContents.send("monitor-status", "disconnected");
    multimeterSocket = null;
  });
}
function stopMultimeterMonitor() {
  if (multimeterSocket) {
    multimeterSocket.destroy();
    multimeterSocket = null;
  }
}
electron.ipcMain.handle("start-monitor", async (event, { ip, port }) => {
  try {
    startMultimeterMonitor(ip, port);
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error.message };
  }
});
electron.ipcMain.handle("stop-monitor", async () => {
  stopMultimeterMonitor();
  return { status: "success" };
});
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log("Cargando aplicación desde Vite Server...");
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    console.log("Cargando aplicación desde el build de producción...");
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      responseHeaders["Content-Security-Policy"] = [
        "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:"
      ];
      callback({ responseHeaders });
    });
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.on("ready", createWindow);
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
electron.app.on("window-all-closed", () => {
  dbQuery("close", void 0).finally(() => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
});
electron.ipcMain.handle("db:get-projects", () => dbQuery("db:get-projects", void 0));
electron.ipcMain.handle("db:get-project-with-image", (event, projectId) => dbQuery("db:get-project-with-image", projectId));
electron.ipcMain.handle("db:create-project", (event, projectData) => dbQuery("db:create-project", projectData));
electron.ipcMain.handle("db:get-all-attributes", () => dbQuery("db:get-all-attributes", void 0));
electron.ipcMain.handle("db:save-points", (event, payload) => dbQuery("db:save-points", payload));
electron.ipcMain.handle("db:get-points", (event, projectId) => dbQuery("db:get-points", projectId));
electron.ipcMain.handle("db:save-measurement", (event, payload) => dbQuery("db:save-measurement", payload));
electron.ipcMain.handle("db:createMeasurement", (event, payload) => dbQuery("db:createMeasurement", payload));
electron.ipcMain.handle("db:getMeasurementsForPoint", (event, pointId) => dbQuery("db:getMeasurementsForPoint", pointId));
electron.ipcMain.handle("db:delete-project", (event, projectId) => dbQuery("db:delete-project", projectId));
electron.ipcMain.handle("db:delete-point", (event, pointId) => dbQuery("db:delete-point", pointId));
electron.ipcMain.handle("db:update-project", (event, projectData) => dbQuery("db:update-project", projectData));
electron.ipcMain.handle("hardware:measure-resistance", async () => {
});
electron.ipcMain.handle("multimeter-set-config", async (event, config) => setOwonConfig(config.ip, config.port, config.configCommand));
electron.ipcMain.handle("multimeter-get-measurement", async (event, config) => getOwonMeasurement(config.ip, config.port, config.measureCommand, config.timeout));
electron.ipcMain.handle("measure-scope", async (event, config) => getRigolData(config.ip, config.port, config.timeout));
electron.ipcMain.handle("test-connection", async (event, { ip, port }) => testConnection(ip, port));
electron.ipcMain.handle("save-config", (event, config) => store.set("instrumentConfig", config));
electron.ipcMain.handle("load-config", () => store.get("instrumentConfig"));
electron.ipcMain.handle("save-api-key", (event, apiKey) => store.set("geminiApiKey", apiKey));
electron.ipcMain.handle("load-api-key", () => store.get("geminiApiKey"));
electron.ipcMain.handle("save-app-settings", (event, settings) => store.set("appSettings", settings));
electron.ipcMain.handle("load-app-settings", () => store.get("appSettings"));
electron.ipcMain.handle("exportPdf", async (event, projectId) => {
  const { canceled, filePath } = await electron.dialog.showSaveDialog({
    title: "Save Report as PDF",
    defaultPath: `boardlab-report-${projectId}-${Date.now()}.pdf`,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }]
  });
  if (canceled || !filePath) {
    return { status: "cancelled" };
  }
  try {
    const project = await dbQuery("db:get-project-with-image", projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found.`);
    }
    const pointsWithMeasurements = await dbQuery("db:get-points", projectId);
    const htmlContent = generateReportHtml(project, pointsWithMeasurements);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    await page.pdf({ path: filePath, format: "A4", printBackground: true });
    await browser.close();
    return { status: "success", filePath };
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    return { status: "error", message: error.message };
  }
});
electron.ipcMain.handle("get-board-types", () => {
  const defaultTypes = ["Laptop", "Desktop", "Industrial", "Mobile", "Other"];
  const savedTypes = store.get("boardTypes", []);
  return [.../* @__PURE__ */ new Set([...defaultTypes, ...savedTypes])];
});
electron.ipcMain.handle("add-board-type", (event, newType) => {
  if (!newType) return;
  const currentTypes = store.get("boardTypes", []);
  if (!currentTypes.includes(newType)) {
    store.set("boardTypes", [...currentTypes, newType]);
  }
  return true;
});
