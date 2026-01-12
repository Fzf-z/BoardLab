# Plan de Evolución y Estado Actual de BoardLab

Este documento sirve como una guía completa del estado actual del proyecto BoardLab, las decisiones de arquitectura tomadas, y un roadmap claro para futuras funcionalidades.

## 1. Estado Actual y Arquitectura (Robusto)

BoardLab ha evolucionado de un prototipo a una aplicación de escritorio sólida con una arquitectura bien definida que separa responsabilidades.

### Arquitectura General:
- **`main.js` (Proceso Principal de Electron)**: Orquesta la aplicación. Su única responsabilidad es crear la ventana, manejar la comunicación IPC básica y delegar tareas complejas.
- **`db-worker.js` (Worker de Base de Datos)**: **Crítico**. Toda la lógica de la base de datos (`better-sqlite3`) se ejecuta en este hilo separado. Esto asegura que la interfaz de usuario **nunca se congele**, sin importar cuán pesada sea la consulta.
- **`preload.js`**: Puente de seguridad que expone la API del backend (`window.electronAPI`) al frontend de forma segura.
- **`src/contexts/ProjectContext.jsx`**: **Corazón del Frontend**. Este contexto de React gestiona todo el estado global del proyecto (proyecto actual, lista de puntos, etc.) y contiene toda la lógica para interactuar con el backend (cargar, guardar, borrar).
- **`src/BoardLab.jsx`**: Ahora es un componente "contenedor" limpio. Su principal responsabilidad es ensamblar los componentes de la UI y manejar el estado local de la interfaz (ej: qué modal está abierto).
- **Componentes (`AIPanel`, `BoardView`, Modals)**: Consumen datos directamente del `ProjectContext`, eliminando la necesidad de pasar `props` a través de múltiples niveles (prop drilling).

### Funcionalidades Implementadas (Completadas):
- **Gestión Completa de Proyectos**:
    - Creación, carga, edición y borrado de proyectos.
    - Los tipos de placa personalizados se guardan y reutilizan.
    - Las notas a nivel de proyecto se guardan y muestran.
- **Persistencia de Datos Robusta**:
    - Guardado de puntos, mediciones (incluyendo formas de onda completas) y notas.
    - Borrado en cascada (puntos -> mediciones) manejado correctamente.
    - El guardado automático al crear puntos nuevos asegura la integridad de los datos.
- **Interfaz de Usuario Avanzada**:
    - Zoom y paneo de la imagen con creación precisa de puntos en cualquier nivel de zoom.
    - Ajuste automático de la imagen ("fit to screen") al cargar un proyecto.
    - Puntos visualizados como etiquetas rectangulares adaptables.
    - Tooltip emergente al pasar el mouse sobre un punto, mostrando todas sus mediciones, notas y una vista previa de la forma de onda.
- **Exportación de Reportes PDF**:
    - Generación de reportes profesionales en PDF.
    - El reporte incluye la imagen de la placa con los puntos superpuestos, tablas de mediciones ordenadas, notas y gráficos SVG de las formas de onda.

---

## 2. Roadmap de Próximas Mejoras

Con la base actual, podemos enfocarnos en mejorar la experiencia de usuario y añadir funcionalidades avanzadas.

### Fase 1: Refactorización de Arquitectura y Mejoras de Usabilidad (UX)

1.  **[COMPLETADO] [Arquitectura] Migrar a Context API**:
    *   **Estado**: ✅ Implementado `ProjectContext.tsx` y `NotifierContext.tsx`.
    *   Centraliza todo el estado del proyecto y la lógica de negocio, eliminando prop-drilling.

2.  **[COMPLETADO] [Arquitectura] Migrar a TypeScript (Frontend)**:
    *   **Estado**: ✅ Frontend migrado al 100% (Componentes, Hooks, Contexts).
    *   **Beneficios**: Código robusto, autocompletado y detección de errores en tiempo de desarrollo.

3.  **[COMPLETADO] [UX] Implementar Atajos de Teclado**:
    *   **Estado**: ✅ Implementado en `BoardLab.tsx`.
    *   `M`/`V`: Modos. `Ctrl+S`: Guardar. `Del`: Borrar. `Esc`: Cancelar. `Enter`: Medir.

4.  **[COMPLETADO] [UX - Avanzado] Implementar Sistema de Deshacer/Rehacer (Prioridad Media)**:
    *   **Estado**: ✅ Implementado.
    *   **Tareas**:
        -   Se ha modificado el hook `useBoard` para registrar un historial de cambios en los puntos.
        -   `ProjectContext` ahora expone las funciones `undo` y `redo`.
        -   Se han añadido los atajos de teclado `Ctrl+Z` y `Ctrl+Y` en `BoardLab.tsx`.

### Fase 1.5: Blindaje del Backend (TypeScript Full-Stack)

**Objetivo**: Unificar el lenguaje de todo el proyecto para compartir tipos y evitar errores de comunicación entre procesos.

1.  **[Infraestructura] Configurar Build System para Electron**:
    *   Instalar `vite-plugin-electron` o configurar `tsc` para compilar el proceso principal.
    *   Asegurar que el frontend y backend compartan el archivo `src/types.ts`.

2.  **[Migración] Convertir Backend a TypeScript**:
    *   Migrar `main.js` -> `electron/main.ts`.
    *   Migrar `preload.js` -> `electron/preload.ts`.
    *   Migrar `db-worker.js` -> `electron/worker.ts` (o similar).
    *   Migrar drivers (`owon.js`, `rigol.js`) a TypeScript.

### Fase 2: Funcionalidades de Diagnóstico Avanzado

1.  **[Diagnóstico] Comparación Visual de Formas de Onda**:
    *   **Objetivo**: Superponer una forma de onda guardada (de referencia) sobre una captura en vivo en `Waveform.jsx`.
    *   **Tareas**:
        - Añadir un botón "Set as Reference" en el historial de mediciones.
        - Modificar `Waveform.jsx` para aceptar y renderizar una segunda serie de datos con un color diferente.

2.  **[Diagnóstico] Sistema de Tolerancias**:
    *   **Objetivo**: Marcar automáticamente las mediciones como "correctas" (verde) o "incorrectas" (rojo) según un valor de referencia y un margen de tolerancia (ej: 10%).
    *   **Tareas**:
        - Añadir un campo `tolerance` a los puntos en la base de datos.
        - Aplicar estilo visual en `AIPanel` basado en la comparación.

3.  **[Diagnóstico] Comparación con "Golden Board" (Placa de Referencia)**:
    *   **Objetivo**: Permitir comparar mediciones (valores y formas de onda) de un punto actual con el mismo punto de otro proyecto guardado (una "placa buena").
    *   **Flujo de Ejemplo**:
        1.  El técnico mide el punto `VCC_CPU`.
        2.  Hace clic en "Comparar con Referencia".
        3.  Se abre un modal que le permite buscar otros proyectos y seleccionar el punto `VCC_CPU` de un proyecto "Placa Modelo X - Funcionando OK".
        4.  La UI muestra el valor actual (ej: 1.05V) al lado del valor de referencia (ej: 1.10V).
        5.  Para formas de onda, se superpone la señal de referencia sobre la captura actual para una comparación
    *   **Tareas**:
        - Crear un modal de búsqueda de proyectos/puntos.
        - Implementar la lógica de carga de datos comparativos en `ProjectContext`.
        - Modificar la UI (`AIPanel`, `Waveform.jsx`) para mostrar los datos comparativos.

### Fase 2.5: Mejoras de Experiencia de Usuario (UX) y Personalización

1.  **[UX] Ventana de Configuración Avanzada**:
    *   **Objetivo**: Permitir al usuario personalizar la apariencia y comportamiento de la aplicación.
    *   **Tareas**:
        -   Crear un nuevo modal de "Configuración".
        -   Añadir opciones para cambiar el tamaño y color de los puntos de medición.
        -   Incluir un campo para definir el `timeout` para las mediciones automáticas.

2.  **[UX] Edición de Posición de Puntos en Tabla**:
    *   **Objetivo**: Facilitar el ajuste fino de la posición de un punto sin necesidad de arrastrarlo en el canvas.
    *   **Tareas**:
        -   En el modal `PointsTableModal`, hacer que las coordenadas X e Y de cada punto sean campos de entrada editables.
        -   Asegurar que los cambios se reflejen en tiempo real en el `BoardView`.

3.  **[UX] Minimapa de Navegación**:
    *   **Objetivo**: Mejorar la orientación del usuario cuando se aplica un zoom profundo en la imagen de la placa.
    *   **Tareas**:
        -   Implementar un componente `Minimap` que se superponga en una esquina del `BoardView`.
        -   El minimapa mostrará una versión reducida de la imagen completa.
        -   Dibujar un rectángulo en el minimapa que represente el área visible actualmente en el `BoardView`.
        -   Permitir arrastrar el rectángulo en el minimapa para mover la vista principal.

### Fase 3: Automatización Avanzada y Flexibilidad

1.  **[Automatización] Secuenciador de Mediciones Automáticas**:
    *   **Objetivo**: Agilizar la captura de múltiples mediciones en una secuencia predefinida, reduciendo la interacción manual.
    *   **Tareas**:
        -   Crear una nueva interfaz o modo "Secuencia" donde el usuario pueda ordenar los puntos a medir.
        -   Al iniciar la secuencia, centrar la vista en el primer punto.
        -   Implementar dos modos de disparo para avanzar al siguiente punto:
            1.  **Manual/Temporizado**: El sistema espera la tecla `Enter` o un `timeout` (configurable en Ajustes) para enviar el comando de medición.
            2.  **Disparo Externo**: Escuchar en un puerto o canal específico una señal de un hardware externo (como el multímetro modificado) que indique que se ha tomado la medida.
        -   Al recibir el valor, guardarlo y avanzar automáticamente al siguiente punto de la secuencia, centrando la vista.

2.  **[Arquitectura] Sistema de Instrumentos Personalizables**:
    *   **Objetivo**: Desacoplar la aplicación de los modelos de hardware específicos (Owon, Rigol), permitiendo al usuario añadir sus propios instrumentos.
    *   **Tareas**:
        -   Crear una nueva sección en la base de datos y en la UI de configuración para gestionar "Instrumentos".
        -   Permitir al usuario definir un nuevo instrumento (ej: "Multímetro KORAD KA3005P") y especificar sus detalles de conexión (IP, puerto).
        -   Crear campos de texto donde el usuario pueda introducir los comandos SCPI específicos para acciones como "Medir Voltaje DC", "Medir Resistencia", "Configurar Canal de Osciloscopio", etc.
        -   Modificar los `drivers` en `electron/` para que lean estas configuraciones dinámicas en lugar de usar comandos hardcodeados.

### Fase 4: Mejoras de Integración, Nube y Comunidad

1.  **[Nube] Repositorio de Proyectos (Arquitectura "Local-First")**:
    *   **Estrategia**: Mantener SQLite local como fuente de verdad y usar la nube solo para intercambio ("Snapshot & Share").
    *   **Tareas**:
        -   **Exportación/Empaquetado**: Crear una función que exporte un proyecto completo a un archivo comprimido o JSON firmado.
        -   **Backend Ligero**: Usar Firebase Storage o Supabase para alojar estos paquetes.

2.  **[Seguridad] Autenticación de Usuarios**:
    *   **Objetivo**: Gestionar la identidad de los técnicos para asegurar la autoría.
    *   **Tareas**:
        -   Integrar Firebase Authentication / Google Identity.
        -   Crear pantallas de Login simples.

3.  **[Comunidad] Galería de Reparaciones**:
    *   **Objetivo**: Crear una librería de "Casos de Éxito".
    *   **Flujo**:
        -   Usuario marca un proyecto como "Solucionado" y elige "Publicar".
        -   El sistema sube el paquete a la galería pública.
        -   Otros técnicos pueden buscar por "Modelo de Placa" y descargar el proyecto como referencia ("Golden Board") para usarlo en la comparativa de la Fase 2.

### Fase 5: Inteligencia Artificial Aplicada

1.  **[IA] Reconocimiento Visual de Componentes**:
    *   **Estrategia**: Aprovechar la capacidad multimodal de Gemini.
    *   **Tareas**:
        -   Implementar herramienta de recorte (crop) en el canvas (`BoardView`).
        -   Enviar la imagen recortada a la API de Gemini para identificar el IC/Componente y sugerir su hoja de datos (datasheet).

2.  **[IA] Análisis de Señales con LLM (No Machine Learning propio)**:
    *   **Estrategia**: Usar el LLM actual para análisis de datos en lugar de entrenar redes neuronales desde cero.
    *   **Tareas**:
        -   Convertir los datos del osciloscopio a un formato textual comprimido (CSV/JSON).
        -   Enviar los datos a Gemini junto con el contexto del componente (ej: "Señal I2C") para que detecte anomalías lógicas o ruido.