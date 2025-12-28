const net = require('net');

function setOwonConfig(ip, port, configCommand) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: 'Timeout setting config' });
        }, 2000);

        client.connect(parseInt(port), ip, () => {
            client.write(configCommand.trim() + '\n', () => {
                clearTimeout(timeout);
                client.destroy();
                resolve({ status: 'success' });
            });
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            client.destroy();
            resolve({ status: 'error', message: err.message });
        });
    });
}

function getOwonMeasurement(ip, port, measureCommand) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        let response = '';
        const timeout = setTimeout(() => {
            client.destroy();
            resolve({ status: 'error', message: 'Timeout getting measurement' });
        }, 2000);

        client.connect(parseInt(port), ip, () => {
            client.write(measureCommand.trim() + '\n');
        });

        client.on('data', (data) => {
            response += data.toString();
            if (response.length > 0) {
                clearTimeout(timeout);
                client.destroy();
                resolve({ status: 'success', value: response.trim() });
            }
        });

        client.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ status: 'error', message: err.message });
        });
    });
}

module.exports = { setOwonConfig, getOwonMeasurement };
