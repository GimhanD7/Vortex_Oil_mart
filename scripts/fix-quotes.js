const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src/app');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // Replace fetch("/api/...${...}...") with fetch(`/api/...${...}...`)
    let modified = content.replace(/fetch\("(\/api\/[^"]*?\$\{[^"]*?\}[^"]*?)"/g, 'fetch(`$1`');
    if (content !== modified) {
        fs.writeFileSync(file, modified);
        console.log('Fixed', file);
    }
});
