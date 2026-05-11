const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const example = path.join(root, '.env.example');
const target = path.join(root, 'backend', '.env');

if (!fs.existsSync(example)) {
  console.error('Falta .env.example na raiz do repositório.');
  process.exit(1);
}

if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target);
  console.log('Criado backend/.env a partir de .env.example');
} else {
  console.log('backend/.env já existe — não alterado');
}
