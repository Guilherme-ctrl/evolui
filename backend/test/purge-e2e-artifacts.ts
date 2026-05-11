import type { PrismaClient } from '@prisma/client';

/**
 * Política de purge — versão CONSERVADORA: nada criado fora dos testes e2e é
 * apagado. O reconhecimento se dá por **padrões usados pelos próprios testes**:
 *
 *   - User       : `email` começa com `e2e-` OU termina com `@demo.test`
 *                  (ex.: `buildStudentPayload` em `e2e-db-cleanup.ts` gera
 *                   `e2e-<prefix>-<ts>-<rand>@demo.test`).
 *   - Conteúdos  : Workout / IndividualPlan / CalendarEvent / Turma / Guardian
 *                  / ExerciseLibraryItem etc. são apagados quando o `name`,
 *                  `title` ou autor (`createdByUserId`/`coachUserId`/etc.)
 *                  cair em algo claramente de teste.
 *   - Dependentes: Notification, CommunicationMessage, FinancialCharge,
 *                  Report, Evaluation, AttendanceSession são apagados
 *                  somente se referenciam Users/Students/Turmas que já foram
 *                  identificadas como de teste; ou se o próprio campo de
 *                  texto/dedupeKey casa com prefixo `e2e-`.
 *
 * Resultado: dados criados manualmente (ex.: aluno cadastrado pela UI durante
 * desenvolvimento) ficam intactos. O purge é idempotente.
 */
export async function purgeE2eArtifacts(prisma: PrismaClient): Promise<{
  deleted: Record<string, number>;
}> {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: ['demo', 'other'] } },
    select: { id: true },
  });
  const tenantIds = tenants.map((t) => t.id);
  if (!tenantIds.length) return { deleted: {} };

  // 1) Identifica todos os Users de teste (padrão claro de email).
  const testUsers = await prisma.user.findMany({
    where: {
      tenantId: { in: tenantIds },
      OR: [
        { email: { startsWith: 'e2e-' } },
        { email: { endsWith: '@demo.test' } },
      ],
    },
    select: { id: true, email: true },
  });
  const testUserIds = testUsers.map((u) => u.id);

  // 2) Students de teste = (a) accountUser é de teste OR (b) nome com prefixo `e2e-`.
  const testStudents = await prisma.student.findMany({
    where: {
      tenantId: { in: tenantIds },
      OR: [
        testUserIds.length ? { accountUserId: { in: testUserIds } } : { id: '__never__' },
        { fullName: { startsWith: 'e2e-' } },
      ],
    },
    select: { id: true },
  });
  const testStudentIds = testStudents.map((s) => s.id);

  // 3) Turmas de teste = coach é de teste OR nome com prefixo `e2e-`.
  const testTurmas = await prisma.turma.findMany({
    where: {
      tenantId: { in: tenantIds },
      OR: [
        testUserIds.length ? { coachUserId: { in: testUserIds } } : { id: '__never__' },
        { name: { startsWith: 'e2e-' } },
      ],
    },
    select: { id: true },
  });
  const testTurmaIds = testTurmas.map((t) => t.id);

  const deleted: Record<string, number> = {};
  const run = async (label: string, fn: () => Promise<{ count: number }>) => {
    try {
      const r = await fn();
      if (r.count) deleted[label] = r.count;
    } catch (e) {
      deleted[`${label}!error`] = -1;
      // eslint-disable-next-line no-console
      console.warn(`[purge-e2e] ${label}:`, (e as Error).message);
    }
  };

  // Helpers de filtro
  const inTestUsers = testUserIds.length
    ? { userId: { in: testUserIds } }
    : { id: '__never__' };
  const inTestStudents = testStudentIds.length
    ? { studentId: { in: testStudentIds } }
    : { id: '__never__' };
  const inTestTurmas = testTurmaIds.length
    ? { turmaId: { in: testTurmaIds } }
    : { id: '__never__' };

  // Tudo o que claramente é de teste (prefixo `e2e-` em nome/título) também sai,
  // mesmo que não esteja ligado aos Users/Students/Turmas acima.

  // 4) Folhas dependentes ligadas a User/Student/Turma de teste.
  await run('notification', () =>
    prisma.notification.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          inTestUsers,
          { dedupeKey: { startsWith: 'e2e-' } },
          { title: { startsWith: 'e2e-' } },
        ],
      },
    }),
  );
  await run('financialCharge', () =>
    prisma.financialCharge.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [inTestStudents, { notes: { startsWith: 'e2e-' } }],
      },
    }),
  );
  await run('communicationMessage', () =>
    prisma.communicationMessage.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          inTestTurmas,
          testUserIds.length ? { authorUserId: { in: testUserIds } } : { id: '__never__' },
          { title: { startsWith: 'e2e-' } },
        ],
      },
    }),
  );
  await run('report', () =>
    prisma.report.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [inTestStudents, { title: { startsWith: 'e2e-' } }],
      },
    }),
  );
  await run('mediaAsset', () =>
    prisma.mediaAsset.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          inTestTurmas,
          testUserIds.length ? { uploadedById: { in: testUserIds } } : { id: '__never__' },
        ],
      },
    }),
  );
  await run('evaluation', () =>
    prisma.evaluation.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [inTestStudents, inTestTurmas],
      },
    }),
  );
  await run('attendanceSession', () =>
    prisma.attendanceSession.deleteMany({
      where: { tenantId: { in: tenantIds }, ...inTestTurmas },
    }),
  );

  // 5) Workouts / IndividualPlans criados por testes.
  await run('workout', () =>
    prisma.workout.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          testUserIds.length ? { createdByUserId: { in: testUserIds } } : { id: '__never__' },
          { name: { startsWith: 'e2e-' } },
        ],
      },
    }),
  );
  await run('individualPlan', () =>
    prisma.individualPlan.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          inTestStudents,
          { title: { startsWith: 'e2e-' } },
        ],
      },
    }),
  );

  // 6) Itens da biblioteca: padrão `e2e-` no nome ou autor de teste.
  await run('exerciseLibraryItem', () =>
    prisma.exerciseLibraryItem.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          testUserIds.length ? { createdByUserId: { in: testUserIds } } : { id: '__never__' },
          { name: { startsWith: 'e2e-' } },
        ],
      },
    }),
  );

  // 7) Calendar events com título `e2e-` (cascade audits/joins).
  await run('calendarEvent', () =>
    prisma.calendarEvent.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          { title: { startsWith: 'e2e-' } },
          testUserIds.length ? { createdById: { in: testUserIds } } : { id: '__never__' },
        ],
      },
    }),
  );

  // 8) StudentGuardian / Enrollment dependentes de Student/Turma de teste.
  await run('studentGuardian', () =>
    prisma.studentGuardian.deleteMany({
      where: { tenantId: { in: tenantIds }, ...inTestStudents },
    }),
  );
  await run('enrollment', () =>
    prisma.enrollment.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [inTestStudents, inTestTurmas],
      },
    }),
  );

  // 9) Audits do Student (caso o Student original já tenha sumido).
  await run('studentDeletionAudit', () =>
    prisma.studentDeletionAudit.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          inTestStudents,
          { fullNameSnapshot: { startsWith: 'e2e-' } },
        ],
      },
    }),
  );
  await run('studentHealthAudit', () =>
    prisma.studentHealthAudit.deleteMany({
      where: { tenantId: { in: tenantIds }, ...inTestStudents },
    }),
  );

  // 10) Student de teste.
  if (testStudentIds.length) {
    await run('student', () =>
      prisma.student.deleteMany({ where: { id: { in: testStudentIds } } }),
    );
  }

  // 11) Guardian de teste (nome `e2e-` ou só ligado a Student que já saiu — re-check).
  await run('guardian', () =>
    prisma.guardian.deleteMany({
      where: {
        tenantId: { in: tenantIds },
        OR: [
          { fullName: { startsWith: 'e2e-' } },
          { email: { endsWith: '@demo.test' } },
        ],
      },
    }),
  );

  // 12) Turma de teste.
  if (testTurmaIds.length) {
    await run('turma', () =>
      prisma.turma.deleteMany({ where: { id: { in: testTurmaIds } } }),
    );
  }

  // 13) StaffProfile de User de teste (Cascade pelo User também resolveria).
  await run('staffProfile', () =>
    prisma.staffProfile.deleteMany({
      where: { tenantId: { in: tenantIds }, ...inTestUsers },
    }),
  );

  // 14) NotificationPreference de User de teste.
  await run('notificationPreference', () =>
    prisma.notificationPreference.deleteMany({
      where: { tenantId: { in: tenantIds }, ...inTestUsers },
    }),
  );

  // 15) User de teste por fim (todos os Restrict acima já foram resolvidos).
  if (testUserIds.length) {
    await run('user', () =>
      prisma.user.deleteMany({ where: { id: { in: testUserIds } } }),
    );
  }

  return { deleted };
}
