import * as fs from 'fs';
import * as path from 'path';

/**
 * Marker temporal usado pelo teardown global para apagar dados criados durante
 * a suíte e2e mesmo quando ligados a contas legítimas (ex.: notificações
 * geradas para `pai@demo.com` por testes que operam sobre `seed_student_demo`).
 *
 * O timestamp é salvo num arquivo `node_modules/.cache` (volátil, mas
 * persistente entre setup → testes → teardown na mesma execução do Jest).
 */
export default async function globalSetup(): Promise<void> {
  const cacheDir = path.resolve(__dirname, '..', 'node_modules', '.cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const markerPath = path.join(cacheDir, 'e2e-run-marker.txt');
  fs.writeFileSync(markerPath, new Date().toISOString(), 'utf8');
}
