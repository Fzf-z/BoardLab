import net from 'net';

export function getRigolData(ip: string, port: number | string, timeoutMs: number = 4000): Promise<any> {
    return new Promise((resolve) => {
        let processingDone = false;
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: 'Timeout de conexión (4s)' });
        }, timeoutMs);

        const commandString = [
            ':WAV:SOUR CHAN1', ':WAV:MODE NORM', ':WAV:FORM BYTE',
            ':CHAN1:SCAL?',
            ':MEAS:VPP?',
            ':MEAS:FREQ?',
            ':WAV:PRE?',
            ':WAV:DATA?'
        ].join('\n') + '\n';

        let receivedData = Buffer.alloc(0);
        
        const processAndResolve = () => {
            if (processingDone) return;
            processingDone = true;

            clearTimeout(timeout);
            client.destroy();

            try {
                if (receivedData.length === 0) throw new Error("No se recibió respuesta alguna del instrumento.");
                
                const bufferAsString = receivedData.toString('ascii');
                const binaryStartIndex = bufferAsString.indexOf('#');

                if (binaryStartIndex === -1) throw new Error("No se encontró el bloque de datos binarios (#). Buffer: " + receivedData.toString('ascii').substring(0, 100));

                const textPart = bufferAsString.substring(0, binaryStartIndex);
                // Filter out empty lines caused by extra newlines
                const lines = textPart.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);

                if (lines.length < 4) {
                    throw new Error(`Se esperaban al menos 4 líneas de texto, recibidas ${lines.length}. Buffer text: "${textPart}"`);
                }

                // Parse textual values
                const vScaleStr = lines[0];
                const voltageScale = parseFloat(vScaleStr);
                
                const vppStr = lines[1];
                let vpp = parseFloat(vppStr);
                if (isNaN(vpp) || vpp > 1e30) vpp = 0; 

                const freqStr = lines[2];
                let freq = parseFloat(freqStr);
                if (isNaN(freq) || freq > 1e30) freq = 0;

                const preambleStr = lines[3];
                const preamble = preambleStr.split(',');
                if (preamble.length < 10) throw new Error(`Preamble incompleto: ${preambleStr}`);

                // Preamble Parsing
                const xInc = parseFloat(preamble[4]);
                // const xOrg = parseFloat(preamble[5]);
                // const xRef = parseFloat(preamble[6]);
                const yInc = parseFloat(preamble[7]);
                const yOrg = parseFloat(preamble[8]);
                const yRef = parseFloat(preamble[9]);

                // Binary Block Parsing
                // #<N><Length><Data>
                const numDigitsChar = bufferAsString[binaryStartIndex + 1];
                const numDigits = parseInt(numDigitsChar);
                if (isNaN(numDigits)) throw new Error("Error parseando el número de dígitos del bloque binario.");

                // Start of raw data
                const rawDataStart = binaryStartIndex + 2 + numDigits;
                
                // Extract raw bytes
                const rawData = receivedData.subarray(rawDataStart, receivedData.length);
                
                // Convert raw bytes to voltage values
                const waveform = [];
                for (let i = 0; i < rawData.length; i++) {
                    // Check for newline at the end which is termination char
                    if (rawData[i] === 0x0A && i === rawData.length - 1) continue; 
                    
                    const rawVal = rawData[i]; // unsigned byte 0-255
                    const voltage = (rawVal - yRef) * yInc + yOrg;
                    waveform.push(voltage);
                }

                const timeScale = (xInc * waveform.length) / 10; // Approx 10 divisions on screen

                resolve({
                    status: 'success',
                    waveform,
                    timeScale: timeScale, // s/div
                    voltageScale: voltageScale, // V/div
                    voltageOffset: yOrg, // Approx offset
                    vpp: vpp,
                    freq: freq,
                });

            } catch (err: any) {
                console.error("Error procesando datos Rigol:", err);
                resolve({ status: 'error', message: err.message });
            }
        };

        client.connect(typeof port === 'string' ? parseInt(port) : port, ip, () => {
            client.write(commandString);
        });

        client.on('data', (data) => {
            receivedData = Buffer.concat([receivedData, data as Buffer]);
            
            // Optimization: Only try to parse if buffer is reasonably large
            if (receivedData.length > 50) { 
                const str = receivedData.toString('ascii');
                const hashIdx = str.indexOf('#');
                if (hashIdx !== -1) {
                    // Check if we have 4 lines of text before hash
                    const textPart = str.substring(0, hashIdx);
                    const lines = textPart.trim().split('\n').filter(l => l.trim().length > 0);
                    
                    if (lines.length >= 4) {
                        const nDigits = parseInt(str[hashIdx + 1]);
                        if (!isNaN(nDigits)) {
                            // Ensure we have length bytes
                            if (str.length >= hashIdx + 2 + nDigits) {
                                const lengthStr = str.substring(hashIdx + 2, hashIdx + 2 + nDigits);
                                const dataLength = parseInt(lengthStr);
                                if (!isNaN(dataLength)) {
                                    // Total bytes expected: header_bytes + # + N + length_bytes + binary_data
                                    // hashIdx is the number of bytes before #
                                    const totalExpected = hashIdx + 2 + nDigits + dataLength;
                                    
                                    // If we have enough data (ignoring potential trailing newline)
                                    if (receivedData.length >= totalExpected) {
                                        processAndResolve();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ status: 'error', message: err.message });
        });
        
        client.on('end', () => {
            processAndResolve();
        });
    });
}
