const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

// 1x1 black pixel PNG base64
const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const buffer = Buffer.from(b64, 'base64');

// We will just use this tiny pixel for now to satisfy the file existence requirement.
// Browsers will scale it (it will look ugly, but it will be a valid PNG and allow installation).
fs.writeFileSync(path.join(dir, 'icon-192x192.png'), buffer);
fs.writeFileSync(path.join(dir, 'icon-512x512.png'), buffer);
console.log("Icons created.");
