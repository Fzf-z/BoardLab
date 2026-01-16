# Plan de Implementación: Sistema de Instrumentos Personalizables (Fase 3.2)

Este documento detalla los pasos técnicos para desacoplar la lógica de hardware de `main.js` y permitir la configuración dinámica de instrumentos mediante base de datos y UI.

## Objetivo
Pasar de una arquitectura "Hardcoded" (drivers estáticos para Owon/Rigol) a una arquitectura "Data-Driven" donde el usuario pueda definir nuevos instrumentos y sus comandos SCPI correspondientes.

---

## 1. Capa de Datos (SQLite)

**Archivo objetivo**: `db-worker.js` (o scripts de migración si existen).

Necesitamos almacenar las definiciones de los instrumentos.

*   **Crear Tabla `instruments`**:
    *   `id`: INTEGER PRIMARY KEY AUTOINCREMENT
    *   `name`: TEXT (Ej: "Mi Multímetro KORAD")
    *   `type`: TEXT ('multimeter' | 'oscilloscope')
    *   `connection_type`: TEXT ('tcp_raw')
    *   `ip_address`: TEXT
    *   `port`: INTEGER
    *   `command_map`: TEXT (JSON Stringified)
    *   `is_active`: INTEGER (Boolean 0/1)

*   **Estructura del `command_map` (JSON)**:
    Debe mapear las "Acciones Internas" de BoardLab a los "Comandos SCPI".
    ```json
    {
      "READ_DC": "MEAS:VOLT:DC?",
      "READ_RESISTANCE": "MEAS:RES?",
      "IDN": "*IDN?"
    }
    ```

---

## 2. Capa Backend (Electron / Node.js)

**Archivos objetivos**: `src/electron/drivers/GenericSCPIDriver.js` (nuevo) y `main.js`.

### 2.1 Driver Genérico
Crear una clase que reemplace la lógica específica de los drivers actuales.

**Referencia para `src/electron/drivers/GenericSCPIDriver.js`**:
```javascript
const net = require('net');

class GenericSCPIDriver {
  constructor(config) {
    this.ip = config.ip_address;
    this.port = config.port;
    this.commands = JSON.parse(config.command_map);
    this.name = config.name;
    this.timeout = 2000;
  }

  async execute(actionKey) {
    const scpiCommand = this.commands[actionKey];
    if (!scpiCommand) {
      throw new Error(`El instrumento ${this.name} no tiene configurado el comando para ${actionKey}`);
    }

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let responseData = '';
      let errorOccurred = false;

      // Timeout de seguridad
      const timeoutId = setTimeout(() => {
        errorOccurred = true;
        client.destroy();
        reject({ status: 'error', message: 'Timeout esperando respuesta' });
      }, this.timeout);

      client.connect(this.port, this.ip, () => {
        client.write(scpiCommand + '\n');
      });

      client.on('data', (data) => {
        responseData += data.toString();
        // Asumimos respuesta simple terminada en newline
        if (responseData.includes('\n')) {
          clearTimeout(timeoutId);
          client.destroy();
          resolve({ status: 'ok', value: responseData.trim() });
        }
      });

      client.on('error', (err) => {
        if (!errorOccurred) {
          clearTimeout(timeoutId);
          reject({ status: 'error', message: err.message });
        }
      });
    });
  }
}
module.exports = GenericSCPIDriver;

2.2 Refactorización de main.js
Al iniciar la app (app.whenReady), consultar la DB para obtener instrumentos con is_active = 1.
Instanciar objetos GenericSCPIDriver y almacenarlos en memoria (ej: global.multimeterDriver).
Modificar los IPC Handlers (measure-voltage, etc.) para usar global.multimeterDriver.execute('READ_DC').
3. Capa Frontend (UI de Configuración)
Archivos objetivos: src/components/SettingsModal.jsx (o nuevo InstrumentManager.jsx).

Lista de Instrumentos: Mostrar instrumentos guardados.
Formulario de Edición:
Inputs: Nombre, IP, Puerto.
Sección de Mapeo: Generar inputs dinámicamente para las claves requeridas (READ_DC, READ_RESISTANCE).
Prueba: Botón "Test Connection" que invoca un nuevo IPC test-instrument-connection enviando la config temporal.
4. Pasos de Ejecución Sugeridos para el Agente
DB Setup: Implementar la creación de la tabla en db-worker.js e insertar los datos del hardware actual (Owon/Rigol) como datos semilla ("seed").
Driver Implementation: Crear el archivo GenericSCPIDriver.js.
Main Integration: Modificar main.js para cargar la configuración desde la DB y usar el driver genérico. Verificar que la app sigue funcionando igual con el hardware actual.
UI Implementation: Crear la interfaz en React para añadir/editar instrumentos.

---

## 5. Consideraciones Futuras: Soporte USB (Serial)

Aunque esta fase se centra en TCP, la arquitectura debe quedar preparada para soportar instrumentos conectados por USB (Puerto Serie Virtual).

*   **Cambios previstos en DB**:
    *   El campo `connection_type` soportará `'serial'`.
    *   Nuevo campo `serial_settings` (JSON) para Baud Rate, Paridad, etc.

*   **Evolución del Driver Genérico**:
    *   La clase `GenericSCPIDriver` deberá implementar métodos condicionales para elegir el transporte.
    
    ```javascript
    async execute(actionKey) {
        // ... obtener comando ...
        if (this.config.connection_type === 'tcp_raw') {
            return this.sendTcp(cmd);
        } else if (this.config.connection_type === 'serial') {
            return this.sendSerial(cmd); // A implementar con 'serialport'
        }
    }
    ```
*   **Nota de Implementación**: La integración de USB requerirá configurar `electron-rebuild` para compilar módulos nativos como `serialport`.