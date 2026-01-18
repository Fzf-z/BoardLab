import { parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3';

if (!parentPort) throw new Error("This file must be run as a worker thread.");

// The database path is passed in from the main thread
const db = new Database(workerData.dbPath);
db.pragma('foreign_keys = ON'); // Enable foreign key constraints
console.log(`Worker: Database initialized at ${workerData.dbPath}`);

// Create schema if it doesn't exist
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

// Migration: Ensure 'notes' column exists in projects
try {
  const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as any[];
  const hasNotes = tableInfo.some(col => col.name === 'notes');
  const hasImageB = tableInfo.some(col => col.name === 'image_data_b');
  if (!hasNotes) {
    db.exec("ALTER TABLE projects ADD COLUMN notes TEXT");
    console.log("Worker: Migrated projects table to include 'notes' column.");
  }
  if (!hasImageB) {
    db.exec("ALTER TABLE projects ADD COLUMN image_data_b BLOB");
    console.log("Worker: Migrated projects table to include 'image_data_b' column.");
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

// Migration: Ensure 'tolerance' and 'expected_value' columns exist in points
try {
  const pointTableInfo = db.prepare("PRAGMA table_info(points)").all() as any[];
  const hasTolerance = pointTableInfo.some(col => col.name === 'tolerance');
  const hasCategory = pointTableInfo.some(col => col.name === 'category');
  const hasSide = pointTableInfo.some(col => col.name === 'side');
  if (!hasTolerance) {
    db.exec("ALTER TABLE points ADD COLUMN tolerance REAL");
    db.exec("ALTER TABLE points ADD COLUMN expected_value TEXT");
    console.log("Worker: Migrated points table to include 'tolerance' and 'expected_value' columns.");
  }
  if (!hasCategory) {
    db.exec("ALTER TABLE points ADD COLUMN category TEXT");
    console.log("Worker: Migrated points table to include 'category' column.");
  }
  if (!hasSide) {
    db.exec("ALTER TABLE points ADD COLUMN side TEXT DEFAULT 'A'");
    console.log("Worker: Migrated points table to include 'side' column.");
  }
  const hasParentPointId = pointTableInfo.some(col => col.name === 'parent_point_id');
  if (!hasParentPointId) {
    db.exec("ALTER TABLE points ADD COLUMN parent_point_id INTEGER");
    console.log("Worker: Migrated points table to include 'parent_point_id' column.");
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

// Create instruments table
db.exec(`
  CREATE TABLE IF NOT EXISTS instruments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'multimeter' | 'oscilloscope'
    connection_type TEXT NOT NULL, -- 'tcp_raw' | 'serial'
    ip_address TEXT,
    port INTEGER,
    serial_settings TEXT, -- JSON
    command_map TEXT, -- JSON
    is_active INTEGER DEFAULT 0
  );
`);

// Seed default instruments if table is empty
const instrumentCount = db.prepare('SELECT COUNT(*) as count FROM instruments').get() as { count: number };
if (instrumentCount.count === 0) {
    const insertInstrument = db.prepare(`
        INSERT INTO instruments (name, type, connection_type, ip_address, port, command_map, is_active)
        VALUES (@name, @type, @connection_type, @ip_address, @port, @command_map, @is_active)
    `);

    // 1. Owon XDM1241 (Default)
    insertInstrument.run({
        name: 'Owon XDM1241 (Default)',
        type: 'multimeter',
        connection_type: 'tcp_raw',
        ip_address: '192.168.1.100', // Default placeholder
        port: 9876,
        command_map: JSON.stringify({
            "READ_DC": "MEAS:SHOW?",
            "READ_RESISTANCE": "MEAS:SHOW?",
            "READ_DIODE": "MEAS:SHOW?", 
            "CONFIGURE_VOLTAGE": "CONF:VOLT:DC AUTO",
            "CONFIGURE_RESISTANCE": "CONF:RES AUTO",
            "CONFIGURE_DIODE": "CONF:DIOD",
            "IDN": "*IDN?"
        }),
        is_active: 1
    });

    // 2. Rigol DHO814 (Default)
    insertInstrument.run({
        name: 'Rigol DHO814 (Default)',
        type: 'oscilloscope',
        connection_type: 'tcp_raw',
        ip_address: '192.168.1.102', // Default placeholder
        port: 5555,
        command_map: JSON.stringify({
            "IDN": "*IDN?",
            "SETUP_WAVE": ":WAV:SOUR CHAN1", // Example
            "READ_WAVE": ":WAV:DATA?"
        }),
        is_active: 1
    });
    console.log('Worker: Seeded default instruments.');
} else {
    // MIGRATION: Fix existing Owon instrument to include new CONFIGURE commands
    try {
        const owon = db.prepare("SELECT * FROM instruments WHERE name LIKE 'Owon%' AND type='multimeter'").get() as any;
        if (owon) {
            const cmdMap = JSON.parse(owon.command_map);
            if (!cmdMap["CONFIGURE_VOLTAGE"]) {
                console.log("Worker: Migrating Owon instrument commands...");
                cmdMap["CONFIGURE_VOLTAGE"] = "CONF:VOLT:DC AUTO";
                cmdMap["CONFIGURE_RESISTANCE"] = "CONF:RES AUTO";
                cmdMap["CONFIGURE_DIODE"] = "CONF:DIOD";
                cmdMap["READ_DIODE"] = "MEAS:DIOD?";
                
                db.prepare("UPDATE instruments SET command_map = ? WHERE id = ?")
                  .run(JSON.stringify(cmdMap), owon.id);
                console.log("Worker: Owon commands updated successfully.");
            }
        }
    } catch (e) {
        console.error("Worker: Error migrating instrument commands:", e);
    }
}

console.log('Worker: Database schema ensured.');


// Function to handle database operations based on message
async function handleMessage(msg: any) {
    const { id, type, payload } = msg;

    try {
        let result;
        switch (type) {
            case 'db:get-projects':
                const projects = db.prepare('SELECT id, board_type, board_model, attributes, notes, created_at FROM projects ORDER BY created_at DESC').all() as any[];
                result = projects.map(p => ({
                    ...p,
                    attributes: JSON.parse(p.attributes || '{}')
                }));
                break;
            
            case 'db:get-project-with-image':
                const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(payload) as any;
                if (project) {
                    project.attributes = JSON.parse(project.attributes || '{}');
                }
                result = project;
                break;

            case 'db:create-project':
                const { board_type, board_model, attributes, image_data, image_data_b, notes } = payload;
                const imageBuffer = Buffer.from(image_data);
                const imageBufferB = image_data_b ? Buffer.from(image_data_b) : null;
                const insertResult = db.prepare(
                    'INSERT INTO projects (board_type, board_model, attributes, image_data, image_data_b, notes) VALUES (?, ?, ?, ?, ?, ?)'
                ).run(board_type, board_model, JSON.stringify(attributes), imageBuffer, imageBufferB, notes || '');
                result = { id: insertResult.lastInsertRowid, ...payload, image_data: imageBuffer, image_data_b: imageBufferB };
                break;

            case 'db:get-all-attributes':
                const targetBoardType = payload?.boardType;
                let projectAttrs;
                
                if (targetBoardType) {
                    projectAttrs = db.prepare('SELECT attributes FROM projects WHERE attributes IS NOT NULL AND board_type = ?').all(targetBoardType) as any[];
                } else {
                    projectAttrs = db.prepare('SELECT attributes FROM projects WHERE attributes IS NOT NULL').all() as any[];
                }

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
                const insertStmt = db.prepare('INSERT INTO points (project_id, x, y, label, notes, type, category, tolerance, expected_value, side, parent_point_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                const updateStmt = db.prepare('UPDATE points SET x = ?, y = ?, label = ?, notes = ?, type = ?, category = ?, tolerance = ?, expected_value = ?, side = ?, parent_point_id = ? WHERE id = ?');
                const savedRows: any[] = [];
                const transaction = db.transaction((pts: any[]) => {
                    for (const point of pts) {
                        // Ensure parentPointId is valid.
                        // If parentPointId is a 'temp-' string, it means the parent is also being created in this batch.
                        // We can't insert a string into an INTEGER column (or we shouldn't).
                        // However, since we process points in order, we could potentially resolve it if we did a two-pass approach.
                        // For now, if parent ID is temp, we set it to NULL to avoid crashing, but the link will be lost for this save.
                        // Ideally, the user duplicates an EXISTING point (numeric ID).
                        
                        let parentId = (point.parentPointId && typeof point.parentPointId === 'number') ? point.parentPointId : null;
                        
                        // Try to resolve temp parent ID if possible (simple resolution within same batch if ordered?)
                        // No, too complex for this worker logic right now without a map.
                        // Assuming frontend duplicates mostly existing points.
                        
                        if (typeof point.id === 'string' && point.id.startsWith('temp-')) {
                            const res = insertStmt.run(projectId, point.x, point.y, point.label, point.notes || '', point.type || 'voltage', point.category || null, point.tolerance || null, point.expected_value || null, point.side || 'A', parentId);
                            const row = db.prepare('SELECT * FROM points WHERE id = ?').get(res.lastInsertRowid) as any;
                            if (row) {
                                row.temp_id = point.id;
                                savedRows.push(row);
                            }
                        } else if (typeof point.id === 'number') {
                            updateStmt.run(point.x, point.y, point.label, point.notes || '', point.type || 'voltage', point.category || null, point.tolerance || null, point.expected_value || null, point.side || 'A', parentId, point.id);
                            const row = db.prepare('SELECT * FROM points WHERE id = ?').get(point.id);
                            if (row) savedRows.push(row);
                        }
                    }
                });
                transaction(points);
                const finalPoints = db.prepare('SELECT * FROM points WHERE project_id = ?').all(projectId) as any[];
                const getMeasurementsStmt = db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');
                result = finalPoints.map(point => {
                    const measurements = getMeasurementsStmt.all(point.id) as any[];
                    const measurementsByType: any = {};
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
                    return { 
                        ...point, 
                        parentPointId: point.parent_point_id, // Map snake_case to camelCase
                        measurements: measurementsByType, 
                        temp_id: originalPoint?.temp_id 
                    };
                });
                break;

            case 'db:get-points':
                const pointsOnly = db.prepare('SELECT * FROM points WHERE project_id = ?').all(payload) as any[];
                const getMeasStmt = db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');
                result = pointsOnly.map(point => {
                    const measurements = getMeasStmt.all(point.id) as any[];
                    const measurementsByType: any = {};
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
                    return { 
                        ...point, 
                        parentPointId: point.parent_point_id, // Map snake_case to camelCase
                        measurements: measurementsByType 
                    };
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
                const deleteTransaction = db.transaction((pid: number) => {
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
                const deletePointTransaction = db.transaction((pointId: number | string) => {
                    // Manually delete measurements first to avoid FK constraint issues
                    db.prepare('DELETE FROM measurements WHERE point_id = ?').run(pointId);
                    const res = db.prepare('DELETE FROM points WHERE id = ?').run(pointId);
                    return res;
                });
                result = deletePointTransaction(payload);
                break;

            case 'db:get-active-instruments':
                result = db.prepare('SELECT * FROM instruments WHERE is_active = 1').all();
                break;

            case 'db:get-all-instruments':
                result = db.prepare('SELECT * FROM instruments').all();
                break;

            case 'db:save-instrument':
                if (payload.id) {
                    // Update
                    db.prepare(`
                        UPDATE instruments SET 
                        name=@name, type=@type, connection_type=@connection_type, 
                        ip_address=@ip_address, port=@port, command_map=@command_map, is_active=@is_active
                        WHERE id=@id
                    `).run(payload);
                    result = { id: payload.id };
                } else {
                    // Insert
                    const info = db.prepare(`
                        INSERT INTO instruments (name, type, connection_type, ip_address, port, command_map, is_active)
                        VALUES (@name, @type, @connection_type, @ip_address, @port, @command_map, @is_active)
                    `).run(payload);
                    result = { id: info.lastInsertRowid };
                }
                break;

            case 'db:delete-instrument':
                db.prepare('DELETE FROM instruments WHERE id = ?').run(payload);
                result = { status: 'success' };
                break;


                
                const deletePointResult = deletePointTransaction(payload);
                
                if (deletePointResult.changes > 0) {
                    result = { status: 'success' };
                } else {
                    result = { status: 'error', message: 'Point not found or not deleted' };
                }
                break;

            case 'db:update-project':
                const { id: projId, board_model: newModel, board_type: newType, attributes: newAttrs, notes: newNotes } = payload;
                if (!projId) throw new Error('Project ID required');
                
                const updateProjResult = db.prepare(
                    'UPDATE projects SET board_model = ?, board_type = ?, attributes = ?, notes = ? WHERE id = ?'
                ).run(newModel, newType, JSON.stringify(newAttrs), newNotes || '', projId);
                
                if (updateProjResult.changes > 0) {
                    result = { status: 'success', ...payload };
                } else {
                    result = { status: 'error', message: 'Project not found or no changes made' };
                }
                break;
            
            case 'db:search-projects-by-point':
                const searchTerm = `%${payload}%`;
                const searchResults = db.prepare(`
                    SELECT DISTINCT p.id 
                    FROM projects p
                    JOIN points pt ON p.id = pt.project_id
                    WHERE pt.label LIKE ? OR pt.category LIKE ?
                `).all(searchTerm, searchTerm) as any[];
                result = searchResults.map(row => row.id);
                break;

            case 'close':
                console.log('Worker: Compacting database before closing...');
                db.exec('VACUUM');
                db.close();
                console.log('Worker: Database connection closed.');
                parentPort?.postMessage({ id, result: { status: 'closed' } });
                process.exit(0);
                break;

            default:
                throw new Error(`Unknown database operation: ${type}`);
        }
        parentPort?.postMessage({ id, result });
    } catch (error: any) {
        parentPort?.postMessage({ id, error: { message: error.message, stack: error.stack } });
    }
}

parentPort.on('message', handleMessage);
