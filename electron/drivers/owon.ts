import net from 'net';

export function setOwonConfig(ip: string, port: number | string, configCommand: string): Promise<{ status: string; message?: string }> {
    return new Promise((resolve) => {
        const client = new net.Socket();
        const debug_info = `[Config CMD: ${configCommand}]`;
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: `Timeout setting config. ${debug_info}` });
        }, 2000);

        client.connect(typeof port === 'string' ? parseInt(port) : port, ip, () => {
            client.write(configCommand.trim() + '\n', () => {
                clearTimeout(timeout);
                client.end(); // Use end instead of destroy for cleaner close
                resolve({ status: 'success' });
            });
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            client.destroy();
            resolve({ status: 'error', message: `${err.message}. ${debug_info}` });
        });
    });
}

export function getOwonMeasurement(ip: string, port: number | string, measureCommand: string, timeoutMs: number = 2000): Promise<{ status: string; value?: string; message?: string }> {
    return new Promise((resolve) => {
        const client = new net.Socket();
        let response = '';
        const debug_info = `[Measure CMD: ${measureCommand}]`;
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: `Timeout getting measurement. ${debug_info}` });
        }, timeoutMs);

        client.connect(typeof port === 'string' ? parseInt(port) : port, ip, () => {
            client.write(measureCommand.trim() + '\n');
        });

        client.on('data', (data) => {
            response += data.toString();
            if (response.length > 0) {
                clearTimeout(timeout);
                client.destroy(); // Destroy immediately after first chunk? Might be risky if fragmented but typical for SCPI
                const cleanValue = response.replace(/[^\x20-\x7E]/g, '').trim();
                resolve({ status: 'success', value: cleanValue });
            }
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ status: 'error', message: `${err.message}. ${debug_info}` });
        });
    });
}
