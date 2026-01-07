const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DB {
  constructor() {
    this.db = null;
    this.app = null;
  }

  init(app) {
    this.app = app;
    const dbPath = path.join(this.app.getPath('userData'), 'boardlab.db');
    
    // Ensure the directory exists
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    console.log(`Database connected at ${dbPath}`);
    this.initSchema();
  }

  initSchema() {
    if (!this.db) return;

    // Projects Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_type TEXT NOT NULL, -- 'Laptop', 'Desktop', 'Industrial', 'Mobile', etc.
        board_model TEXT NOT NULL,
        attributes TEXT, -- JSON object for specific fields like CPU, RAM, etc.
        image_data BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Points Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        label TEXT,
        notes TEXT,
         type TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
       )
     `);

     // Migration: ensure `notes`, `created_at`, and `type` exist on points (for older DBs)
     try {
       const cols = this.db.prepare("PRAGMA table_info('points')").all();
       const colNames = cols.map(c => c.name);
       if (!colNames.includes('notes')) {
         this.db.exec("ALTER TABLE points ADD COLUMN notes TEXT");
       }
       if (!colNames.includes('type')) {
         this.db.exec("ALTER TABLE points ADD COLUMN type TEXT");
      }
      if (!colNames.includes('created_at')) {
        // SQLite does not allow adding a column with a non-constant default via ALTER TABLE,
        // so add the column without a default and backfill existing rows.
        this.db.exec("ALTER TABLE points ADD COLUMN created_at DATETIME");
        try {
          this.db.exec("UPDATE points SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL");
        } catch (e) {
          console.warn('Could not backfill created_at for points:', e);
        }
      }
    } catch (e) {
      console.error('Error running points migrations:', e);
    }

    // Measurements Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'voltage', 'resistance', 'waveform'
        value TEXT NOT NULL, -- Can be a simple value or JSON for complex data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (point_id) REFERENCES points (id) ON DELETE CASCADE
      )
    `);

    console.log('Database schema initialized.');
  }

  // --- Proyectos ---
  createProject({ nombre, descripcion, imagenPlaca }) {
    const stmt = this.db.prepare('INSERT INTO proyectos (nombre, descripcion, imagenPlaca) VALUES (?, ?, ?)');
    const info = stmt.run(nombre, descripcion, imagenPlaca);
    return info.lastInsertRowid;
  }

  getProjects() {
    const stmt = this.db.prepare('SELECT * FROM proyectos ORDER BY createdAt DESC');
    return stmt.all();
  }
  
  getProject(id) {
    const stmt = this.db.prepare('SELECT * FROM proyectos WHERE id = ?');
    return stmt.get(id);
  }
  
  updateProject({ id, nombre, descripcion, imagenPlaca }) {
    const stmt = this.db.prepare('UPDATE proyectos SET nombre = ?, descripcion = ?, imagenPlaca = ? WHERE id = ?');
    const info = stmt.run(nombre, descripcion, imagenPlaca, id);
    return info.changes > 0;
  }

  deleteProject(id) {
    const stmt = this.db.prepare('DELETE FROM proyectos WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  // --- Puntos de Medición ---
  createPoint({ proyectoId, nombre, x, y }) {
    const stmt = this.db.prepare('INSERT INTO puntos_de_medicion (proyectoId, nombre, x, y) VALUES (?, ?, ?, ?)');
    const info = stmt.run(proyectoId, nombre, x, y);
    return info.lastInsertRowid;
  }

  getPointsForProject(proyectoId) {
    const stmt = this.db.prepare('SELECT * FROM puntos_de_medicion WHERE proyectoId = ?');
    return stmt.all(proyectoId);
  }

  updatePoint({ id, nombre, x, y }) {
    const stmt = this.db.prepare('UPDATE puntos_de_medicion SET nombre = ?, x = ?, y = ? WHERE id = ?');
    const info = stmt.run(nombre, x, y, id);
    return info.changes > 0;
  }

  deletePoint(id) {
    const stmt = this.db.prepare('DELETE FROM puntos_de_medicion WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  // --- Mediciones ---
  createMeasurement({ puntoId, tipo, valor, oscilograma, esReferencia }) {
    const stmt = this.db.prepare('INSERT INTO mediciones (puntoId, tipo, valor, oscilograma, esReferencia) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(puntoId, tipo, valor, oscilograma, esReferencia ? 1 : 0);
    return info.lastInsertRowid;
  }

  getMeasurementsForPoint(puntoId) {
    const stmt = this.db.prepare('SELECT * FROM mediciones WHERE puntoId = ? ORDER BY timestamp DESC');
    return stmt.all(puntoId);
  }

  getMeasurement(id) {
    const stmt = this.db.prepare('SELECT * FROM mediciones WHERE id = ?');
    return stmt.get(id);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed.');
    }
  }
}

// Singleton instance
const dbInstance = new DB();

module.exports = dbInstance;
