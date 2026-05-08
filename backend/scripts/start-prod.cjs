const fs = require('fs');
const { spawn } = require('child_process');

const candidates = ['dist/main.js', 'dist/src/main.js'];
const entry = candidates.find((f) => fs.existsSync(f));

if (!entry) {
  console.error(
    '[start:prod] Nenhum entrypoint Nest encontrado. Esperado um de:',
    candidates.join(', '),
  );
  try {
    const walk = (dir, prefix = '') => {
      const names = fs.readdirSync(dir, { withFileTypes: true });
      for (const n of names) {
        const rel = `${prefix}${n.name}`;
        const full = `${dir}/${n.name}`;
        if (n.isDirectory()) walk(full, `${rel}/`);
        else if (n.name === 'main.js') console.error('  encontrado:', rel);
      }
    };
    if (fs.existsSync('dist')) walk('dist');
    else console.error('  pasta dist/ não existe');
  } catch (e) {
    console.error('  ao listar dist:', e.message);
  }
  process.exit(1);
}

const child = spawn(process.execPath, [entry], { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
