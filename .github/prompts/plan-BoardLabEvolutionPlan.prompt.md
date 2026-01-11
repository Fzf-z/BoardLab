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

1.  **[Arquitectura] Migrar a Context API o Zustand (Prioridad Alta)**:
    *   En lugar de pasar `points` y `setPoints` por todos lados, la creación de un `ProjectContext` centraliza el estado.
    *   Cualquier componente (el panel lateral, la vista, el modal) puede acceder a los datos del proyecto directamente sin que `BoardLab.jsx` actúe como intermediario.

2.  **[Arquitectura] Migrar a TypeScript (A medio plazo)**:
    *   **Objetivo**: Mejorar la robustez del código y reducir errores en tiempo de ejecución.
    *   **Tareas**:
        - Configurar el proyecto para soportar TypeScript.
        - Migrar gradualmente archivos clave (`BoardLab.jsx`, `main.js`, `db-worker.js`).
        - Definir tipos para las estructuras de datos principales (puntos, mediciones, etc.).
    *   **Beneficios**: Detección temprana de errores, mejor autocompletado y mantenibilidad a largo plazo. Muchos errores comunes se evitarían por completo.

3.  **[UX] Implementar Atajos de Teclado (Prioridad Alta)**:
    *   **Objetivo**: Acelerar drásticamente el flujo de trabajo.
    *   **Tareas**:
        - `M`: Cambiar al modo "Measure".
        - `V`: Cambiar al modo "View".
        - `S` o `Ctrl+S`: Guardar el proyecto actual.
        - `Supr` o `Del`: Borrar el punto seleccionado.
        - `Esc`: Deseleccionar punto o cerrar modal activo.
        - `Enter`: Realiza la medición actual en el punto seleccionado.
    *   **Implementación**: Añadir un `useEffect` en `BoardLab.jsx` que escuche eventos `keydown` globales.

4.  **[UX - Avanzado] Implementar Sistema de Deshacer/Rehacer (Prioridad Media)**:
    *   **Objetivo**: Permitir a los usuarios revertir acciones accidentales.
    *   **Tareas**:
        - Crear un estado de "historial de acciones" en `ProjectContext`.
        - Implementar funciones `undo()` y `redo()` y atajos (`Ctrl+Z`, `Ctrl+Y`).

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

### Fase 3: Mejoras de Integración y Futuro

1.  **[IA] Reconocimiento Básico de Componentes**:
    *   **Objetivo**: Asistir al usuario en la identificación de componentes.
    *   **Tareas**:
        - Integrar una API de Computer Vision (como Gemini Vision).
        - Permitir al usuario seleccionar un área en la imagen y enviarla para su identificación.



