const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'service-worker.js');
let content = fs.readFileSync(swPath, 'utf-8');

// Generate version from git commit hash or timestamp
let version;
try {
  const { execSync } = require('child_process');
  version = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  version = new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

content = content.replace(
  /const CACHE_NAME = 'superglazka-v\d+'/,
  `const CACHE_NAME = 'superglazka-v${version}'`
);

fs.writeFileSync(swPath, content);
console.log(`Service Worker cache bumped to: superglazka-v${version}`);
