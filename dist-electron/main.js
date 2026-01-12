"use strict";
const electron = require("electron");
const path = require("path");
const worker_threads = require("worker_threads");
const Store = require("electron-store");
const puppeteer = require("puppeteer");
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
function getOwonMeasurement(ip, port, measureCommand) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let response = "";
    const debug_info = `[Measure CMD: ${measureCommand}]`;
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ status: "error", message: `Timeout getting measurement. ${debug_info}` });
    }, 2e3);
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
function getRigolData(ip, port) {
  return new Promise((resolve) => {
    let processingDone = false;
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ status: "error", message: "Timeout de conexión (15s)" });
    }, 15e3);
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
        const bufferAsString = receivedData.toString("ascii");
        const binaryStartIndex = bufferAsString.indexOf("#");
        if (binaryStartIndex === -1) throw new Error("No se encontró el bloque de datos binarios (#). Buffer: " + receivedData.toString("ascii").substring(0, 100));
        const textPart = bufferAsString.substring(0, binaryStartIndex);
        const lines = textPart.trim().split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length < 4) {
          throw new Error(`Se esperaban al menos 4 líneas de texto, recibidas ${lines.length}. Buffer text: "${textPart}"`);
        }
        const vScaleStr = lines[0];
        const voltageScale = parseFloat(vScaleStr);
        const vppStr = lines[1];
        let vpp = parseFloat(vppStr);
        if (isNaN(vpp) || vpp > 1e30) vpp = 0;
        const freqStr = lines[2];
        let freq = parseFloat(freqStr);
        if (isNaN(freq) || freq > 1e30) freq = 0;
        const preambleStr = lines[3];
        const preamble = preambleStr.split(",");
        if (preamble.length < 10) throw new Error(`Preamble incompleto: ${preambleStr}`);
        const xInc = parseFloat(preamble[4]);
        const yInc = parseFloat(preamble[7]);
        const yOrg = parseFloat(preamble[8]);
        const yRef = parseFloat(preamble[9]);
        const numDigitsChar = bufferAsString[binaryStartIndex + 1];
        const numDigits = parseInt(numDigitsChar);
        if (isNaN(numDigits)) throw new Error("Error parseando el número de dígitos del bloque binario.");
        const rawDataStart = binaryStartIndex + 2 + numDigits;
        const rawData = receivedData.subarray(rawDataStart, receivedData.length);
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
        const str = receivedData.toString("ascii");
        const hashIdx = str.indexOf("#");
        if (hashIdx !== -1) {
          const textPart = str.substring(0, hashIdx);
          const lines = textPart.trim().split("\n").filter((l) => l.trim().length > 0);
          if (lines.length >= 4) {
            const nDigits = parseInt(str[hashIdx + 1]);
            if (!isNaN(nDigits)) {
              if (str.length >= hashIdx + 2 + nDigits) {
                const lengthStr = str.substring(hashIdx + 2, hashIdx + 2 + nDigits);
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
const { generateReportHtml } = require("../src/report-generator");
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
  dbQuery("close").finally(() => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
});
electron.ipcMain.handle("db:get-projects", () => dbQuery("db:get-projects"));
electron.ipcMain.handle("db:get-project-with-image", (event, projectId) => dbQuery("db:get-project-with-image", projectId));
electron.ipcMain.handle("db:create-project", (event, projectData) => dbQuery("db:create-project", projectData));
electron.ipcMain.handle("db:get-all-attributes", () => dbQuery("db:get-all-attributes"));
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
electron.ipcMain.handle("multimeter-get-measurement", async (event, config) => getOwonMeasurement(config.ip, config.port, config.measureCommand));
electron.ipcMain.handle("measure-scope", async (event, config) => getRigolData(config.ip, config.port));
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
    const browser = await puppeteer.launch({ headless: "new" });
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
