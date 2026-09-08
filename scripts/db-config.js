const fs = require('node:fs');
const path = require('node:path');

const envFile = process.env.OIL_MART_ENV_FILE || path.resolve(__dirname, '../api/.env');
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (e) {}
}

function databaseOptions() {
  const isLocal = process.env.APP_ENV === 'local' || (!process.env.APP_ENV && (!process.env.MYSQL_HOST || process.env.MYSQL_HOST === '127.0.0.1' || process.env.MYSQL_HOST === 'localhost'));
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || (isLocal ? 'root' : 'vortdbyg_gimhana'),
    password: process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : (isLocal ? '' : '_je-P_vSa}09V21J'),
    database: process.env.MYSQL_DATABASE || (isLocal ? 'oil_mart' : 'vortdbyg_oil_mart'),
    port: Number(process.env.MYSQL_PORT || 3306),
  };
}

module.exports = { databaseOptions };
