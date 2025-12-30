const Database = require('better-sqlite3');
const path = require('path');

class DB {
    constructor(dbPath) {
        this.db = new Database(dbPath, { verbose: console.log });
        this.init();
    }

    init() {
        // Habilitar claves foráneas
        this.db.exec('PRAGMA foreign_keys = ON;');

        // Tabla de Proyectos
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS proyectos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                imagenPlaca TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de Puntos de Medición
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS puntos_de_medicion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proyectoId INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                FOREIGN KEY (proyectoId) REFERENCES proyectos(id) ON DELETE CASCADE
            );
        `);

        // Tabla de Mediciones
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS mediciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                puntoId INTEGER NOT NULL,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                tipo TEXT,
                valor TEXT,
                oscilograma TEXT,
                esReferencia INTEGER DEFAULT 0,
                FOREIGN KEY (puntoId) REFERENCES puntos_de_medicion(id) ON DELETE CASCADE
            );
        `);
    }

    // Métodos para interactuar con la DB se añadirán aquí

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
}

// Exportamos una función para inicializar y devolver la instancia de la DB
// para asegurarnos de que solo haya una instancia (Singleton).
let instance = null;

const initDatabase = (dbPath) => {
    if (!instance) {
        instance = new DB(dbPath);
    }
    return instance;
};

const getDatabase = () => {
    if (!instance) {
        throw new Error('La base de datos no ha sido inicializada. Llama a initDatabase primero.');
    }
    return instance;
};


module.exports = { initDatabase, getDatabase };
