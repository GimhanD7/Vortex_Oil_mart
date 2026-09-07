const fs = require('node:fs');
const path = require('node:path');

const envFile = process.env.OIL_MART_ENV_FILE || path.resolve(__dirname, '../api/.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

function databaseOptions() {
  const options = {};
  for (const [name, key] of Object.entries({ host: 'MYSQL_HOST', user: 'MYSQL_USER', password: 'MYSQL_PASSWORD', database: 'MYSQL_DATABASE' })) {
    const value = process.env[key];
    if (value === undefined || (value === '' && name !== 'password')) throw new Error(`Missing ${key}. Configure api/.env first.`);
    options[name] = value;
  }
  options.port = Number(process.env.MYSQL_PORT || 3306);
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Invalid MySQL port.');
  if (process.env.APP_ENV !== 'local' && !options.password) throw new Error('A production database password is required.');
  return options;
}

module.exports = { databaseOptions };
