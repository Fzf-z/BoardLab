import net from 'net';

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
    }

    // Start listening for spontaneous data (Multimeter Monitor)
    async startMonitor(onData: (data: string) => void) {
        if (this.connectionType !== 'tcp_raw') throw new Error("Monitor only supported for TCP");
        
        this.stopMonitor(); // Close existing if any
        this.monitorCallback = onData;

        console.log(`[GenericDriver] Starting Monitor on ${this.ip}:${this.port}`);
        this.client = new net.Socket();
        
        this.client.connect(this.port, this.ip, () => {
            console.log(`[GenericDriver] Connected to ${this.name}`);
        });

        this.client.on('data', (data) => {
            const str = data.toString();
            
            // If we are waiting for a command response (execute), route it there
            if (this.isExpectingResponse && this.responseResolver) {
                this.responseResolver(str);
                // Important: Response is consumed, don't emit to monitor? 
                // Usually yes, but some instruments echo.
                // For safety, we assume if we asked for it, it's not a monitor event.
                return;
            }

            // Otherwise, it's a monitor event (unsolicited data or button press)
            if (this.monitorCallback && str.trim().length > 0) {
                 // Basic cleanup
                 const clean = str.replace(/[^\x20-\x7E]/g, '').trim();
                 if(clean) this.monitorCallback(clean);
            }
        });

        this.client.on('error', (err) => {
            console.error(`[GenericDriver] Connection Error:`, err.message);
            this.stopMonitor();
        });

        this.client.on('close', () => {
            console.log(`[GenericDriver] Connection Closed`);
            // Optional: Auto-reconnect logic could go here
        });
    }

    stopMonitor() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
        this.monitorCallback = null;
    }

    async execute(actionKey: string): Promise<{ status: 'success' | 'error'; value?: string; message?: string }> {
        const scpiCommand = this.commands[actionKey];
        if (!scpiCommand) {
            return Promise.reject({ status: 'error', message: `El instrumento ${this.name} no tiene configurado el comando para ${actionKey}` });
        }

        if (this.connectionType === 'tcp_raw') {
            return this.sendTcp(scpiCommand);
        } else if (this.connectionType === 'serial') {
            return this.sendSerial(scpiCommand);
        } else {
            return Promise.reject({ status: 'error', message: `Tipo de conexión desconocido: ${this.connectionType}` });
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
        return Promise.reject({ status: 'error', message: "Soporte USB Serial aún no implementado" });
    }
}
