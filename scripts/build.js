const fs = require('fs');
const path = require('path');

// 读取 server/package.json
const serverPackagePath = path.join(__dirname, '../server/package.json');
const serverPackage = JSON.parse(fs.readFileSync(serverPackagePath, 'utf8'));

// 创建 dist/package.json 的内容
const distPackage = {
  name: 'modpack-web-server',
  version: serverPackage.version,
  description: 'ModPack Web Server - Production Build',
  main: 'index.js',
  type: 'module',
  scripts: {
    start: 'node index.js',
    dev: 'node index.js'
  },
  dependencies: serverPackage.dependencies,
  engines: {
    node: '>=18.0.0'
  },
  author: serverPackage.author || 'zocsrd',
  license: serverPackage.license || 'ISC'
};

// 确保 dist 目录存在
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 写入 dist/package.json
const distPackagePath = path.join(distDir, 'package.json');
fs.writeFileSync(distPackagePath, JSON.stringify(distPackage, null, 2));

console.log('✅ Generated dist/package.json');
console.log(`📦 Dependencies: ${Object.keys(distPackage.dependencies).length} packages`);
