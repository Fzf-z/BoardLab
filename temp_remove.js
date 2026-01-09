
// =================================================================
// IPC Handlers for Database
// =================================================================

ipcMain.handle('db:get-projects', async () => {
  // Excluimos la imagen para que la carga inicial sea rápida
  const projects = db.db.prepare('SELECT id, board_type, board_model, attributes, created_at FROM projects ORDER BY created_at DESC').all();
  return projects.map(p => ({
    ...p,
    attributes: JSON.parse(p.attributes || '{}') // Parsear el JSON al enviar
  }));
});

ipcMain.handle('db:get-project-with-image', async (event, projectId) => {
    const project = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (project) {
        project.attributes = JSON.parse(project.attributes || '{}');
    }
    return project;
});

ipcMain.handle('db:create-project', async (event, projectData) => {
  const { board_type, board_model, attributes, image_data } = projectData;
  
  // Convertir el Uint8Array (recibido desde el renderer) a un Buffer
  const imageBuffer = Buffer.from(image_data);

  const result = db.db.prepare(
    'INSERT INTO projects (board_type, board_model, attributes, image_data) VALUES (?, ?, ?, ?)'
  ).run(board_type, board_model, JSON.stringify(attributes), imageBuffer);
  
  return { id: result.lastInsertRowid, ...projectData, image_data: imageBuffer };
});

ipcMain.handle('db:get-all-attributes', async () => {
  if (!db || !db.db) {
    console.warn('DB not initialized yet when db:get-all-attributes called');
    return { keys: [], values: [] };
  }
  const projects = db.db.prepare('SELECT attributes FROM projects WHERE attributes IS NOT NULL').all();
  const keys = new Set();
  const values = new Set();

  for (const proj of projects) {
    try {
      const attrs = JSON.parse(proj.attributes);
      for (const key in attrs) {
        keys.add(key);
        if (typeof attrs[key] === 'string' && attrs[key].trim() !== '') {
          values.add(attrs[key]);
        }
      }
    } catch (e) {
      console.error('Error parsing attributes JSON:', e);
    }
  }

  return {
    keys: [...keys].sort(),
    values: [...values].sort(),
  };
});

ipcMain.handle('db:save-points', async (event, { projectId, points }) => {
  const insertStmt = db.db.prepare('INSERT INTO points (project_id, x, y, label, notes, type) VALUES (?, ?, ?, ?, ?, ?)');
  const updateStmt = db.db.prepare('UPDATE points SET x = ?, y = ?, label = ?, notes = ?, type = ? WHERE id = ?');

  const savedRows = [];

  const transaction = db.db.transaction((pts) => {
    for (const point of pts) {
      if (typeof point.id === 'string' && point.id.startsWith('temp-')) {
        // Nuevo punto: INSERT, luego obtener la fila insertada y adjuntar temp_id
        const res = insertStmt.run(projectId, point.x, point.y, point.label, point.notes || '', point.type || 'voltage');
        const row = db.db.prepare('SELECT * FROM points WHERE id = ?').get(res.lastInsertRowid);
        if (row) {
          row.temp_id = point.id;
          savedRows.push(row);
        }
      } else if (typeof point.id === 'number') {
        // Punto existente: UPDATE y devolver la fila actualizada
        updateStmt.run(point.x, point.y, point.label, point.notes || '', point.type || 'voltage', point.id);
        const row = db.db.prepare('SELECT * FROM points WHERE id = ?').get(point.id);
        if (row) savedRows.push(row);
      }
    }
  });

  transaction(points);
    // After saving, return all project points with their permanent IDs and latest measurements
    const finalPoints = db.db.prepare('SELECT * FROM points WHERE project_id = ?').all(projectId);
    const getMeasurementsStmt = db.db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');

    const pointsWithMeasurements = finalPoints.map(point => {
        const measurements = getMeasurementsStmt.all(point.id);
        const measurementsByType = {};
        for (const m of measurements) {
            if (!measurementsByType[m.type]) {
                try {
                    measurementsByType[m.type] = {
                        type: m.type,
                        value: JSON.parse(m.value),
                        capturedAt: m.created_at
                    };
                } catch (e) {
                    console.error(`Failed to parse measurement value for point ${point.id}:`, m.value);
                }
            }
        }
        // Find the original temp-id for new points to send it back to the renderer
        const originalPoint = savedRows.find(sr => sr.id === point.id);
        return { ...point, measurements: measurementsByType, temp_id: originalPoint?.temp_id };
    });

    console.log('Points with measurements returned from DB after save:', JSON.stringify(pointsWithMeasurements, null, 2));
    return pointsWithMeasurements;
});

ipcMain.handle('db:get-points', async (event, projectId) => {
  const points = db.db.prepare('SELECT * FROM points WHERE project_id = ?').all(projectId);
  const getMeasurementsStmt = db.db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC');

  // Para cada punto, buscar y adjuntar sus mediciones
  const pointsWithMeasurements = points.map(point => {
    const measurements = getMeasurementsStmt.all(point.id);
    const measurementsByType = {};
    
    // Agrupar las mediciones por tipo (voltage, resistance, etc.)
    for (const m of measurements) {
      if (!measurementsByType[m.type]) { // Solo guardar la más reciente de cada tipo
        try {
          const parsedValue = JSON.parse(m.value);
          if (m.type === 'oscilloscope') {
            // For scope data, the entire parsed object is the measurement.
            measurementsByType[m.type] = { ...parsedValue, capturedAt: m.created_at };
          } else {
            // For simple types, the value is just the parsed content.
            measurementsByType[m.type] = {
              type: m.type,
              value: parsedValue,
              capturedAt: m.created_at
            };
          }
        } catch (e) {
          // Fallback for non-JSON string values (older data)
          measurementsByType[m.type] = {
            type: m.type,
            value: m.value,
            capturedAt: m.created_at
          };
        }
      }
    }
    return { ...point, measurements: measurementsByType };
  });

  return pointsWithMeasurements;
});

ipcMain.handle('db:save-measurement', async (event, payload) => {
  console.log('Received payload for db:save-measurement:', payload); 
  try {
    const { pointId, type, value } = payload || {};
    if (!pointId || !type) {
      return { status: 'error', message: 'Invalid payload: pointId and type are required' };
    }
    const result = db.db.prepare('INSERT INTO measurements (point_id, type, value) VALUES (?, ?, ?)')
      .run(pointId, type, JSON.stringify(value));
    const row = db.db.prepare('SELECT * FROM measurements WHERE id = ?').get(result.lastInsertRowid);
    console.log('Saved measurement row:', JSON.stringify(row, null, 2));
    return { id: result.lastInsertRowid };
  } catch (e) {
    console.error('Error in db:save-measurement:', e);
    return { status: 'error', message: e.message };
  }
});

ipcMain.handle('db:createMeasurement', async (event, payload) => {
  console.log('Received payload for db:createMeasurement:', payload); // <-- Añadir log
  try {
    const { pointId, type, value } = payload || {};
    if (!pointId || !type) {
      return { status: 'error', message: 'Invalid payload: pointId and type are required' };
    }
    const result = db.db.prepare('INSERT INTO measurements (point_id, type, value) VALUES (?, ?, ?)')
      .run(pointId, type, JSON.stringify(value));
    const saved = db.db.prepare('SELECT * FROM measurements WHERE id = ?').get(result.lastInsertRowid);
    console.log('createMeasurement saved row:', JSON.stringify(saved, null, 2));
    return { id: result.lastInsertRowid };
  } catch (e) {
    console.error('Error in db:createMeasurement:', e);
    return { status: 'error', message: e.message };
  }
});

ipcMain.handle('db:getMeasurementsForPoint', async (event, pointId) => {
  if (!pointId) return [];
  const measurements = db.db.prepare('SELECT * FROM measurements WHERE point_id = ? ORDER BY created_at DESC').all(pointId);
  return measurements;
});

// Delete a project and its related data (measurements, points)
ipcMain.handle('db:delete-project', async (event, projectId) => {
  try {
    if (!projectId) return { status: 'error', message: 'projectId required' };

    const deleteTransaction = db.db.transaction((pid) => {
      // Delete measurements for points belonging to the project
      db.db.prepare('DELETE FROM measurements WHERE point_id IN (SELECT id FROM points WHERE project_id = ?)').run(pid);
      // Delete points
      db.db.prepare('DELETE FROM points WHERE project_id = ?').run(pid);
      // Delete project
      db.db.prepare('DELETE FROM projects WHERE id = ?').run(pid);
    });

    deleteTransaction(projectId);

    console.log(`Project ${projectId} and related data deleted.`);
    return { status: 'success' };
  } catch (e) {
    console.error('Error deleting project:', e);
    return { status: 'error', message: e.message };
  }
});
