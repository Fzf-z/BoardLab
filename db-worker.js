const { parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');
const path = require('path');

// The database path is passed in from the main thread
const db = new Database(workerData.dbPath);
db.pragma('foreign_keys = ON'); // Enable foreign key constraints (critical for cascading deletes)
console.log(`Worker: Database initialized at ${workerData.dbPath}`);

// Create schema if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_type TEXT,
    board_model TEXT,
    attributes TEXT,
    image_data BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    x REAL NOT NULL,
    y REAL NOT NULL,
    label TEXT,
    notes TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );
`);
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
console.log('Worker: Database schema ensured.');


// Function to handle database operations based on message
async function handleMessage(msg) {
    const { id, type, payload } = msg;

    try {
        let result;
        switch (type) {
            case 'db:get-projects':
                const projects = db.prepare('SELECT id, board_type, board_model, attributes, created_at FROM projects ORDER BY created_at DESC').all();
                result = projects.map(p => ({
                    ...p,
                    attributes: JSON.parse(p.attributes || '{}')
                }));
                break;
            
            case 'db:get-project-with-image':
                const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(payload);
                if (project) {
                    project.attributes = JSON.parse(project.attributes || '{}');
                }
                result = project;
                break;

            case 'db:create-project':
                const { board_type, board_model, attributes, image_data } = payload;
                const imageBuffer = Buffer.from(image_data);
                const insertResult = db.prepare(
                    'INSERT INTO projects (board_type, board_model, attributes, image_data) VALUES (?, ?, ?, ?)'
                ).run(board_type, board_model, JSON.stringify(attributes), imageBuffer);
                result = { id: insertResult.lastInsertRowid, ...payload, image_data: imageBuffer };
                break;

            case 'db:get-all-attributes':
                const projectAttrs = db.prepare('SELECT attributes FROM projects WHERE attributes IS NOT NULL').all();
                const keys = new Set();
                const values = new Set();
                for (const proj of projectAttrs) {
                    try {
                        const attrs = JSON.parse(proj.attributes);
                        for (const key in attrs) {
                            keys.add(key);
                            if (typeof attrs[key] === 'string' && attrs[key].trim() !== '') {
                                values.add(attrs[key]);
                            }
                        }
                    } catch (e) { /* ignore parse error */ }
                }
                result = { keys: [...keys].sort(), values: [...values].sort() };
                break;

            case 'db:save-points':
                const { projectId, points } = payload;
                const insertStmt = db.prepare('INSERT INTO points (project_id, x, y, label, notes, type) VALUES (?, ?, ?, ?, ?, ?)');
                const updateStmt = db.prepare('UPDATE points SET x = ?, y = ?, label = ?, notes = ?, type = ? WHERE id = ?');
                const savedRows = [];
                const transaction = db.transaction((pts) => {
                    for (const point of pts) {
                        if (typeof point.id === 'string' && point.id.startsWith('temp-')) {
                            const res = insertStmt.run(projectId, point.x, point.y, point.label, point.notes || '', point.type || 'voltage');
                            const row = db.prepare('SELECT * FROM points WHERE id = ?').get(res.lastInsertRowid);
                            if (row) {
                                row.temp_id = point.id;
                                savedRows.push(row);
                            }
                        } else if (typeof point.id === 'number') {
                            updateStmt.run(point.x, point.y, point.label, point.notes || '', point.type || 'voltage', point.id);
                            const row = db.prepare('SELECT * FROM points WHERE id = ?').get(point.id);
                            if (row) savedRows.push(row);
                        }
                    }
                });
                transaction(points);
                const finalPoints = db.prepare('SELECT * FROM points WHERE project_id = ?').all(projectId);
                const getMeasurementsStmt = db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');
                result = finalPoints.map(point => {
                    const measurements = getMeasurementsStmt.all(point.id);
                    const measurementsByType = {};
                    for (const m of measurements) {
                        if (!measurementsByType[m.type]) {
                            try {
                                const parsedValue = JSON.parse(m.value);
                                if (m.type === 'oscilloscope') {
                                    measurementsByType[m.type] = { ...parsedValue, capturedAt: m.created_at };
                                } else {
                                    measurementsByType[m.type] = { type: m.type, value: parsedValue, capturedAt: m.created_at };
                                }
                            } catch (e) {
                                measurementsByType[m.type] = { type: m.type, value: m.value, capturedAt: m.created_at };
                            }
                        }
                    }
                    const originalPoint = savedRows.find(sr => sr.id === point.id);
                    return { ...point, measurements: measurementsByType, temp_id: originalPoint?.temp_id };
                });
                break;

            case 'db:get-points':
                const pointsOnly = db.prepare('SELECT * FROM points WHERE project_id = ?').all(payload);
                const getMeasStmt = db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');
                result = pointsOnly.map(point => {
                    const measurements = getMeasStmt.all(point.id);
                    const measurementsByType = {};
                    for (const m of measurements) {
                        if (!measurementsByType[m.type]) {
                            try {
                                const parsedValue = JSON.parse(m.value);
                                if (m.type === 'oscilloscope') {
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

            case 'db:save-measurement':
            case 'db:createMeasurement':
                const { pointId, type: measType, value: measValue } = payload || {};
                if (!pointId || !measType) {
                    throw new Error('Invalid payload: pointId and type are required');
                }
                const insertMeasResult = db.prepare('INSERT INTO measurements (point_id, type, value) VALUES (?, ?, ?)')
                    .run(pointId, measType, JSON.stringify(measValue));
                result = { id: insertMeasResult.lastInsertRowid };
                break;

            case 'db:getMeasurementsForPoint':
                if (!payload) {
                    result = [];
                } else {
                    result = db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC').all(payload);
                }
                break;

            case 'db:delete-project':
                if (!payload) {
                    throw new Error('projectId required');
                }
                const deleteTransaction = db.transaction((pid) => {
                    db.prepare('DELETE FROM measurements WHERE point_id IN (SELECT id FROM points WHERE project_id = ?)').run(pid);
                    db.prepare('DELETE FROM points WHERE project_id = ?').run(pid);
                    db.prepare('DELETE FROM projects WHERE id = ?').run(pid);
                });
                deleteTransaction(payload);
                result = { status: 'success' };
                break;

            case 'db:delete-point':
                if (!payload) {
                    throw new Error('Point ID is required');
                }
                const deletePointTransaction = db.transaction((pointId) => {
                    // Manually delete measurements first to avoid FK constraint issues
                    db.prepare('DELETE FROM measurements WHERE point_id = ?').run(pointId);
                    const res = db.prepare('DELETE FROM points WHERE id = ?').run(pointId);
                    return res;
                });
                
                const deletePointResult = deletePointTransaction(payload);
                
                if (deletePointResult.changes > 0) {
                    result = { status: 'success' };
                } else {
                    result = { status: 'error', message: 'Point not found or not deleted' };
                }
                break;

            case 'close':
                db.close();
                parentPort.postMessage({ id, result: { status: 'closed' } });
                process.exit(0);
                break;

            default:
                throw new Error(`Unknown database operation: ${type}`);
        }
        parentPort.postMessage({ id, result });
    } catch (error) {
        parentPort.postMessage({ id, error: { message: error.message, stack: error.stack } });
    }
}

parentPort.on('message', handleMessage);
