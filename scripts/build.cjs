'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let html = read('src/page.html').replace('/* STYLES */', () => read('src/styles.css'))
  .replace('/* ENGINE */', () => read('src/engine.js')).replace('/* APP */', () => read('src/app.js'))
  .replaceAll('/* VERSION */', () => JSON.parse(read('package.json')).version);
for (const file of ['calc.html', 'index.html']) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(path.join(root, file)) || read(file) !== html) throw new Error(`${file} desatualizado. Execute npm run build.`);
  } else fs.writeFileSync(path.join(root, file), html);
}
console.log(process.argv.includes('--check') ? 'HTMLs conferidos com as fontes.' : 'calc.html e index.html gerados: aplicação offline sem dependências.');
