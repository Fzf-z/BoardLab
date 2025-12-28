const net = require('net');

function readOwon(ip, port, command) {
    return new Promise((resolve) => {
      const client = new net.Socket();
      let response = '';
      const timeout = setTimeout(() => { 
          client.destroy(); 
          resolve({ status: 'error', message: 'Timeout' }); 
      }, 2000);
      
      client.connect(parseInt(port), ip, () => { 
          client.write(command.trim() + '\n'); 
      });
  
      client.on('data', (data) => {
        response += data.toString();
        if (response.includes('\n') || response.length > 0) {
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

  module.exports = { readOwon };
