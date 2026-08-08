const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, '.oil-mart-db');
const mysqlBin = process.env.XAMPP_MYSQL_BIN || 'C:\\xampp\\mysql\\bin';
const installer = path.join(mysqlBin, 'mysql_install_db.exe');
const server = path.join(mysqlBin, 'mysqld.exe');
const config = path.join(dataDir, 'my.ini');

function portIsOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 3306 });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(800, () => { socket.destroy(); resolve(false); });
  });
}

async function start() {
  if (await portIsOpen()) {
    console.log('MariaDB is already running on 127.0.0.1:3306.');
    return;
  }
  if (!fs.existsSync(server) || !fs.existsSync(installer)) {
    throw new Error(`XAMPP MariaDB binaries were not found in ${mysqlBin}`);
  }
  if (!fs.existsSync(path.join(dataDir, 'mysql'))) {
    fs.mkdirSync(dataDir, { recursive: true });
    const initialized = spawnSync(installer, [`--datadir=${dataDir}`, '--port=3306', '--password='], { stdio: 'inherit' });
    if (initialized.status !== 0) throw new Error('Could not initialize the Oil Mart database directory');
  }
  const child = spawn(server, [`--defaults-file=${config}`, '--standalone'], {
    cwd: mysqlBin,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (await portIsOpen()) {
      console.log('Oil Mart MariaDB started on 127.0.0.1:3306.');
      return;
    }
  }
  throw new Error(`MariaDB did not start. Check ${dataDir} for the error log.`);
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
