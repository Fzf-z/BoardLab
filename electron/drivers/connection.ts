import net from 'net';

export function testConnection(ip: string, port: number | string): Promise<{ status: string; message?: string }> {
    return new Promise((resolve) => {
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: 'Timeout' });
        }, 2000);

        client.connect(typeof port === 'string' ? parseInt(port) : port, ip, () => {
            clearTimeout(timeout);
            client.end();
            resolve({ status: 'success' });
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ status: 'error', message: err.message });
        });
    });
}
