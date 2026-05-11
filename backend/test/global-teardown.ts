import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { purgeE2eArtifacts } from './purge-e2e-artifacts';

/**
 * Hook global do Jest: roda UMA vez ao final de toda a suíte e2e e apaga
 * qualquer registro criado em runtime nos tenants `demo`/`other`.
 *
 * Política: testes individuais não precisam mais limpar o que criaram (apesar
 * de ser bom estilo continuar fazendo). Esse teardown garante que entre runs
 * o banco sempre volta ao estado equivalente ao do `prisma db seed`.
 */
export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // 1) Lê o marker do globalSetup. Tudo Notification / Communication /
    // FinancialCharge criado *após* esse instante é considerado "gerado pela
    // suíte atual" e é apagado mesmo quando endereçado a usuários legítimos
    // (caso típico: `seed_student_demo.accountUser = pai@demo.com`).
    const markerPath = path.resolve(
      __dirname,
      '..',
      'node_modules',
      '.cache',
      'e2e-run-marker.txt',
    );
    let runStart: Date | null = null;
    if (fs.existsSync(markerPath)) {
      const raw = fs.readFileSync(markerPath, 'utf8').trim();
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) runStart = parsed;
    }

    const { deleted } = await purgeE2eArtifacts(prisma);

    // 2) Limpeza extra time-based para entidades emitidas em direção a contas
    // legítimas pelos próprios serviços (ex.: notificações ao pai/professor
    // quando o teste mexeu em alunos/turmas do seed).
    if (runStart) {
      const tenants = await prisma.tenant.findMany({
        where: { slug: { in: ['demo', 'other'] } },
        select: { id: true },
      });
      const tenantIds = tenants.map((t) => t.id);
      if (tenantIds.length) {
        const where = {
          tenantId: { in: tenantIds },
          createdAt: { gte: runStart },
        } as const;
        const safeDelete = async (
          label: string,
          fn: () => Promise<{ count: number }>,
        ) => {
          try {
            const r = await fn();
            if (r.count) deleted[`${label}~recent`] = r.count;
          } catch (e) {
            console.warn(`[purge-e2e] ${label}~recent:`, (e as Error).message);
          }
        };
        await safeDelete('notification', () =>
          prisma.notification.deleteMany({ where }),
        );
        await safeDelete('communicationMessage', () =>
          prisma.communicationMessage.deleteMany({ where }),
        );
        await safeDelete('financialCharge', () =>
          prisma.financialCharge.deleteMany({ where }),
        );
        await safeDelete('report', () => prisma.report.deleteMany({ where }));
        await safeDelete('evaluation', () =>
          prisma.evaluation.deleteMany({
            where: {
              tenantId: { in: tenantIds },
              evaluatedAt: { gte: runStart },
            },
          }),
        );
        await safeDelete('individualPlan', () =>
          prisma.individualPlan.deleteMany({ where }),
        );
        await safeDelete('workout', () => prisma.workout.deleteMany({ where }));
        // Items da biblioteca criados em runtime (não do seed) também saem
        // quando o teste forneceu nome customizado.
        await safeDelete('exerciseLibraryItem', () =>
          prisma.exerciseLibraryItem.deleteMany({ where }),
        );
        await safeDelete('calendarEvent', () =>
          prisma.calendarEvent.deleteMany({ where }),
        );
      }
      // Apaga marker para a próxima execução não usar timestamp antigo.
      fs.unlinkSync(markerPath);
    }

    const totals = Object.entries(deleted)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    // eslint-disable-next-line no-console
    if (totals) console.log(`[e2e] purge: ${totals}`);
    else console.log('[e2e] purge: banco já estava limpo');
  } finally {
    await prisma.$disconnect();
  }
}
