/**
 * Seed: Academia São Paulo FC — cenário "médio" realista
 *
 * Cobre 100% dos modelos do schema:
 * Tenant · User · StaffProfile · Guardian · StudentGuardian · Student
 * Turma · Enrollment · ExerciseLibraryItem · Workout · WorkoutExercise
 * WorkoutAssignment · WorkoutFeedback · CalendarEvent · CalendarEventTurma
 * CalendarEventFeedback · AttendanceSession · AttendanceRecord
 * Evaluation · Report · CommunicationMessage · CommunicationRecipient
 * MediaAsset · MediaTagStudent · Notification · FinancialCharge
 * FinancialChargeAudit · IndividualPlan · IndividualPlanSession
 * IndividualPlanExercise · IndividualPlanAudit
 *
 * Execução: npx ts-node --transpile-only prisma/seed-acad-sp.ts
 * Idempotente: deleta e recria o tenant `acad-sp` a cada execução.
 * Senha de todos os usuários: senha123
 */

import {
  AttendanceMode,
  ChargeStatus,
  CommunicationScope,
  EventStatus,
  EventType,
  EvaluationModel,
  IndividualPlanStatus,
  IndividualPlanType,
  PrismaClient,
  ProfessionalType,
  ReportStatus,
  UserRole,
  WorkoutAssignmentScope,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────
// Dados estáticos
// ────────────────────────────────────────────────────────

const NOMES_MASCULINOS = [
  'Gabriel','Lucas','Matheus','Pedro','Rafael','Gustavo','Rodrigo','Felipe','Bruno','Diego',
  'Thiago','Eduardo','Leonardo','Henrique','Carlos','André','Victor','Marcelo','João','Paulo',
  'Alexandre','Leandro','Luís','Fabio','Renato','Caio','Fernando','Danilo','Vinícius','Igor',
  'Murilo','Cauã','Bernardo','Samuel','Arthur','Otávio','Luca','Davi','Lorenzo','Miguel',
  'Enzo','Kaique','Kayky','Ryan','Bryan','Kauê','Heitor','Guilherme','Renan','Yago',
  'Raul','Theo','Márcio','Alan','Breno','Cássio','Denis','Érick','Fábio','Gean',
  'Hugo','Ian','Júlio','Kleber','Luan','Marco','Natan','Omar','Patrick','Quirino',
  'Ricardo','Sandro','Tiago','Ubiratan','Wagner','Xavier','Yuri','Zé','Alisson','Robson',
];

const SOBRENOMES = [
  'Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira','Lima','Gomes',
  'Costa','Ribeiro','Martins','Carvalho','Almeida','Lopes','Sousa','Fernandes','Vieira','Barbosa',
  'Rocha','Dias','Nascimento','Andrade','Moreira','Neves','Cavalcanti','Cardoso','Melo','Cunha',
  'Teixeira','Correia','Ramos','Mendes','Fonseca','Castro','Nunes','Freitas','Monteiro','Nogueira',
];

const POSICOES = ['Goleiro','Zagueiro','Lateral','Volante','Meia','Atacante'];
const PERNA_DOMS = ['Direito','Esquerdo','Ambidestro'] as const;

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number, dec = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}
function pickWeighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
  return items[items.length - 1][0];
}

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function setHour(date: Date, h: number, m = 0): Date {
  const d = new Date(date); d.setHours(h, m, 0, 0); return d;
}

/** Gera datas de treino para os últimos `backDays` dias + próximos `fwdDays` dias. */
function trainingDates(weekDays: number[], backDays: number, fwdDays: number): Date[] {
  const dates: Date[] = [];
  const start = daysAgo(backDays);
  const end = daysFromNow(fwdDays);
  const cur = new Date(start);
  while (cur <= end) {
    if (weekDays.includes(cur.getDay())) dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
const TURMA_CONFIGS = [
  { name: 'Sub-11 A', category: 'Sub-11', weekDays: [2, 4], weekDaysText: 'Ter/Qui', schedule: '14:00', startH: 14, endH: 15, cap: 30, count: 28 },
  { name: 'Sub-13 A', category: 'Sub-13', weekDays: [1, 3], weekDaysText: 'Seg/Qua', schedule: '15:00', startH: 15, endH: 17, cap: 32, count: 30 },
  { name: 'Sub-15 B', category: 'Sub-15', weekDays: [2, 4], weekDaysText: 'Ter/Qui', schedule: '16:00', startH: 16, endH: 18, cap: 28, count: 26 },
  { name: 'Sub-17',   category: 'Sub-17', weekDays: [1, 3, 5], weekDaysText: 'Seg/Qua/Sex', schedule: '17:00', startH: 17, endH: 19, cap: 40, count: 35 },
  { name: 'Sub-20',   category: 'Sub-20', weekDays: [2, 4], weekDaysText: 'Ter/Qui', schedule: '19:00', startH: 19, endH: 21, cap: 35, count: 31 },
] as const;

// ────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────

async function main() {
  const passwordHash = await bcrypt.hash('senha123', 10);
  const SLUG = 'acad-sp';

  // ── Reset ──────────────────────────────────────────
  console.log('⏳ Limpando tenant anterior (se existir)…');
  const existing = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) await prisma.tenant.delete({ where: { id: existing.id } });

  // ── Tenant ─────────────────────────────────────────
  console.log('⏳ Criando tenant…');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Academia São Paulo FC',
      slug: SLUG,
      evaluationModel: EvaluationModel.STARS,
      evaluationDimensions: [
        { key: 'participacao', label: 'Participação', order: 0 },
        { key: 'tecnica',      label: 'Técnica',       order: 1 },
        { key: 'fisico',       label: 'Físico',         order: 2 },
        { key: 'tatico',       label: 'Tático',         order: 3 },
        { key: 'atitude',      label: 'Atitude',        order: 4 },
      ],
      defaultFeedbackDimensions: [
        { key: 'intensidade',  label: 'Intensidade',    order: 0 },
        { key: 'cansaco',      label: 'Cansaço',        order: 1 },
        { key: 'satisfacao',   label: 'Satisfação',     order: 2 },
      ],
    },
  });
  const tid = tenant.id;

  // ── Admin ──────────────────────────────────────────
  console.log('⏳ Criando usuários…');
  const admin = await prisma.user.create({
    data: {
      tenantId: tid, email: 'admin@acad-sp.com', passwordHash,
      role: UserRole.ADMIN, fullName: 'Carlos Mendonça',
      termsAcceptedAt: daysAgo(180), termsKinship: 'ADMIN',
    },
  });

  // ── 5 Treinadores + StaffProfiles ──────────────────
  const coachData = [
    { name: 'Roberto Alves',    email: 'roberto@acad-sp.com',  type: ProfessionalType.PROFESSOR,           reg: 'CREF 012345-G/SP' },
    { name: 'Marcelo Rocha',    email: 'marcelo@acad-sp.com',  type: ProfessionalType.PROFESSOR,           reg: 'CREF 023456-G/SP' },
    { name: 'Fernanda Lima',    email: 'fernanda@acad-sp.com', type: ProfessionalType.PROFESSOR,           reg: 'CREF 034567-G/SP' },
    { name: 'André Carvalho',   email: 'andre@acad-sp.com',    type: ProfessionalType.PROFESSOR,           reg: 'CREF 045678-G/SP' },
    { name: 'Patrícia Costa',   email: 'patricia@acad-sp.com', type: ProfessionalType.PROFESSOR,           reg: 'CREF 056789-G/SP' },
    { name: 'Ricardo Braga',    email: 'ricardo@acad-sp.com',  type: ProfessionalType.PREPARADOR_FISICO,   reg: 'CREF 067890-G/SP' },
  ];

  const coaches: { user: any; staff: any }[] = [];
  for (const cd of coachData) {
    const user = await prisma.user.create({
      data: {
        tenantId: tid, email: cd.email, passwordHash,
        role: UserRole.TREINADOR, fullName: cd.name,
        termsAcceptedAt: daysAgo(120), termsKinship: 'TREINADOR',
      },
    });
    const staff = await prisma.staffProfile.create({
      data: { tenantId: tid, userId: user.id, professionalType: cd.type, registry: cd.reg, active: true },
    });
    coaches.push({ user, staff });
  }

  // ── Turmas ─────────────────────────────────────────
  console.log('⏳ Criando turmas…');
  const turmas: any[] = [];
  for (let i = 0; i < TURMA_CONFIGS.length; i++) {
    const cfg = TURMA_CONFIGS[i];
    const t = await prisma.turma.create({
      data: {
        tenantId: tid, name: cfg.name, categoryLabel: cfg.category,
        weekDaysText: cfg.weekDaysText, scheduleText: cfg.schedule,
        location: `Campo ${i + 1} — Arena SP`, capacity: cfg.cap,
        coachUserId: coaches[i].user.id,
        ageRangeText: cfg.category.replace('Sub-', '') + ' anos ou menos',
      },
    });
    turmas.push({ ...t, cfg });
  }

  // ── 150 Alunos + Contas ATLETA + Responsáveis ──────
  console.log('⏳ Criando 150 alunos…');
  const students: any[] = [];
  let studentIdx = 0;

  for (let ti = 0; ti < turmas.length; ti++) {
    const turma = turmas[ti];
    const count = TURMA_CONFIGS[ti].count;

    for (let si = 0; si < count; si++, studentIdx++) {
      const nome = NOMES_MASCULINOS[studentIdx % NOMES_MASCULINOS.length];
      const sobre = SOBRENOMES[(studentIdx * 7 + ti) % SOBRENOMES.length];
      const fullName = `${nome} ${sobre}`;
      const email = `atleta${studentIdx + 1}@acad-sp.com`;

      // Conta ATLETA
      const accountUser = await prisma.user.create({
        data: {
          tenantId: tid, email, passwordHash,
          role: UserRole.ATLETA, fullName,
          termsAcceptedAt: daysAgo(randInt(30, 300)),
          termsKinship: rand(['Pai', 'Mãe', 'Tutor']),
        },
      });

      const anoNasc = 2026 - parseInt(TURMA_CONFIGS[ti].category.replace('Sub-', '')) - randInt(0, 2);
      const isAtivo = studentIdx < 140; // 10 inativos

      const student = await prisma.student.create({
        data: {
          tenantId: tid, fullName, accountUserId: accountUser.id,
          active: isAtivo,
          birthDate: new Date(anoNasc, randInt(0, 11), randInt(1, 28)),
          categoryLabel: TURMA_CONFIGS[ti].category,
          preferredPosition: rand(POSICOES),
          emergencyContact: `(11) 9${randInt(1000,9999)}-${randInt(1000,9999)}`,
          medicalNotes: si % 10 === 0 ? 'Aluno usa óculos durante o treino.' : null,
          physicalRestrictions: si % 15 === 0 ? 'Leve problema no joelho direito — evitar impacto excessivo.' : null,
        },
      });

      // Guardian (responsável)
      const guardiaoNome = `${rand(['Maria','Ana','Paulo','João','Sandra','Cláudia'])} ${sobre}`;
      const guardian = await prisma.guardian.create({
        data: {
          tenantId: tid, fullName: guardiaoNome,
          kinship: rand(['Pai', 'Mãe']),
          phone: `(11) 9${randInt(1000,9999)}-${randInt(1000,9999)}`,
          whatsapp: `(11) 9${randInt(1000,9999)}-${randInt(1000,9999)}`,
          email: `resp${studentIdx + 1}@gmail.com`,
        },
      });

      await prisma.studentGuardian.create({
        data: { tenantId: tid, studentId: student.id, guardianId: guardian.id, isPrimaryForBilling: true },
      });

      // Enrollment
      await prisma.enrollment.create({
        data: { tenantId: tid, studentId: student.id, turmaId: turma.id },
      });

      students.push({ student, accountUser, turmaId: turma.id, turmaIdx: ti });
    }
  }

  // ── Biblioteca de Exercícios ────────────────────────
  console.log('⏳ Criando biblioteca de exercícios…');
  const exercisesData = [
    { name: 'Aquecimento dinâmico', desc: 'Movimentos articulares e corrida leve', sets: 1, reps: null, dur: 600 },
    { name: 'Dribles em cone',       desc: 'Slalom entre cones com bola dominante', sets: 3, reps: 8,    dur: null },
    { name: 'Passe e recepção 2x2',  desc: 'Triangulação curta com pressão', sets: 4, reps: 10,   dur: null },
    { name: 'Chute ao gol',          desc: 'Finalização por zona — esquerda, centro, direita', sets: 3, reps: 6, dur: null },
    { name: 'Jogo reduzido 4x4',     desc: 'Campo reduzido, um toque, ênfase em posicionamento', sets: 2, reps: null, dur: 480 },
    { name: 'Abdominais supra',       desc: '3 séries com 30s descanso', sets: 3, reps: 20, dur: null },
    { name: 'Agachamento com salto',  desc: 'Explosão de membros inferiores', sets: 4, reps: 12, dur: null },
    { name: 'Velocidade em raia',     desc: 'Sprint de 20m com saída parada', sets: 6, reps: 1, dur: null },
    { name: 'Desaquecimento',         desc: 'Caminhada e alongamento estático', sets: 1, reps: null, dur: 300 },
    { name: 'Escada de agilidade',    desc: 'Padrões 1-2-1 e cruzado', sets: 3, reps: 4, dur: null },
  ];

  const libraryItems: any[] = [];
  for (const ex of exercisesData) {
    const item = await prisma.exerciseLibraryItem.create({
      data: {
        tenantId: tid, createdByUserId: admin.id,
        ownerStaffId: coaches[0].staff.id,
        name: ex.name, description: ex.desc,
        defaultSets: ex.sets, defaultRepetitions: ex.reps ?? null,
        defaultDurationSeconds: ex.dur ?? null, defaultRestSeconds: 30,
      },
    });
    libraryItems.push(item);
  }

  // ── Workouts (1 por turma + 1 individual) ──────────
  console.log('⏳ Criando treinos…');
  const workouts: any[] = [];
  const workoutExerciseGroups = [
    [0,1,2,8],   // Sub-11: aquecimento, drible, passe, desaquecimento
    [0,1,3,4,8], // Sub-13: + chute e jogo reduzido
    [0,2,3,4,8], // Sub-15: + passe, chute
    [0,5,6,7,8], // Sub-17: + físico
    [0,1,2,3,9,8], // Sub-20: + escada
  ];

  const feedbackDims = [
    { key: 'intensidade', label: 'Intensidade', order: 0 },
    { key: 'cansaco', label: 'Cansaço', order: 1 },
    { key: 'satisfacao', label: 'Satisfação', order: 2 },
  ];

  for (let ti = 0; ti < turmas.length; ti++) {
    const workout = await prisma.workout.create({
      data: {
        tenantId: tid,
        name: `Treino Padrão — ${TURMA_CONFIGS[ti].name}`,
        description: `Plano semanal da ${TURMA_CONFIGS[ti].name}. Foco: técnica individual e coletiva.`,
        createdByUserId: coaches[ti].user.id,
        ownerStaffId: coaches[ti].staff.id,
        feedbackDimensions: feedbackDims,
      },
    });

    const exGroup = workoutExerciseGroups[ti];
    for (let oi = 0; oi < exGroup.length; oi++) {
      const lib = libraryItems[exGroup[oi]];
      await prisma.workoutExercise.create({
        data: {
          workoutId: workout.id, libraryItemId: lib.id,
          order: oi + 1,
          nameSnapshot: lib.name, descriptionSnapshot: lib.description,
          sets: lib.defaultSets, repetitions: lib.defaultRepetitions,
          durationSeconds: lib.defaultDurationSeconds, restSeconds: 30,
        },
      });
    }

    // Atribuição por turma
    await prisma.workoutAssignment.create({
      data: {
        tenantId: tid, workoutId: workout.id,
        scope: WorkoutAssignmentScope.TURMA, turmaId: turmas[ti].id,
        assignedByUserId: coaches[ti].user.id,
      },
    });

    workouts.push(workout);
  }

  // Atribuição individual extra (3 alunos com workout personalizado)
  for (let i = 0; i < 3; i++) {
    const target = students[i * 15];
    await prisma.workoutAssignment.create({
      data: {
        tenantId: tid, workoutId: workouts[i % workouts.length].id,
        scope: WorkoutAssignmentScope.STUDENT, studentId: target.student.id,
        assignedByUserId: admin.id,
        notes: 'Treino suplementar prescrito individualmente.',
      },
    }).catch(() => {/* ignora se unique já existe */});
  }

  // ── Eventos do calendário (60 dias atrás → 31 dias à frente) ──────────
  console.log('⏳ Criando eventos do calendário…');
  const allEvents: { event: any; turmaId: string; cfg: typeof TURMA_CONFIGS[number] }[] = [];

  for (let ti = 0; ti < turmas.length; ti++) {
    const cfg = TURMA_CONFIGS[ti];
    const dates = trainingDates(cfg.weekDays as unknown as number[], 60, 31);

    for (const date of dates) {
      const startsAt = setHour(date, cfg.startH);
      const endsAt   = setHour(date, cfg.endH);
      const isPast = startsAt < new Date();

      const event = await prisma.calendarEvent.create({
        data: {
          tenantId: tid,
          type: EventType.TREINO,
          title: `Treino ${cfg.name}`,
          startsAt, endsAt,
          location: `Campo ${ti + 1} — Arena SP`,
          status: EventStatus.SCHEDULED,
          isWholeSchool: false,
          createdById: admin.id,
        },
      });
      await prisma.calendarEventTurma.create({
        data: { eventId: event.id, turmaId: turmas[ti].id },
      });
      allEvents.push({ event, turmaId: turmas[ti].id, cfg });
    }
  }

  // Eventos especiais da escola inteira
  const specialEvents = [
    { type: EventType.REUNIAO, title: 'Reunião de pais e responsáveis', daysAgoN: 45, dur: 2 },
    { type: EventType.CAMPEONATO, title: 'Torneio Interno de Verão', daysAgoN: 30, dur: 4 },
    { type: EventType.CAMPEONATO, title: 'Copa Sub-15 Regional', daysAgoN: 14, dur: 5 },
    { type: EventType.EVENTO, title: 'Confraternização da Academia', daysAgoN: 7, dur: 3 },
    { type: EventType.REUNIAO, title: 'Reunião técnica de planejamento', daysFromNowN: 7, dur: 2 },
    { type: EventType.JOGO, title: 'Amistoso vs. Grêmio Osasco', daysFromNowN: 12, dur: 2 },
    { type: EventType.CAMPEONATO, title: 'Campeonato Municipal Sub-17', daysFromNowN: 18, dur: 5 },
    { type: EventType.EVENTO, title: 'Dia da Família na Academia', daysFromNowN: 25, dur: 4 },
    { type: EventType.AVALIACAO, title: 'Avaliação de Desempenho — Ciclo 1', daysFromNowN: 10, dur: 2 },
  ] as const;

  const schoolEvents: any[] = [];
  for (const se of specialEvents) {
    const baseDate = 'daysAgoN' in se ? daysAgo(se.daysAgoN) : daysFromNow(se.daysFromNowN);
    const startsAt = setHour(baseDate, 9);
    const endsAt = setHour(baseDate, 9 + se.dur);
    const ev = await prisma.calendarEvent.create({
      data: {
        tenantId: tid, type: se.type, title: se.title,
        startsAt, endsAt, location: 'Arena SP — Quadra Principal',
        status: EventStatus.SCHEDULED, isWholeSchool: true,
        createdById: admin.id,
      },
    });
    schoolEvents.push(ev);
  }

  // Um evento CANCELADO para testar esse estado
  await prisma.calendarEvent.create({
    data: {
      tenantId: tid, type: EventType.TREINO,
      title: 'Treino Sub-11 A (cancelado)',
      startsAt: setHour(daysAgo(10), 14),
      endsAt: setHour(daysAgo(10), 15),
      status: EventStatus.CANCELLED,
      cancelReason: 'Chuva forte — campo interditado.',
      canceledAt: daysAgo(10),
      canceledById: admin.id,
      isWholeSchool: false,
      createdById: admin.id,
      turmas: { create: { turmaId: turmas[0].id } },
    },
  });

  // ── Presença (eventos passados) ────────────────────
  console.log('⏳ Criando sessões de presença…');
  const pastEvents = allEvents.filter(e => e.event.startsAt < new Date());

  // Perfil de faltas por aluno: 80% normal, 15% frequente, 5% problemático
  const absenceRate: Record<string, number> = {};
  for (const s of students) {
    absenceRate[s.student.id] = pickWeighted([
      [0.05, 20], [0.15, 70], [0.45, 10],
    ]);
  }

  for (const { event, turmaId, cfg } of pastEvents) {
    const session = await prisma.attendanceSession.create({
      data: {
        tenantId: tid, turmaId, eventId: event.id,
        mode: AttendanceMode.MARK_PRESENT,
        finalizedAt: new Date(event.startsAt.getTime() + 2 * 3600_000),
        finalizedById: coaches[TURMA_CONFIGS.findIndex(c => c.name === cfg.name)].user.id,
      },
    });

    const turmaStudents = students.filter(s => s.turmaId === turmaId && s.student.active);
    for (const s of turmaStudents) {
      const rate = absenceRate[s.student.id] ?? 0.15;
      await prisma.attendanceRecord.create({
        data: {
          sessionId: session.id, studentId: s.student.id,
          present: Math.random() > rate,
        },
      });
    }
  }

  // ── Avaliações ─────────────────────────────────────
  console.log('⏳ Criando avaliações…');
  const evalPeriods = [daysAgo(90), daysAgo(60), daysAgo(30)];

  for (const s of students.slice(0, 130)) { // 20 alunos sem avaliação (dashboard alert)
    const coachUser = coaches[s.turmaIdx].user;
    const numEvals = randInt(1, 3);

    for (let ei = 0; ei < numEvals; ei++) {
      const base = randInt(3, 5);
      const scores = {
        participacao: Math.min(5, base + randInt(-1, 1)),
        tecnica:      Math.min(5, base + randInt(-1, 1)),
        fisico:       Math.min(5, base + randInt(-1, 1)),
        tatico:       Math.min(5, base + randInt(-1, 1)),
        atitude:      Math.min(5, base + randInt(-1, 1)),
      };
      const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
      const autoFeedback = avg >= 4 ? 'Excelente desempenho. Aluno em evolução consistente.'
        : avg >= 3 ? 'Bom desempenho. Pontos de melhoria identificados pelo técnico.'
        : 'Necessita atenção especial. Plano de desenvolvimento em andamento.';

      await prisma.evaluation.create({
        data: {
          tenantId: tid, studentId: s.student.id,
          turmaId: s.turmaId, coachUserId: coachUser.id,
          evaluatedAt: evalPeriods[ei % evalPeriods.length],
          scores, autoFeedback,
          comment: ei === 0 ? 'Ótima evolução técnica no último mês.' : null,
        },
      });
    }
  }

  // ── Financeiro ─────────────────────────────────────
  console.log('⏳ Criando cobranças financeiras…');
  const mesValores = [15000, 17000, 18000, 20000]; // R$150–200

  for (const s of students.filter(st => st.student.active)) {
    const valor = rand(mesValores);
    const isInadimplente = Math.random() < 0.15;
    const startMes = isInadimplente ? randInt(0, 2) : 3;

    const meses = [
      { ano: 2026, mes: 2 }, // Fev
      { ano: 2026, mes: 3 }, // Mar
      { ano: 2026, mes: 4 }, // Abr
      { ano: 2026, mes: 5 }, // Mai
    ];

    for (let mi = 0; mi < meses.length; mi++) {
      const { ano, mes } = meses[mi];
      const dueDate = new Date(ano, mes - 1, 10);
      const isAtrasada = isInadimplente && mi >= startMes;
      const isPagoMes = !isAtrasada && mi < 3;

      let status: ChargeStatus;
      let paidAt: Date | null = null;
      let paymentMethod: string | null = null;

      if (isPagoMes) {
        status = ChargeStatus.PAGO;
        paidAt = new Date(ano, mes - 1, randInt(1, 12));
        paymentMethod = rand(['PIX', 'Cartão', 'Boleto', 'Dinheiro']);
      } else if (isAtrasada) {
        status = ChargeStatus.ATRASADO;
      } else {
        status = ChargeStatus.PENDENTE;
      }

      await prisma.financialCharge.create({
        data: {
          tenantId: tid, studentId: s.student.id,
          amountCents: valor, dueDate, status, paidAt, paymentMethod,
          notes: mi === 0 ? 'Mensalidade referência fev/2026' : null,
        },
      });
    }
  }

  // Auditoria financeira (3 cobranças revertidas)
  const chargesForAudit = await prisma.financialCharge.findMany({
    where: { tenantId: tid, status: ChargeStatus.PAGO }, take: 3,
  });
  for (const ch of chargesForAudit) {
    await prisma.financialChargeAudit.create({
      data: {
        tenantId: tid, chargeId: ch.id,
        fromStatus: ChargeStatus.PENDENTE, toStatus: ChargeStatus.PAGO,
        changedById: admin.id, reason: 'Baixa confirmada via PIX.',
      },
    });
  }

  // ── Comunicações ───────────────────────────────────
  console.log('⏳ Criando comunicações…');
  const allAthleteUsers = students.map(s => s.accountUser);

  // GLOBAL
  const globalMsgs = [
    { title: 'Bem-vindos à temporada 2026!', body: 'A Academia SP FC dá as boas-vindas a todos os alunos e famílias. Estamos animados com o novo ciclo.' },
    { title: 'Recesso de Carnaval', body: 'Não haverá treinos nos dias 1 a 4 de março. Voltamos dia 5.' },
    { title: 'Manutenção dos campos', body: 'Os campos 1 e 2 estarão em manutenção na semana de 10 a 14 de abril. Treinos no campo 3.' },
    { title: 'Nova loja de materiais', body: 'Agora você pode adquirir uniformes e bolas diretamente na recepção da academia.' },
    { title: 'Campeonato Municipal — Inscrições abertas', body: 'Estamos inscritos no Campeonato Municipal. Atualizações em breve.' },
  ];

  for (const gm of globalMsgs) {
    const msg = await prisma.communicationMessage.create({
      data: {
        tenantId: tid, scope: CommunicationScope.GLOBAL,
        title: gm.title, body: gm.body, authorUserId: admin.id,
      },
    });
    for (const u of allAthleteUsers.slice(0, 50)) {
      await prisma.communicationRecipient.create({
        data: { messageId: msg.id, userId: u.id, readAt: Math.random() > 0.3 ? daysAgo(randInt(1, 10)) : null },
      });
    }
  }

  // Por TURMA
  for (let ti = 0; ti < turmas.length; ti++) {
    const msg = await prisma.communicationMessage.create({
      data: {
        tenantId: tid, scope: CommunicationScope.TURMA,
        turmaId: turmas[ti].id,
        title: `Comunicado — ${TURMA_CONFIGS[ti].name}`,
        body: `Olá famílias da ${TURMA_CONFIGS[ti].name}. Lembramos que o treino desta semana terá foco em finalização e posicionamento. Tragam water e tênis adequado.`,
        authorUserId: coaches[ti].user.id,
      },
    });
    const turmaAthletes = students.filter(s => s.turmaIdx === ti).map(s => s.accountUser);
    for (const u of turmaAthletes) {
      await prisma.communicationRecipient.create({
        data: { messageId: msg.id, userId: u.id, readAt: Math.random() > 0.4 ? daysAgo(randInt(1, 5)) : null },
      });
    }
  }

  // DIRECT (3 mensagens individuais)
  for (let i = 0; i < 3; i++) {
    const target = students[i * 10];
    await prisma.communicationMessage.create({
      data: {
        tenantId: tid, scope: CommunicationScope.DIRECT,
        title: 'Retorno sobre avaliação',
        body: `Olá! Queríamos dar um retorno pessoal sobre a última avaliação do ${target.student.fullName}. Agende uma conversa com o treinador.`,
        authorUserId: coaches[target.turmaIdx].user.id,
        recipientUserId: target.accountUser.id,
      },
    });
  }

  // ── Relatórios ─────────────────────────────────────
  console.log('⏳ Criando relatórios…');
  const periodStart = new Date(2026, 0, 1); // Jan
  const periodEnd   = new Date(2026, 2, 31); // Mar

  for (let i = 0; i < 30; i++) {
    const s = students[i * 4 % students.length];
    const isPublished = i < 20;
    await prisma.report.create({
      data: {
        tenantId: tid, studentId: s.student.id,
        periodStart, periodEnd,
        title: `Relatório Trimestral — ${s.student.fullName}`,
        summaryText: `${s.student.fullName} demonstrou ${isPublished ? 'excelente' : 'bom'} desenvolvimento no período. Destaque em técnica individual. Foco na próxima etapa: posicionamento tático.`,
        status: isPublished ? ReportStatus.PUBLISHED : ReportStatus.DRAFT,
        publishedAt: isPublished ? daysAgo(randInt(5, 30)) : null,
        createdById: admin.id,
        dataJson: { attendanceRate: randFloat(70, 100), evalAvg: randFloat(3, 5) },
      },
    });
  }

  // ── Planos Individuais ─────────────────────────────
  console.log('⏳ Criando planos individuais…');
  const planTypes = [IndividualPlanType.REFORCO_TECNICO, IndividualPlanType.TRATAMENTO, IndividualPlanType.RECUPERACAO];

  for (let i = 0; i < 10; i++) {
    const s = students[i * 12];
    const tipo = planTypes[i % planTypes.length];
    const staff = coaches[s.turmaIdx];
    const isPublished = i < 7;

    const plan = await prisma.individualPlan.create({
      data: {
        tenantId: tid, studentId: s.student.id,
        assignedProfessionalId: staff.staff.id,
        type: tipo,
        title: `${tipo.replace('_', ' ')} — ${s.student.fullName}`,
        goal: `Desenvolver ${tipo === IndividualPlanType.REFORCO_TECNICO ? 'controle de bola e passe' : 'recuperação e condicionamento'}.`,
        startDate: daysAgo(30),
        endDate: daysFromNow(60),
        weeklyFrequency: 2,
        status: isPublished ? IndividualPlanStatus.PUBLISHED : IndividualPlanStatus.DRAFT,
        publishedAt: isPublished ? daysAgo(25) : null,
        createdById: admin.id,
      },
    });

    // Sessão com exercícios
    const session = await prisma.individualPlanSession.create({
      data: { planId: plan.id, order: 1, title: 'Sessão 1 — Aquecimento e técnica', estimatedDurationMinutes: 60 },
    });
    for (let ei = 0; ei < 3; ei++) {
      const lib = libraryItems[ei];
      await prisma.individualPlanExercise.create({
        data: {
          sessionId: session.id, order: ei + 1,
          name: lib.name, description: lib.description,
          sets: lib.defaultSets, repetitions: lib.defaultRepetitions,
          durationSeconds: lib.defaultDurationSeconds,
        },
      });
    }

    // Auditoria do plano
    await prisma.individualPlanAudit.create({
      data: {
        tenantId: tid, planId: plan.id,
        action: isPublished ? 'PUBLISHED' : 'CREATED',
        previousJson: { status: 'DRAFT' },
        nextJson: { status: isPublished ? 'PUBLISHED' : 'DRAFT' },
        createdById: admin.id,
      },
    });
  }

  // ── CalendarEventFeedback (passado) ───────────────
  console.log('⏳ Criando feedbacks de eventos…');
  const pastSchoolTrainings = pastEvents.slice(0, 30);
  for (const { event, turmaId } of pastSchoolTrainings) {
    const turmaStudents = students.filter(s => s.turmaId === turmaId && s.student.active);
    for (const s of turmaStudents.slice(0, Math.floor(turmaStudents.length * 0.6))) {
      await prisma.calendarEventFeedback.create({
        data: {
          tenantId: tid, eventId: event.id,
          studentId: s.student.id, submittedByUserId: s.accountUser.id,
          scores: { intensidade: randInt(2, 5), cansaco: randInt(2, 5), satisfacao: randInt(3, 5) },
          notes: Math.random() > 0.7 ? 'Treino muito produtivo hoje!' : null,
        },
      }).catch(() => {});
    }
  }

  // ── WorkoutFeedback ────────────────────────────────
  console.log('⏳ Criando feedbacks de treinos…');
  for (let ti = 0; ti < workouts.length; ti++) {
    const workout = workouts[ti];
    const turmaStudents = students.filter(s => s.turmaIdx === ti && s.student.active);
    for (const s of turmaStudents.slice(0, Math.floor(turmaStudents.length * 0.5))) {
      for (let di = 1; di <= 3; di++) {
        await prisma.workoutFeedback.create({
          data: {
            tenantId: tid, workoutId: workout.id,
            studentId: s.student.id, submittedByUserId: s.accountUser.id,
            submittedDate: daysAgo(di * 7),
            scores: { intensidade: randInt(2, 5), cansaco: randInt(1, 5), satisfacao: randInt(3, 5) },
          },
        }).catch(() => {});
      }
    }
  }

  // ── Media Assets ───────────────────────────────────
  console.log('⏳ Criando mídia…');
  for (let i = 0; i < 20; i++) {
    const turmaIdx = i % turmas.length;
    const asset = await prisma.mediaAsset.create({
      data: {
        tenantId: tid,
        storageKey: `tenant/${tid}/media/foto-treino-${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: randInt(200_000, 2_000_000),
        turmaId: turmas[turmaIdx].id,
        thumbnailKey: `tenant/${tid}/media/thumb-treino-${i + 1}.jpg`,
        uploadedById: coaches[turmaIdx].user.id,
      },
    });
    // Tag 2-3 alunos por foto
    const tagged = students.filter(s => s.turmaIdx === turmaIdx).slice(i % 5, (i % 5) + 3);
    for (const s of tagged) {
      await prisma.mediaTagStudent.create({
        data: { mediaId: asset.id, studentId: s.student.id },
      }).catch(() => {});
    }
  }

  // ── Notificações ───────────────────────────────────
  console.log('⏳ Criando notificações…');
  const notifTemplates = [
    { type: 'COBRANCA_VENCIDA', title: 'Mensalidade em atraso', body: 'Há uma mensalidade em atraso. Regularize para manter o acesso.' },
    { type: 'NOVO_RELATORIO',   title: 'Relatório publicado',   body: 'O relatório trimestral do seu filho foi publicado.' },
    { type: 'COMUNICADO',       title: 'Novo comunicado',       body: 'Há um novo comunicado da academia para você.' },
    { type: 'AVALIACAO',        title: 'Avaliação registrada',  body: 'Uma nova avaliação foi registrada para o seu filho.' },
  ];

  for (const s of students.slice(0, 50)) {
    const tmpl = notifTemplates[randInt(0, notifTemplates.length - 1)];
    await prisma.notification.create({
      data: {
        tenantId: tid, userId: s.accountUser.id,
        type: tmpl.type, title: tmpl.title, body: tmpl.body,
        readAt: Math.random() > 0.4 ? daysAgo(randInt(1, 14)) : null,
        dedupeKey: `${tmpl.type}-${s.student.id}-2026-05`,
      },
    }).catch(() => {});
  }
  // Admin também recebe algumas
  for (let i = 0; i < 5; i++) {
    await prisma.notification.create({
      data: {
        tenantId: tid, userId: admin.id,
        type: 'INADIMPLENCIA_ALERTA',
        title: `${randInt(10, 20)} cobranças vencidas`, body: 'Clique para ver o relatório de inadimplência.',
        dedupeKey: `INADIMPLENCIA_ALERTA-admin-2026-05-${i}`,
      },
    }).catch(() => {});
  }

  // ────────────────────────────────────────────────────────
  console.log('\n✅ Seed "acad-sp" concluído!\n');
  console.log('─────────────────────────────────────────────────────');
  console.log('Tenant:  Academia São Paulo FC  (slug: acad-sp)');
  console.log('Senha:   senha123  (todos os usuários)');
  console.log('─────────────────────────────────────────────────────');
  console.log('Logins:');
  console.log('  admin@acad-sp.com   → ADMIN');
  console.log('  roberto@acad-sp.com → TREINADOR (Sub-11 A)');
  console.log('  marcelo@acad-sp.com → TREINADOR (Sub-13 A)');
  console.log('  fernanda@acad-sp.com→ TREINADOR (Sub-15 B)');
  console.log('  andre@acad-sp.com   → TREINADOR (Sub-17)');
  console.log('  patricia@acad-sp.com→ TREINADOR (Sub-20)');
  console.log('  ricardo@acad-sp.com → PREPARADOR FÍSICO');
  console.log('  atleta1@acad-sp.com → ATLETA  (até atleta150@acad-sp.com)');
  console.log('─────────────────────────────────────────────────────');
  console.log(`Alunos:      150 (140 ativos, 10 inativos)`);
  console.log(`Turmas:      5`);
  console.log(`Eventos:     ~${allEvents.length + schoolEvents.length + 1} (passados + futuros + 1 cancelado)`);
  console.log(`Cobranças:   ~${students.filter(s => s.student.active).length * 4} (4 meses × aluno ativo)`);
  console.log(`Avaliações:  para 130 alunos, 20 sem avaliação recente`);
  console.log('─────────────────────────────────────────────────────\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
