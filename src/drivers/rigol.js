const net = require('net');

function getRigolData(ip, port) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: 'Timeout de conexión (15s)' }); // Aumentado a 15s
        }, 15000);

        const commandString = [
            ':WAV:SOUR CHAN1', ':WAV:MODE NORM', ':WAV:FORM BYTE',
            ':CHAN1:SCAL?', // Consultar la escala de voltaje (V/div)
            ':MEAS:VPP?', // Reintroducir Vpp
            ':MEAS:FREQ?', // Reintroducir Freq
            ':WAV:PRE?',
            ':WAV:DATA?'
        ].join('\n') + '\n';

        let receivedData = Buffer.alloc(0);
        let totalExpectedLength = -1; 
        let binaryBlockStartDetected = false;
        let currentDataLength = -1; 
        let binaryStartIndex = -1; 
        let numDigits = -1;

        const processAndResolve = () => {
            clearTimeout(timeout);
            client.destroy();

            try {
                console.log("--- Final Received Data (ASCII) ---");
                console.log(receivedData.toString('ascii').substring(0, 500));
                console.log("--- Final Received Data (Hex) ---");
                console.log(receivedData.toString('hex').substring(0, 1000));

                if (receivedData.length === 0) throw new Error("No se recibió respuesta alguna del instrumento.");
                
                const bufferAsString = receivedData.toString('ascii');
                const binaryStartIndex = bufferAsString.indexOf('#');

                if (binaryStartIndex === -1) throw new Error("No se encontró el bloque de datos binarios (#). Buffer: " + receivedData.toString('ascii').substring(0, 100));

                const responses = {};
                const textPart = bufferAsString.substring(0, binaryStartIndex);
                const lines = textPart.trim().split('\n');

                // Ahora esperamos 4 líneas: V/div, Vpp, Freq, y Preamble.
                if (lines.length < 4) {
                    throw new Error(`Se esperaban al menos 4 líneas de texto (V/div, Vpp, Freq, Preamble), pero se recibieron ${lines.length}. Texto recibido: "${textPart}".`);
                }

                responses.voltageScale = parseFloat(lines[0]); // Línea 0: V/div
                responses.vpp = parseFloat(lines[1]);          // Línea 1: Vpp
                responses.freq = parseFloat(lines[2]);         // Línea 2: Freq

                // La línea 3 es el Preamble
                responses.preamble = lines[3].split(',');
                
                if (responses.preamble.length < 10) throw new Error(`Preamble incompleto: "${lines[3]}".`);

                const preambleValues = responses.preamble;
                responses.timeScale = parseFloat(preambleValues[4]); // Xincrement
                // La escala de voltaje (V/div) ahora se obtiene directamente con :CHAN1:SCAL?
                // responses.voltageScale = parseFloat(preambleValues[7]); // Yincrement << Incorrecto
                responses.voltageOffset = parseFloat(preambleValues[8]); // Yorigin

                // --- Parseo del bloque binario TMC ---
                const binaryData = receivedData.slice(binaryStartIndex);
                
                if (binaryData.length < 2 || binaryData[0] !== 0x23) {
                    throw new Error('Cabecera TMC de forma de onda inválida: no empieza con # o es demasiado corta.');
                }
                const numDigits = parseInt(binaryData.toString('ascii', 1, 2), 10); // El dígito después de #
                if (isNaN(numDigits) || numDigits < 1 || numDigits > 9) {
                    throw new Error(`Cabecera TMC de forma de onda inválida: número de dígitos de longitud (${numDigits}) fuera de rango (1-9).`);
                }
                
                const dataLengthStrStart = 2;
                const dataLengthStrEnd = dataLengthStrStart + numDigits;
                if (binaryData.length < dataLengthStrEnd) {
                    throw new Error('Cabecera TMC de forma de onda inválida: datos de longitud incompletos en el buffer.');
                }
                const dataLength = parseInt(binaryData.toString('ascii', dataLengthStrStart, dataLengthStrEnd), 10);
                if (isNaN(dataLength)) {
                    throw new Error('Cabecera TMC de forma de onda inválida: no se pudo parsear la longitud de los datos.');
                }

                const headerEnd = dataLengthStrEnd; 

                // Asegurarse de que tenemos el bloque binario completo + 1 (para el posible \n final)
                if (binaryData.length < headerEnd + dataLength + 1) {
                    throw new Error(`Datos binarios incompletos. Esperados: ${dataLength} bytes, Recibidos: ${binaryData.length - headerEnd} (después del encabezado).`);
                }

                // Estos valores del preámbulo son necesarios para escalar correctamente los datos crudos de la forma de onda
                const yIncrement = parseFloat(preambleValues[7]); // Factor de escala vertical
                const yOrigin = parseFloat(preambleValues[8]);    // Origen de datos vertical
                const yReference = parseFloat(preambleValues[9]); // Punto de referencia vertical

                // Extraer solo los datos de la forma de onda (excluyendo el posible \n final)
                const rawWaveform = binaryData.slice(headerEnd, headerEnd + dataLength);
                const processedWaveform = [];
                for (let i = 0; i < rawWaveform.length; i++) {
                    // Fórmula para convertir el valor crudo (0-255) a un valor de voltaje real
                    processedWaveform.push(((rawWaveform[i] - yReference) * yIncrement) + yOrigin);
                }
                
                responses.waveform = processedWaveform.slice(0, 1000); // Limitar a 1000 puntos para la UI
                delete responses.preamble; // Ya no es necesario después del procesamiento
                resolve({ status: 'success', ...responses });

            } catch (e) {
                resolve({ status: 'error', message: `Error procesando datos: ${e.message}. Buffer total: ${receivedData.length} bytes.` });
            }
        };

        client.connect(port, ip, () => {
            console.log(`[NET] Conectado a ${ip}:${port}. Enviando comandos...`);
            client.write(commandString);
        });

        client.on('data', (data) => {
            console.log(`[NET] Recibido ${data.length} bytes.`);
            // console.log('Chunk (ASCII): ', data.toString('ascii').substring(0, 100));
            // console.log('Chunk (Hex): ', data.toString('hex').substring(0, 100));

            receivedData = Buffer.concat([receivedData, data]);
            console.log(`[NET] Buffer acumulado: ${receivedData.length} bytes.`);

            if (!binaryBlockStartDetected) {
                const bufferAsString = receivedData.toString('ascii');
                binaryStartIndex = bufferAsString.indexOf('#'); // Asignar, no declarar

                if (binaryStartIndex !== -1) {
                    binaryBlockStartDetected = true;
                    if (receivedData.length >= binaryStartIndex + 2) {
                        try {
                            numDigits = parseInt(receivedData.toString('ascii', binaryStartIndex + 1, binaryStartIndex + 2), 10); // Asignar, no declarar
                            if (!isNaN(numDigits) && numDigits >= 1 && numDigits <= 9) {
                                const dataLengthStrStart = binaryStartIndex + 2;
                                const dataLengthStrEnd = dataLengthStrStart + numDigits;
                                if (receivedData.length >= dataLengthStrEnd) {
                                    currentDataLength = parseInt(receivedData.toString('ascii', dataLengthStrStart, dataLengthStrEnd), 10);
                                    console.log(`[NET] TMC Header detectado: numDigits=${numDigits}, dataLength=${currentDataLength}`);
                                }
                            }
                        } catch (e) {
                            console.error('[NET] Error parsing TMC header in data event:', e.message);
                        }
                    }
                }
            }

            // Si ya detectamos el inicio del bloque binario y conocemos su longitud,
            // verificamos si hemos recibido todos los datos esperados.
            if (binaryBlockStartDetected && currentDataLength !== -1) {
                const expectedTotalSize = binaryStartIndex + 2 + numDigits + currentDataLength + 1; // +1 para el \n final
                if (receivedData.length >= expectedTotalSize) {
                    console.log(`[NET] Todos los datos (${expectedTotalSize} bytes) recibidos. Procesando...`);
                    processAndResolve();
                }
            }
        });

        client.on('error', (err) => {
            console.error(`[NET] Error de conexión: ${err.message}`);
            clearTimeout(timeout);
            client.destroy();
            resolve({ status: 'error', message: err.message });
        });
        
        client.on('close', () => {
            console.log('[NET] Conexión cerrada.');
            // Si la conexión se cierra y no hemos procesado aún, intentar procesar lo que se tenga.
            // Esto cubre casos donde el instrumento no envía el final de línea o cierra prematuramente.
            if (receivedData.length > 0 && !resolve.called) { // Evita llamar resolve dos veces
                processAndResolve();
            }
        });
    });
}

module.exports = { getRigolData };
