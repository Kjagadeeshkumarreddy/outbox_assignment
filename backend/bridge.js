const net = require('net');
const { execSync } = require('child_process');

function getWslIp() {
  try {
    const output = execSync('wsl -d Ubuntu hostname -I', { encoding: 'utf-8' });
    const ip = output.trim().split(/\s+/)[0];
    return ip || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

const targetHost = getWslIp();

function createBridge(port) {
  const server = net.createServer((client) => {
    const target = net.connect({ host: targetHost, port });

    client.pipe(target);
    target.pipe(client);

    client.on('error', () => target.destroy());
    target.on('error', () => client.destroy());
    client.on('close', () => target.destroy());
    target.on('close', () => client.destroy());
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Port bridge active: 0.0.0.0:${port} -> ${targetHost}:${port}`);
  });
}

createBridge(3000);
createBridge(3001);
