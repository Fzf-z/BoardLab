Análisis del proyecto y propuesta de plan de desarrollo para **BoardLab**.

Este es un plan detallado para implementar las funcionalidades que has solicitado, junto con otras mejoras sugeridas para hacer la aplicación más robusta y útil.

## Plan: Evolución de BoardLab a un Sistema de Diagnóstico Completo

El objetivo es transformar BoardLab de una herramienta de medición en tiempo real a un completo sistema de gestión de diagnóstico. Esto se logrará añadiendo una base de datos para persistencia, funciones de comparación de datos, exportación de informes y una mejor gestión de proyectos.

### Fase 1: Creación de la Base de Datos y Persistencia de Datos (COMPLETADO)

Esta fase es la base de todas las demás. Se creará una base de datos local para almacenar toda la información de manera estructurada.

1.  **Instalar y configurar la base de datos.** (Hecho)
    *   Añadiremos `better-sqlite3`, una librería de base de datos SQL ligera y sin servidor, perfecta para una aplicación de escritorio. Se ejecutará `npm install better-sqlite3`.
    *   Crearemos un nuevo fichero `src/database.js` (y `db-worker.js`) que se encargará de inicializar la base de datos y definir el esquema.

2.  **Integrar la base de datos en el proceso principal.** (Hecho)
    *   En `main.js`, importaremos y utilizaremos `src/database.js` para manejar todas las operaciones de la base de datos.
    *   Se crearán nuevos manejadores de IPC en `main.js` (usando `ipcMain.handle`) para operaciones como `db:saveProject`, `db:loadProject`, `db:saveMeasurement`.
    *   **Mejora**: Se implementó un `Worker` (`db-worker.js`) para manejar la DB sin bloquear la UI.

3.  **Exponer la API de la base de datos al Frontend.** (Hecho)
    *   En `preload.js`, añadiremos las nuevas funciones al `contextBridge` para que los componentes de React puedan llamar de forma segura a las operaciones de la base de datos (ej: `window.electronAPI.saveProject(...)`).

4.  **Añadir guardado manual en la UI.** (Hecho)
    *   En el componente `src/components/Toolbar.jsx`, añadiremos botones para "Nuevo Proyecto", "Abrir Proyecto" y "Guardar".
    *   Estos botones invocarán las nuevas funciones de la API expuestas en el paso anterior para persistir el estado actual de la placa y las mediciones.

### Fase 2: Comparación de Mediciones y Oscilogramas (EN PROGRESO)

Con los datos guardados, ahora podemos implementar la capacidad de comparar mediciones en vivo con datos históricos o de referencia.

1.  **Obtener datos históricos para un punto.** (Hecho)
    *   Crearemos una función en la API (`db:getHistoryForPoint`) que, dado un punto de medición, devuelva todas las mediciones guardadas para ese punto.
    *   Cuando el usuario seleccione un punto en `src/components/BoardView.jsx`, se llamará a esta función.

2.  **Visualizar la comparación.** (Hecho parcialmente)
    *   Se modificará el panel de información o se creará un modal que muestre una tabla con las mediciones históricas junto a la medición actual.
    *   **Hecho**: El componente `AIPanel` ahora muestra el historial y visualiza formas de onda guardadas.
    *   **Pendiente**: Implementar la superposición visual de dos ondas en `Waveform.jsx` para comparación directa.
    
3.  **Sugerencia: En electrónica, los valores exactos son raros.** (Pendiente)
    *   No compares if (valor_medido === valor_golden).
    *   Implementa un sistema de Tolerancia (%). Si la referencia es 10kΩ y mides 9.9kΩ, debería ser un "PASS" (verde), no un error. Agrega un campo tolerance a tu esquema de base de datos.

### Fase 3: Exportación de Informes en PDF (COMPLETADO)

Esta funcionalidad permitirá generar un documento profesional con toda la información del diagnóstico.

1.  **Añadir librería de generación de PDF.** (Hecho - Puppeteer)
    *   Instalaremos `puppeteer` (`npm install puppeteer`). Esta librería permite usar el motor de Chrome para "imprimir" una página web a PDF, lo que facilita la creación de informes visualmente atractivos usando HTML y CSS.

2.  **Crear el generador de informes.** (Hecho)
    *   Se creará un nuevo manejador IPC en `main.js` llamado `export:generatePdf`.
    *   Esta función recopilará todos los datos del proyecto actual (imagen de la placa, puntos, mediciones, capturas de oscilogramas) desde la base de datos.
    *   Generará un fichero HTML dinámicamente con estos datos y le dará estilo con CSS.
    *   Usará `puppeteer` para cargar este HTML y guardarlo como un fichero PDF, preguntando al usuario dónde desea guardarlo.

### Fase 4: Mejoras Adicionales y Usabilidad (EN PROGRESO)

1.  **Guardado Automático.** (Hecho)
    *   En `src/components/Settings.jsx`, se añadirá una opción para habilitar/deshabilitar el guardado automático.
    *   Si está habilitado, la función de guardado se llamará automáticamente después de cada nueva medición exitosa.
    *   **Mejora**: Se implementó guardado automático al crear puntos nuevos para asegurar integridad de datos.

2.  **Gestión de Proyectos.** (Hecho)
    *   Se creará un modal de "Gestión de Proyectos" que permita al usuario ver una lista de los proyectos guardados, abrirlos o eliminarlos.
    *   **Mejora**: Se implementó borrado completo de proyectos y puntos.

3.  **Zoom y Navegación.** (Hecho)
    *   **Mejora**: Se implementó ajuste automático ("fit to screen") al cargar imágenes y corrección de coordenadas al hacer clic con zoom/pan.

4.  **Notificaciones al Usuario.** (Hecho)
    *   Se utilizará el `NotifierContext.jsx` existente para proporcionar feedback sobre las operaciones: "Proyecto guardado", "PDF generado correctamente", "Error al conectar con la base de datos", etc.
