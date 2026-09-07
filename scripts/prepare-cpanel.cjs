const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const exported = path.join(root, 'out');
if (!fs.existsSync(path.join(exported, 'index.html'))) throw new Error('Run npm run build before preparing the cPanel upload.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(root, 'build', `cpanel-upload-${stamp}`);
fs.mkdirSync(destination, { recursive: true });

// Copy the static export, then add only the server-side runtime allowlist.
fs.cpSync(exported, destination, { recursive: true });
const apiFiles = ['.htaccess', 'index.php', 'config.php', 'environment.php', 'auth_middleware.php', 'session.php', 'credit.php', 'product-import.php'];
fs.mkdirSync(path.join(destination, 'api'));
for (const name of apiFiles) fs.copyFileSync(path.join(root, 'api', name), path.join(destination, 'api', name));
fs.mkdirSync(path.join(destination, 'api', 'routes'));
for (const entry of fs.readdirSync(path.join(root, 'api', 'routes'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.php')) fs.copyFileSync(path.join(root, 'api', 'routes', entry.name), path.join(destination, 'api', 'routes', entry.name));
}
if (!fs.existsSync(path.join(destination, '.htaccess'))) throw new Error('The exported Apache configuration is missing.');
console.log(`cPanel upload folder: ${destination}`);
console.log('No credentials included. Configure the server api/.env separately and preserve existing production data.');
