const net = require('net');

function testConnection(ip, port) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: 'Timeout' });
        }, 2000);

        client.connect(parseInt(port), ip, () => {
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

module.exports = { testConnection };