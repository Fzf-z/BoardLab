import net from 'net';
import { SerialPort, ReadlineParser } from 'serialport';

export interface InstrumentConfig {
    name: string;
    type: 'multimeter' | 'oscilloscope'; // Added type
    ip_address: string;
    port: number;
    command_map: string; // JSON string
    connection_type: 'tcp_raw' | 'serial';
    serial_settings?: string; // JSON string
}

export class GenericSCPIDriver {
    private ip: string;
    private port: number;
    private commands: Record<string, string>;
    private name: string;
    private connectionType: 'tcp_raw' | 'serial';
    private timeout: number;

    // Serial State
    private serialPort: SerialPort | null = null;
    private serialParser: ReadlineParser | null = null;
    private serialSettings: { path: string; baudRate: number } | null = null;

    // Monitor / Persistent Connection State
    private client: net.Socket | null = null;
    private monitorCallback: ((data: string) => void) | null = null;
    private isExpectingResponse: boolean = false;
    private responseResolver: ((value: any) => void) | null = null;

    constructor(config: InstrumentConfig) {
        this.ip = config.ip_address;
        this.port = config.port;
        this.commands = JSON.parse(config.command_map);
        this.name = config.name;
        this.connectionType = config.connection_type;
        this.timeout = 2000;

        // Serial Config
        if (this.connectionType === 'serial') {
            if (config.serial_settings) {
                try {
                    this.serialSettings = JSON.parse(config.serial_settings);
                } catch (e) {
                     console.error("Invalid Serial Settings JSON:", e);
                }
            }
            // Fallback if settings are missing but type is serial
            if (!this.serialSettings) {
                // Heuristic: IP field = Port Path, Port field = BaudRate
                this.serialSettings = { path: this.ip, baudRate: this.port || 9600 };
            }
        }
    }

    // Start listening for spontaneous data (Multimeter Monitor)
    async startMonitor(onData: (data: string) => void) {
        this.stopMonitor(); // Close existing if any
        this.monitorCallback = onData;

        if (this.connectionType === 'tcp_raw') {
            console.log(`[GenericDriver] Starting TCP Monitor on ${this.ip}:${this.port}`);
            this.client = new net.Socket();
            
            this.client.connect(this.port, this.ip, () => {
                console.log(`[GenericDriver] Connected to ${this.name}`);
            });

            this.client.on('data', (data) => {
                const str = data.toString();
                this.handleIncomingData(str);
            });

            this.client.on('error', (err) => {
                console.error(`[GenericDriver] Connection Error:`, err.message);
                this.stopMonitor();
            });

            this.client.on('close', () => {
                console.log(`[GenericDriver] Connection Closed`);
            });
        } else if (this.connectionType === 'serial') {
            if (!this.serialSettings) throw new Error("Serial settings not configured");
            
            console.log(`[GenericDriver] Starting Serial Monitor on ${this.serialSettings.path}`);
            
            this.serialPort = new SerialPort({ 
                path: this.serialSettings.path, 
                baudRate: this.serialSettings.baudRate,
                autoOpen: false 
            });

            this.serialParser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

            this.serialParser.on('data', (data: string) => {
                this.handleIncomingData(data.toString());
            });

            this.serialPort.on('error', (err) => {
                 console.error(`[GenericDriver] Serial Error:`, err.message);
                 this.stopMonitor();
            });

            this.serialPort.open((err) => {
                if (err) console.error("Error opening serial port:", err);
                else console.log("Serial Port Opened");
            });
        }
    }

    private handleIncomingData(str: string) {
        // If we are waiting for a command response (execute), route it there
        if (this.isExpectingResponse && this.responseResolver) {
            this.responseResolver(str);
            return;
        }

        // Otherwise, it's a monitor event (unsolicited data or button press)
        if (this.monitorCallback && str.trim().length > 0) {
                // Basic cleanup
                const clean = str.replace(/[^\x20-\x7E]/g, '').trim();
                if(clean) this.monitorCallback(clean);
        }
    }

    stopMonitor() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
        if (this.serialPort) {
            if (this.serialPort.isOpen) this.serialPort.close();
            this.serialPort = null;
            this.serialParser = null;
        }
        this.monitorCallback = null;
    }

    async execute(actionKey: string): Promise<{ status: 'success' | 'error'; value?: string; message?: string }> {
        const scpiCommand = this.commands[actionKey];
        if (!scpiCommand) {
            return Promise.reject({ status: 'error', message: `Instrument ${this.name} does not have a command configured for ${actionKey}` });
        }

        if (this.connectionType === 'tcp_raw') {
            return this.sendTcp(scpiCommand);
        } else if (this.connectionType === 'serial') {
            return this.sendSerial(scpiCommand);
        } else {
            return Promise.reject({ status: 'error', message: `Unknown connection type: ${this.connectionType}` });
        }
    }

    private sendTcp(cmd: string): Promise<{ status: 'success' | 'error'; value?: string; message?: string }> {
        const isQuery = cmd.includes('?');

        // If we have an active monitor connection, REUSE IT
        if (this.client && !this.client.destroyed) {
            return new Promise((resolve, reject) => {
                // Only expect response if it's a query
                if (isQuery) {
                    this.isExpectingResponse = true;
                    
                    // Timeout
                    const timeoutId = setTimeout(() => {
                         this.isExpectingResponse = false;
                         this.responseResolver = null;
                         reject({ status: 'error', message: 'Timeout waiting for instrument response (Shared Socket)' });
                    }, this.timeout);
    
                    // Setup Resolver
                    this.responseResolver = (rawData: string) => {
                        clearTimeout(timeoutId);
                        this.isExpectingResponse = false;
                        this.responseResolver = null;
                        const cleanValue = rawData.replace(/[^\x20-\x7E]/g, '').trim();
                        resolve({ status: 'success', value: cleanValue });
                    };
                }

                // Write
                this.client!.write(cmd + '\n', (err) => {
                    if (err) {
                        if (isQuery) {
                            // cleanup only if we were waiting
                            this.isExpectingResponse = false; 
                            this.responseResolver = null;
                        }
                        reject({ status: 'error', message: err.message });
                    } else {
                        // If NOT a query, resolve immediately after write
                        if (!isQuery) {
                            resolve({ status: 'success' });
                        }
                    }
                });
            });
        }

        // Standard One-Off Connection (Legacy Logic)
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            let responseData = '';
            let errorOccurred = false;

            const timeoutId = setTimeout(() => {
                errorOccurred = true;
                client.destroy();
                // Only timeout if it was a query we were waiting for
                if (isQuery) {
                    reject({ status: 'error', message: 'Timeout waiting for response' });
                } else {
                    // Should theoretically not happen if we handle non-query below, but safety net
                    resolve({ status: 'success' }); 
                }
            }, this.timeout);

            client.connect(this.port, this.ip, () => {
                client.write(cmd + '\n', () => {
                    if (!isQuery) {
                        // If not a query, we can close and resolve immediately after write
                        clearTimeout(timeoutId);
                        // Give a tiny delay for the packet to actually leave OS buffer before closing? 
                        // Usually not needed but 'end()' is better than destroy
                        client.end(); 
                        resolve({ status: 'success' });
                    }
                });
            });

            if (isQuery) {
                client.on('data', (data) => {
                    responseData += data.toString();
                    if (responseData.includes('\n')) {
                        clearTimeout(timeoutId);
                        client.destroy();
                        resolve({ status: 'success', value: responseData.trim() });
                    }
                });
            }

            client.on('error', (err) => {
                if (!errorOccurred) {
                    clearTimeout(timeoutId);
                    reject({ status: 'error', message: err.message });
                }
            });
        });
    }

    private sendSerial(cmd: string): Promise<{ status: 'success' | 'error'; value?: string; message?: string }> {
        if (!this.serialSettings) return Promise.reject({ status: 'error', message: "Serial settings missing" });

        const isQuery = cmd.includes('?');

        // REUSE existing connection if open (Monitor Mode)
        if (this.serialPort && this.serialPort.isOpen) {
            return new Promise((resolve, reject) => {
                if (isQuery) {
                    this.isExpectingResponse = true;
                    const timeoutId = setTimeout(() => {
                        this.isExpectingResponse = false;
                        this.responseResolver = null;
                        reject({ status: 'error', message: 'Timeout waiting for instrument response (Shared Serial)' });
                    }, this.timeout);

                    this.responseResolver = (rawData: string) => {
                        clearTimeout(timeoutId);
                        this.isExpectingResponse = false;
                        this.responseResolver = null;
                        const cleanValue = rawData.replace(/[^\x20-\x7E]/g, '').trim();
                        resolve({ status: 'success', value: cleanValue });
                    };
                }

                this.serialPort!.write(cmd + '\n', (err) => {
                    if (err) {
                        if (isQuery) {
                            this.isExpectingResponse = false;
                            this.responseResolver = null;
                        }
                        reject({ status: 'error', message: err.message });
                    } else {
                        if (!isQuery) resolve({ status: 'success' });
                    }
                });
            });
        }

        // ONE-OFF Connection
        return new Promise((resolve, reject) => {
            const port = new SerialPort({ 
                path: this.serialSettings!.path, 
                baudRate: this.serialSettings!.baudRate,
                autoOpen: false 
            });
            const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
            
            let timeoutId: NodeJS.Timeout;

            const cleanup = () => {
                if (port.isOpen) port.close();
                clearTimeout(timeoutId);
            };

            timeoutId = setTimeout(() => {
                cleanup();
                reject({ status: 'error', message: 'Timeout' });
            }, this.timeout);

            port.on('open', () => {
                port.write(cmd + '\n', (err) => {
                    if (err) {
                        cleanup();
                        reject({ status: 'error', message: err.message });
                        return;
                    }
                    if (!isQuery) {
                        port.drain(() => {
                            cleanup();
                            resolve({ status: 'success' });
                        });
                    }
                });
            });

            if (isQuery) {
                parser.on('data', (data) => {
                    cleanup();
                    resolve({ status: 'success', value: data.toString().trim() });
                });
            }

            port.on('error', (err) => {
                cleanup();
                // Avoid rejecting twice if timeout happened
                reject({ status: 'error', message: err.message });
            });

            port.open((err) => {
                if (err) {
                    clearTimeout(timeoutId);
                    reject({ status: 'error', message: "Failed to open port: " + err.message });
                }
            });
        });
    }
}
