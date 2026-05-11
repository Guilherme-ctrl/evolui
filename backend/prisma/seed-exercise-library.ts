/**
 * Seed adicional: popula a biblioteca de exercícios do tenant `demo`
 * com itens extraídos do protocolo "Pré-temporada FutPró".
 *
 * Idempotente: para cada exercício, faz upsert por (tenant + ownerStaff + name).
 * Executar com:
 *   cd backend && npx ts-node --transpile-only prisma/seed-exercise-library.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Seed = {
  name: string;
  description?: string;
  defaultSets?: number;
  defaultRepetitions?: number;
  defaultDurationSeconds?: number;
  defaultRestSeconds?: number;
  notes?: string;
};

const SOURCE_NOTE = 'Origem: protocolo Pré-temporada FutPró.';

const ITEMS: Seed[] = [
  // -------- Mobilidade & aquecimento --------
  {
    name: 'Mobilidade de tornozelo',
    description: 'Aquecimento e mobilidade da articulação do tornozelo.',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Mobilidade de tornozelo semijoelho',
    description: 'Mobilidade dinâmica de tornozelo com apoio em semijoelho.',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Posterior mão atrás da coxa',
    description: 'Mobilidade dinâmica de cadeia posterior (isquiotibiais).',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 20,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Quadríceps deslocando',
    description: 'Mobilidade ativa de quadríceps em deslocamento.',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Adutor semijoelho',
    description: 'Mobilidade dinâmica de adutores em apoio semijoelho.',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Psoas semijoelho',
    description: 'Mobilidade e ativação do iliopsoas em apoio semijoelho.',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },

  // -------- Core e estabilidade --------
  {
    name: 'Prancha frontal',
    description: 'Estabilização isométrica de core, decúbito ventral.',
    defaultSets: 3,
    defaultDurationSeconds: 30,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Prancha lateral',
    description: 'Estabilização isométrica lateral de core.',
    defaultSets: 3,
    defaultDurationSeconds: 20,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Prancha sobe e desce',
    description: 'Prancha dinâmica alternando apoio entre antebraços e mãos.',
    defaultSets: 4,
    defaultRepetitions: 8,
    defaultRestSeconds: 40,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Ponte isométrica',
    description: 'Ponte de glúteo isométrica em decúbito dorsal.',
    defaultSets: 3,
    defaultDurationSeconds: 30,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Dead bug isométrico',
    description: 'Controle anti-extensão lombar com sustentação de braços e pernas.',
    defaultSets: 3,
    defaultDurationSeconds: 30,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Superman',
    description: 'Extensão de tronco em decúbito ventral para cadeia posterior.',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Ostra sem miniband',
    description: 'Ativação de glúteo médio (clamshell) sem elástico.',
    defaultSets: 3,
    defaultRepetitions: 10,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Canoa',
    description: 'Isometria de core (hollow hold) sustentando tronco e pernas.',
    defaultSets: 3,
    defaultDurationSeconds: 30,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },

  // -------- Força / HIIT muscular --------
  {
    name: 'Agachamento sem peso',
    description: 'Agachamento livre, bipodal, com peso corporal.',
    defaultSets: 3,
    defaultRepetitions: 20,
    defaultRestSeconds: 60,
    notes: `${SOURCE_NOTE} Em HIIT, encadear sem descanso até fim da rodada.`,
  },
  {
    name: 'Agachamento isométrico',
    description: 'Manutenção de agachamento parado em 90° de flexão de joelhos.',
    defaultSets: 3,
    defaultDurationSeconds: 60,
    defaultRestSeconds: 60,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Ponte bilateral',
    description: 'Ponte de glúteo dinâmica com apoio dos dois pés.',
    defaultSets: 5,
    defaultRepetitions: 25,
    defaultRestSeconds: 60,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Thruster',
    description: 'Combinado agachamento + desenvolvimento de ombros. Adapte a carga se não tiver halter/anilha.',
    defaultSets: 4,
    defaultRepetitions: 20,
    defaultRestSeconds: 60,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Passada em deslocamento',
    description: 'Avanço (lunge) caminhando alternando pernas.',
    defaultSets: 5,
    defaultRepetitions: 30,
    defaultRestSeconds: 60,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Apoio',
    description: 'Flexão de braço (push-up) com técnica completa.',
    defaultSets: 5,
    defaultRepetitions: 15,
    defaultRestSeconds: 60,
    notes: `${SOURCE_NOTE} No protocolo original: "máximo" repetições.`,
  },

  // -------- Agilidade / velocidade / pliometria --------
  {
    name: 'Skipping deslocando',
    description: 'Skipping alto avançando à frente; foco em frequência e amplitude.',
    defaultSets: 3,
    defaultRepetitions: 20,
    defaultRestSeconds: 50,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Skipping batida curta',
    description: 'Skipping com batida rápida e curta no solo.',
    defaultSets: 3,
    defaultRepetitions: 30,
    defaultRestSeconds: 60,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Hopserlauf',
    description: 'Salto alternado com elevação do joelho à frente (skipping em salto).',
    defaultSets: 3,
    defaultRepetitions: 20,
    defaultRestSeconds: 50,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Wall drill marchando',
    description: 'Marcha de aceleração contra a parede; foco em postura e ataque do solo.',
    defaultSets: 3,
    defaultRepetitions: 20,
    defaultRestSeconds: 30,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Anfersen',
    description: 'Calcanhar ao glúteo em corrida estacionária; frequência de pernas.',
    defaultSets: 3,
    defaultRepetitions: 20,
    defaultRestSeconds: 50,
    notes: SOURCE_NOTE,
  },
  {
    name: 'Pogo jump',
    description: 'Saltos verticais curtos com contato rápido (rigidez de tornozelo).',
    defaultSets: 2,
    defaultRepetitions: 10,
    defaultRestSeconds: 60,
    notes: SOURCE_NOTE,
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) {
    throw new Error('Tenant "demo" não encontrado. Rode `npm run db:seed` antes.');
  }

  const profUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'prof@demo.com' },
  });
  if (!profUser) {
    throw new Error(
      'Usuário "prof@demo.com" não encontrado no tenant demo. Rode `npm run db:seed` antes.',
    );
  }

  const staff = await prisma.staffProfile.findUnique({
    where: { userId: profUser.id },
  });
  if (!staff || !staff.active) {
    throw new Error(
      'StaffProfile do Professor Demo ausente ou inativo. Rode `npm run db:seed` antes.',
    );
  }

  // ID determinístico (`seed_lib_<idx>`) garante idempotência e permite que o
  // teardown global de e2e distinga "seed" de "lixo" criado por testes.
  let created = 0;
  let updated = 0;
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const seedId = `seed_lib_${String(i + 1).padStart(3, '0')}`;
    // Limpeza: se houver uma versão antiga sem o id determinístico (criada por
    // seeds anteriores), apaga antes do upsert para evitar duplicidade por nome.
    await prisma.exerciseLibraryItem.deleteMany({
      where: {
        tenantId: tenant.id,
        name: item.name,
        NOT: { id: seedId },
      },
    });
    const existing = await prisma.exerciseLibraryItem.findUnique({
      where: { id: seedId },
    });
    if (existing) {
      await prisma.exerciseLibraryItem.update({
        where: { id: seedId },
        data: {
          name: item.name,
          description: item.description ?? null,
          defaultSets: item.defaultSets ?? null,
          defaultRepetitions: item.defaultRepetitions ?? null,
          defaultDurationSeconds: item.defaultDurationSeconds ?? null,
          defaultRestSeconds: item.defaultRestSeconds ?? null,
          notes: item.notes ?? null,
          archived: false,
          ownerStaffId: staff.id,
          createdByUserId: profUser.id,
        },
      });
      updated++;
    } else {
      await prisma.exerciseLibraryItem.create({
        data: {
          id: seedId,
          tenantId: tenant.id,
          ownerStaffId: staff.id,
          createdByUserId: profUser.id,
          name: item.name,
          description: item.description ?? null,
          defaultSets: item.defaultSets ?? null,
          defaultRepetitions: item.defaultRepetitions ?? null,
          defaultDurationSeconds: item.defaultDurationSeconds ?? null,
          defaultRestSeconds: item.defaultRestSeconds ?? null,
          notes: item.notes ?? null,
        },
      });
      created++;
    }
  }
  console.log(
    `Biblioteca FutPró Pré-temporada → tenant=demo · staff=${profUser.fullName}\n` +
      `  criados: ${created}\n  atualizados: ${updated}\n  total no script: ${ITEMS.length}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
