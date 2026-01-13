"use strict";
const worker_threads = require("worker_threads");
const Database = require("better-sqlite3");
if (!worker_threads.parentPort) throw new Error("This file must be run as a worker thread.");
const db = new Database(worker_threads.workerData.dbPath);
db.pragma("foreign_keys = ON");
console.log(`Worker: Database initialized at ${worker_threads.workerData.dbPath}`);
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_type TEXT,
    board_model TEXT,
    attributes TEXT,
    notes TEXT,
    image_data BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try {
  const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
  const hasNotes = tableInfo.some((col) => col.name === "notes");
  if (!hasNotes) {
    db.exec("ALTER TABLE projects ADD COLUMN notes TEXT");
    console.log("Worker: Migrated projects table to include 'notes' column.");
  }
} catch (e) {
  console.error("Worker: Error migrating projects table:", e);
}
db.exec(`
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    x REAL NOT NULL,
    y REAL NOT NULL,
    label TEXT,
    notes TEXT,
    type TEXT,
    category TEXT,
    tolerance REAL,
    expected_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );
`);
try {
  const pointTableInfo = db.prepare("PRAGMA table_info(points)").all();
  const hasTolerance = pointTableInfo.some((col) => col.name === "tolerance");
  const hasCategory = pointTableInfo.some((col) => col.name === "category");
  if (!hasTolerance) {
    db.exec("ALTER TABLE points ADD COLUMN tolerance REAL");
    db.exec("ALTER TABLE points ADD COLUMN expected_value TEXT");
    console.log("Worker: Migrated points table to include 'tolerance' and 'expected_value' columns.");
  }
  if (!hasCategory) {
    db.exec("ALTER TABLE points ADD COLUMN category TEXT");
    console.log("Worker: Migrated points table to include 'category' column.");
  }
} catch (e) {
  console.error("Worker: Error migrating points table:", e);
}
db.exec(`
  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    point_id INTEGER,
    type TEXT NOT NULL,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (point_id) REFERENCES points (id)
  );
`);
console.log("Worker: Database schema ensured.");
async function handleMessage(msg) {
  var _a, _b, _c;
  const { id, type, payload } = msg;
  try {
    let result;
    switch (type) {
      case "db:get-projects":
        const projects = db.prepare("SELECT id, board_type, board_model, attributes, notes, created_at FROM projects ORDER BY created_at DESC").all();
        result = projects.map((p) => ({
          ...p,
          attributes: JSON.parse(p.attributes || "{}")
        }));
        break;
      case "db:get-project-with-image":
        const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(payload);
        if (project) {
          project.attributes = JSON.parse(project.attributes || "{}");
        }
        result = project;
        break;
      case "db:create-project":
        const { board_type, board_model, attributes, image_data, notes } = payload;
        const imageBuffer = Buffer.from(image_data);
        const insertResult = db.prepare(
          "INSERT INTO projects (board_type, board_model, attributes, image_data, notes) VALUES (?, ?, ?, ?, ?)"
        ).run(board_type, board_model, JSON.stringify(attributes), imageBuffer, notes || "");
        result = { id: insertResult.lastInsertRowid, ...payload, image_data: imageBuffer };
        break;
      case "db:get-all-attributes":
        const targetBoardType = payload == null ? void 0 : payload.boardType;
        let projectAttrs;
        if (targetBoardType) {
          projectAttrs = db.prepare("SELECT attributes FROM projects WHERE attributes IS NOT NULL AND board_type = ?").all(targetBoardType);
        } else {
          projectAttrs = db.prepare("SELECT attributes FROM projects WHERE attributes IS NOT NULL").all();
        }
        const keys = /* @__PURE__ */ new Set();
        const values = /* @__PURE__ */ new Set();
        for (const proj of projectAttrs) {
          try {
            const attrs = JSON.parse(proj.attributes);
            for (const key in attrs) {
              keys.add(key);
              if (typeof attrs[key] === "string" && attrs[key].trim() !== "") {
                values.add(attrs[key]);
              }
            }
          } catch (e) {
          }
        }
        result = { keys: [...keys].sort(), values: [...values].sort() };
        break;
      case "db:save-points":
        const { projectId, points } = payload;
        const insertStmt = db.prepare("INSERT INTO points (project_id, x, y, label, notes, type, category, tolerance, expected_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        const updateStmt = db.prepare("UPDATE points SET x = ?, y = ?, label = ?, notes = ?, type = ?, category = ?, tolerance = ?, expected_value = ? WHERE id = ?");
        const savedRows = [];
        const transaction = db.transaction((pts) => {
          for (const point of pts) {
            if (typeof point.id === "string" && point.id.startsWith("temp-")) {
              const res = insertStmt.run(projectId, point.x, point.y, point.label, point.notes || "", point.type || "voltage", point.category || null, point.tolerance || null, point.expected_value || null);
              const row = db.prepare("SELECT * FROM points WHERE id = ?").get(res.lastInsertRowid);
              if (row) {
                row.temp_id = point.id;
                savedRows.push(row);
              }
            } else if (typeof point.id === "number") {
              updateStmt.run(point.x, point.y, point.label, point.notes || "", point.type || "voltage", point.category || null, point.tolerance || null, point.expected_value || null, point.id);
              const row = db.prepare("SELECT * FROM points WHERE id = ?").get(point.id);
              if (row) savedRows.push(row);
            }
          }
        });
        transaction(points);
        const finalPoints = db.prepare("SELECT * FROM points WHERE project_id = ?").all(projectId);
        const getMeasurementsStmt = db.prepare("SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC");
        result = finalPoints.map((point) => {
          const measurements = getMeasurementsStmt.all(point.id);
          const measurementsByType = {};
          for (const m of measurements) {
            if (!measurementsByType[m.type]) {
              try {
                const parsedValue = JSON.parse(m.value);
                if (m.type === "oscilloscope") {
                  measurementsByType[m.type] = { ...parsedValue, capturedAt: m.created_at };
                } else {
                  measurementsByType[m.type] = { type: m.type, value: parsedValue, capturedAt: m.created_at };
                }
              } catch (e) {
                measurementsByType[m.type] = { type: m.type, value: m.value, capturedAt: m.created_at };
              }
            }
          }
          const originalPoint = savedRows.find((sr) => sr.id === point.id);
          return { ...point, measurements: measurementsByType, temp_id: originalPoint == null ? void 0 : originalPoint.temp_id };
        });
        break;
      case "db:get-points":
        const pointsOnly = db.prepare("SELECT * FROM points WHERE project_id = ?").all(payload);
        const getMeasStmt = db.prepare("SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC");
        result = pointsOnly.map((point) => {
          const measurements = getMeasStmt.all(point.id);
          const measurementsByType = {};
          for (const m of measurements) {
            if (!measurementsByType[m.type]) {
              try {
                const parsedValue = JSON.parse(m.value);
                if (m.type === "oscilloscope") {
                  measurementsByType[m.type] = { ...parsedValue, capturedAt: m.created_at };
                } else {
                  measurementsByType[m.type] = { type: m.type, value: parsedValue, capturedAt: m.created_at };
                }
              } catch (e) {
                measurementsByType[m.type] = { type: m.type, value: m.value, capturedAt: m.created_at };
              }
            }
          }
          return { ...point, measurements: measurementsByType };
        });
        break;
      case "db:save-measurement":
      case "db:createMeasurement":
        const { pointId, type: measType, value: measValue } = payload || {};
        if (!pointId || !measType) {
          throw new Error("Invalid payload: pointId and type are required");
        }
        const insertMeasResult = db.prepare("INSERT INTO measurements (point_id, type, value) VALUES (?, ?, ?)").run(pointId, measType, JSON.stringify(measValue));
        result = { id: insertMeasResult.lastInsertRowid };
        break;
      case "db:getMeasurementsForPoint":
        if (!payload) {
          result = [];
        } else {
          result = db.prepare("SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC").all(payload);
        }
        break;
      case "db:delete-project":
        if (!payload) {
          throw new Error("projectId required");
        }
        const deleteTransaction = db.transaction((pid) => {
          db.prepare("DELETE FROM measurements WHERE point_id IN (SELECT id FROM points WHERE project_id = ?)").run(pid);
          db.prepare("DELETE FROM points WHERE project_id = ?").run(pid);
          db.prepare("DELETE FROM projects WHERE id = ?").run(pid);
        });
        deleteTransaction(payload);
        result = { status: "success" };
        break;
      case "db:delete-point":
        if (!payload) {
          throw new Error("Point ID is required");
        }
        const deletePointTransaction = db.transaction((pointId2) => {
          db.prepare("DELETE FROM measurements WHERE point_id = ?").run(pointId2);
          const res = db.prepare("DELETE FROM points WHERE id = ?").run(pointId2);
          return res;
        });
        const deletePointResult = deletePointTransaction(payload);
        if (deletePointResult.changes > 0) {
          result = { status: "success" };
        } else {
          result = { status: "error", message: "Point not found or not deleted" };
        }
        break;
      case "db:update-project":
        const { id: projId, board_model: newModel, board_type: newType, attributes: newAttrs, notes: newNotes } = payload;
        if (!projId) throw new Error("Project ID required");
        const updateProjResult = db.prepare(
          "UPDATE projects SET board_model = ?, board_type = ?, attributes = ?, notes = ? WHERE id = ?"
        ).run(newModel, newType, JSON.stringify(newAttrs), newNotes || "", projId);
        if (updateProjResult.changes > 0) {
          result = { status: "success", ...payload };
        } else {
          result = { status: "error", message: "Project not found or no changes made" };
        }
        break;
      case "db:search-projects-by-point":
        const searchTerm = `%${payload}%`;
        const searchResults = db.prepare(`
                    SELECT DISTINCT p.id 
                    FROM projects p
                    JOIN points pt ON p.id = pt.project_id
                    WHERE pt.label LIKE ? OR pt.category LIKE ?
                `).all(searchTerm, searchTerm);
        result = searchResults.map((row) => row.id);
        break;
      case "close":
        console.log("Worker: Compacting database before closing...");
        db.exec("VACUUM");
        db.close();
        console.log("Worker: Database connection closed.");
        (_a = worker_threads.parentPort) == null ? void 0 : _a.postMessage({ id, result: { status: "closed" } });
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown database operation: ${type}`);
    }
    (_b = worker_threads.parentPort) == null ? void 0 : _b.postMessage({ id, result });
  } catch (error) {
    (_c = worker_threads.parentPort) == null ? void 0 : _c.postMessage({ id, error: { message: error.message, stack: error.stack } });
  }
}
worker_threads.parentPort.on("message", handleMessage);
