Instrucciones y Contexto del Proyecto BoardLab para GitHub Copilot

Descripción del Proyecto

BoardLab es una aplicación de escritorio híbrida (Electron + React) diseñada para el diagnóstico y reparación de placas electrónicas. Permite a los técnicos tomar una fotografía de una placa, marcar puntos de interés y capturar mediciones en tiempo real desde hardware externo conectado por red.

Stack Tecnológico

Frontend: React 18, Vite, Tailwind CSS.

Backend/Desktop: Electron (Node.js).

Comunicación: IPC (Inter-Process Communication) entre React y Electron.

Hardware I/O: Módulo nativo net de Node.js para sockets TCP.

Arquitectura de Archivos

main.js (Process Main): - Punto de entrada de Electron.

Maneja la creación de ventanas.

CRÍTICO: Contiene la lógica de conexión TCP directa con el hardware (Drivers).

Escucha eventos IPC (ipcMain.handle) para ejecutar mediciones.

preload.js: - Puente de seguridad contextBridge.

Expone la API segura window.electronAPI al Frontend.

src/BoardLab.jsx: - Componente principal de la UI.

Maneja el canvas de la imagen, zoom, paneo y la lógica de estado de los puntos de medición.

Llama a window.electronAPI para pedir datos al hardware.

src/main.jsx: Punto de entrada de React.

Protocolos de Hardware

La aplicación se comunica con dos dispositivos específicos:

Multímetro Owon XDM1241:

Conexión: Indirecta vía Bridge ESP32 (TCP -> UART).

Puerto: 9876.

Comandos SCPI: MEAS:VOLT:DC?, MEAS:RES?.

Formato: Texto ASCII simple terminado en \n.

Osciloscopio Rigol DHO814:

Conexión: Directa vía LAN (TCP Raw Sockets).

Puerto: 5555.

Protocolo: SCPI para configuración (:WAV:SOUR CHAN1, :WAV:DATA?) y lectura de bloque binario/ASCII (TMC Header).

Reglas de Codificación

Seguridad Electron: Nunca usar remote module. Siempre usar IPC (invoke/handle) para comunicar Renderer y Main.

Estilos: Usar exclusivamente clases de utilidad de Tailwind CSS. Evitar CSS plano excepto para configuraciones globales.

React: Usar componentes funcionales y Hooks (useState, useEffect, useRef).

Manejo de Errores Hardware: Las funciones de hardware en main.js siempre deben devolver una Promesa que se resuelva, incluso en caso de error (devolver objeto { status: 'error' }), para evitar que la UI se congele esperando una respuesta que nunca llega.

Entorno: Detectar si se está ejecutando en Electron mediante window.electronAPI?.isElectron. Si es falso (navegador web), usar datos simulados (mock data).

Tareas Comunes

Al agregar un nuevo instrumento, crear su driver en main.js y exponer el handler en ipcMain.

Al agregar una nueva funcionalidad de UI que requiera Node.js, hacerlo vía preload.js.