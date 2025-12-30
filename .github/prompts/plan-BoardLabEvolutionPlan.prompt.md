Análisis del proyecto y propuesta de plan de desarrollo para **BoardLab**.

Este es un plan detallado para implementar las funcionalidades que has solicitado, junto con otras mejoras sugeridas para hacer la aplicación más robusta y útil.

## Plan: Evolución de BoardLab a un Sistema de Diagnóstico Completo

El objetivo es transformar BoardLab de una herramienta de medición en tiempo real a un completo sistema de gestión de diagnóstico. Esto se logrará añadiendo una base de datos para persistencia, funciones de comparación de datos, exportación de informes y una mejor gestión de proyectos.

### Fase 1: Creación de la Base de Datos y Persistencia de Datos

Esta fase es la base de todas las demás. Se creará una base de datos local para almacenar toda la información de manera estructurada.

1.  **Instalar y configurar la base de datos.**
    *   Añadiremos `better-sqlite3`, una librería de base de datos SQL ligera y sin servidor, perfecta para una aplicación de escritorio. Se ejecutará `npm install better-sqlite3`.
    *   Crearemos un nuevo fichero `src/database.js` que se encargará de inicializar la base de datos y definir el esquema (tablas para `proyectos`, `puntos_de_medicion`, y `mediciones`).

2.  **Integrar la base de datos en el proceso principal.**
    *   En `main.js`, importaremos y utilizaremos `src/database.js` para manejar todas las operaciones de la base de datos.
    *   Se crearán nuevos manejadores de IPC en `main.js` (usando `ipcMain.handle`) para operaciones como `db:saveProject`, `db:loadProject`, `db:saveMeasurement`.

3.  **Exponer la API de la base de datos al Frontend.**
    *   En `preload.js`, añadiremos las nuevas funciones al `contextBridge` para que los componentes de React puedan llamar de forma segura a las operaciones de la base de datos (ej: `window.electronAPI.saveProject(...)`).

4.  **Añadir guardado manual en la UI.**
    *   En el componente `src/components/Toolbar.jsx`, añadiremos botones para "Nuevo Proyecto", "Abrir Proyecto" y "Guardar".
    *   Estos botones invocarán las nuevas funciones de la API expuestas en el paso anterior para persistir el estado actual de la placa y las mediciones.

5. **Veredicto: Excelente elección.**
    *   Por qué: better-sqlite3 es sincrónico y extremadamente rápido, lo cual es perfecto para el proceso principal de Electron. Al ser un archivo local (.db), es fácil de respaldar.
    *   ⚠️ Cuidado con: Los módulos nativos en Electron. better-sqlite3 está escrito en C++. A veces, al compilar la app (npm run dist), puede dar problemas si no se reconstruye para la versión exacta de Electron.
    Solución: Asegúrate de tener configurado electron-builder correctamente para que maneje la recompilación nativa.
    *   Ubicación: El archivo .db NO debe guardarse en la carpeta de instalación del programa (Program Files), ya que ahí no tendrás permisos de escritura. Debes usar app.getPath('userData') para guardarlo en %APPDATA%.

### Fase 2: Comparación de Mediciones y Oscilogramas

Con los datos guardados, ahora podemos implementar la capacidad de comparar mediciones en vivo con datos históricos o de referencia.

1.  **Obtener datos históricos para un punto.**
    *   Crearemos una función en la API (`db:getHistoryForPoint`) que, dado un punto de medición, devuelva todas las mediciones guardadas para ese punto.
    *   Cuando el usuario seleccione un punto en `src/components/BoardView.jsx`, se llamará a esta función.

2.  **Visualizar la comparación.**
    *   Se modificará el panel de información o se creará un modal que muestre una tabla con las mediciones históricas junto a la medición actual.
    *   El componente `src/components/Waveform.jsx` se actualizará para que pueda renderizar dos series de datos: la forma de onda en vivo y una forma de onda de referencia seleccionada de la base de datos.
    
3.  **Sugerencia: En electrónica, los valores exactos son raros.**
    *   No compares if (valor_medido === valor_golden).
    *   Implementa un sistema de Tolerancia (%). Si la referencia es 10kΩ y mides 9.9kΩ, debería ser un "PASS" (verde), no un error. Agrega un campo tolerance a tu esquema de base de datos.

### Fase 3: Exportación de Informes en PDF

Esta funcionalidad permitirá generar un documento profesional con toda la información del diagnóstico.

1.  **Añadir librería de generación de PDF.**
    *   Instalaremos `puppeteer` (`npm install puppeteer`). Esta librería permite usar el motor de Chrome para "imprimir" una página web a PDF, lo que facilita la creación de informes visualmente atractivos usando HTML y CSS.

2.  **Crear el generador de informes.**
    *   Se creará un nuevo manejador IPC en `main.js` llamado `export:generatePdf`.
    *   Esta función recopilará todos los datos del proyecto actual (imagen de la placa, puntos, mediciones, capturas de oscilogramas) desde la base de datos.
    *   Generará un fichero HTML dinámicamente con estos datos y le dará estilo con CSS.
    *   Usará `puppeteer` para cargar este HTML y guardarlo como un fichero PDF, preguntando al usuario dónde desea guardarlo.

3.  **Añadir botón de exportación.**
    *   En `src/components/Toolbar.jsx` se añadirá un botón "Exportar a PDF" que dispare el evento IPC correspondiente.

4.  **Reportes PDF (Puppeteer) -> ¡CORRECCIÓN IMPORTANTE!**
    *   Veredicto: Desaconsejo usar Puppeteer.
    *   Por qué: Puppeteer descarga una versión completa de Chromium. Electron YA ES Chromium. Usar Puppeteer dentro de Electron duplicará el tamaño de tu aplicación (agregando ~150MB innecesarios) y consumirá mucha RAM.
    *   Mejor Alternativa: Usa la API nativa de Electron: mainWindow.webContents.printToPDF().
    *   Es nativo, no requiere librerías extra y es instantáneo.
    *   Simplemente creas una ventana oculta (show: false), cargas el HTML del reporte ahí, y llamas a printToPDF.

### Fase 4: Mejoras Adicionales y Usabilidad

1.  **Guardado Automático.**
    *   En `src/components/Settings.jsx`, se añadirá una opción para habilitar/deshabilitar el guardado automático.
    *   Si está habilitado, la función de guardado se llamará automáticamente después de cada nueva medición exitosa.

2.  **Gestión de Proyectos.**
    *   Se creará un modal de "Gestión de Proyectos" que permita al usuario ver una lista de los proyectos guardados, abrirlos o eliminarlos.

3.  **Notificaciones al Usuario.**
    *   Se utilizará el `NotifierContext.jsx` existente para proporcionar feedback sobre las operaciones: "Proyecto guardado", "PDF generado correctamente", "Error al conectar con la base de datos", etc.
