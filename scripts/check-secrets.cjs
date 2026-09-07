const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const files = git('diff', '--cached', '--name-only', '--diff-filter=ACM', '-z').split('\0').filter(Boolean);
const findings = [];
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:ghp_|github_pat_|sk_live_)[a-zA-Z0-9_]{20,}/,
  /\$(?:jwt_secret|pass|password)\s*=\s*['"][^'"\s][^'"]{5,}['"]/i,
  /(?:api[_-]?key|jwt[_-]?secret|MYSQL_PASSWORD)\s*[:=]\s*['"][a-zA-Z0-9_+\/-]{20,}['"]/i,
];
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== 'api/.env.example') findings.push(`${file}: private environment file`);
  if (/\.(?:zip|bak|pem|key)$|(^|\/)(?:\.local-backups|\.local-checks|\.oil-mart-db)\//i.test(file) && file !== '.local-backups/.htaccess') findings.push(`${file}: private/generated artifact`);
  const content = git('show', `:${file}`);
  content.split(/\r?\n/).forEach((line, index) => {
    if (patterns.some(pattern => pattern.test(line))) findings.push(`${file}:${index + 1}: possible secret (value hidden)`);
  });
}
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log(`PASS: checked ${files.length} staged files; no recognized secrets or private artifacts found.`);
