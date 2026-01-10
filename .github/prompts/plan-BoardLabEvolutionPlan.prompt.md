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

### Fase 1: Mejoras de Usabilidad (UX) - Próximos Pasos

1.  **[UX] Implementar Atajos de Teclado (Prioridad Alta)**:
    *   **Objetivo**: Acelerar drásticamente el flujo de trabajo.
    *   **Tareas**:
        - `M`: Cambiar al modo "Measure".
        - `V`: Cambiar al modo "View".
        - `S` o `Ctrl+S`: Guardar el proyecto actual.
        - `Supr` o `Del`: Borrar el punto seleccionado.
        - `Esc`: Deseleccionar punto o cerrar modal activo.
    *   **Implementación**: Añadir un `useEffect` en `BoardLab.jsx` que escuche eventos `keydown` globales.

2.  **[Avanzado] Implementar Sistema de Deshacer/Rehacer (Prioridad Media)**:
    *   **Objetivo**: Permitir a los usuarios revertir acciones accidentales como borrar un punto o moverlo.
    *   **Tareas**:
        - Crear un estado de "historial de acciones" en `ProjectContext`.
        - Cada vez que se modifica el estado (ej: al añadir/borrar un punto), guardar la acción y el estado anterior.
        - Implementar funciones `undo()` y `redo()` que naveguen por este historial.
        - Añadir botones en la `Toolbar` y atajos (`Ctrl+Z`, `Ctrl+Y`).

### Fase 2: Funcionalidades de Diagnóstico Avanzado

3.  **[Diagnóstico] Comparación Visual de Formas de Onda**:
    *   **Objetivo**: Superponer una forma de onda guardada (de referencia) sobre una captura en vivo en `Waveform.jsx`.
    *   **Tareas**:
        - Añadir un botón "Set as Reference" en el historial de mediciones.
        - Modificar `Waveform.jsx` para aceptar y renderizar una segunda serie de datos con un color diferente.

4.  **[Diagnóstico] Sistema de Tolerancias**:
    *   **Objetivo**: Marcar automáticamente las mediciones como "correctas" (verde) o "incorrectas" (rojo) según un margen de tolerancia.
    *   **Tareas**:
        - Añadir un campo `tolerance` (ej: 10%) a los puntos en la base de datos.
        - En `AIPanel`, al mostrar una medición, compararla con un valor de referencia (que se podría guardar) y aplicar un estilo visual según la tolerancia.

### Fase 3: Mejoras de Integración y Hardware

5.  **[Hardware] Auto-descubrimiento de Instrumentos**:
    *   **Objetivo**: Eliminar la necesidad de introducir IPs manualmente.
    *   **Tareas**: Implementar un escaneo de red (ej: usando `node-ssdp` o un ping broadcast) para encontrar dispositivos que respondan a comandos SCPI estándar como `*IDN?`.

6.  **[IA] Reconocimiento Básico de Componentes**:
    *   **Objetivo**: Asistir al usuario en la identificación de componentes.
    *   **Tareas**:
        - Integrar una librería de Computer Vision (como OpenCV.js) o usar la API de Gemini Vision.
        - Permitir al usuario seleccionar un área en la imagen y enviar esa sub-imagen a la IA para que intente identificar el componente.

