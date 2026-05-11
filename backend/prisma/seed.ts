import {
  AttendanceMode,
  ChargeStatus,
  EventStatus,
  EventType,
  EvaluationModel,
  PrismaClient,
  ProfessionalType,
  StudentDocumentType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('senha123', 10);

  await prisma.tenant.upsert({
    where: { slug: 'demo' },
    create: {
      name: 'Escolinha Demo',
      slug: 'demo',
      evaluationModel: EvaluationModel.STARS,
      evaluationDimensions: [
        { key: 'participacao', label: 'Participação', order: 0 },
        { key: 'disciplina', label: 'Disciplina', order: 1 },
      ],
    },
    update: {},
  });

  await prisma.tenant.upsert({
    where: { slug: 'other' },
    create: {
      name: 'Outra Escolinha',
      slug: 'other',
      evaluationModel: EvaluationModel.STARS,
      evaluationDimensions: [],
    },
    update: {},
  });

  const demo = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
  const other = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'other' } });

  const adminDemo = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'admin@demo.com' } },
    create: {
      tenantId: demo.id,
      email: 'admin@demo.com',
      passwordHash,
      role: UserRole.ADMIN,
      fullName: 'Admin Demo',
      termsAcceptedAt: new Date(),
      termsKinship: 'ADMIN',
    },
    update: { passwordHash },
  });

  const coachDemo = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'coach@demo.com' } },
    create: {
      tenantId: demo.id,
      email: 'coach@demo.com',
      passwordHash,
      role: UserRole.TREINADOR,
      fullName: 'Treinador Demo',
      termsAcceptedAt: new Date(),
      termsKinship: 'TREINADOR',
    },
    update: { passwordHash },
  });

  // Conta-atleta principal (1 aluno, conta dedicada). Usa o email histórico
  // `pai@demo.com` porque o aceite inicial dos termos foi feito por um adulto
  // (RN-201) — o mesmo email serve para a conta-atleta que opera o app.
  const atletaDemoUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'pai@demo.com' } },
    create: {
      tenantId: demo.id,
      email: 'pai@demo.com',
      passwordHash,
      role: UserRole.ATLETA,
      fullName: 'Atleta Demo',
      termsAcceptedAt: new Date(),
      termsKinship: 'Pai',
    },
    update: { passwordHash },
  });

  // Conta-família (mesma conta para 2 alunos — demonstra switcher)
  const familiaUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'familia@demo.com' } },
    create: {
      tenantId: demo.id,
      email: 'familia@demo.com',
      passwordHash,
      role: UserRole.ATLETA,
      fullName: 'Família Demo',
    },
    update: { passwordHash },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: other.id, email: 'admin@other.com' } },
    create: {
      tenantId: other.id,
      email: 'admin@other.com',
      passwordHash,
      role: UserRole.ADMIN,
      fullName: 'Admin Other',
      termsAcceptedAt: new Date(),
      termsKinship: 'ADMIN',
    },
    update: { passwordHash },
  });

  const coachOther = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: other.id, email: 'coach@other.com' },
    },
    create: {
      tenantId: other.id,
      email: 'coach@other.com',
      passwordHash,
      role: UserRole.TREINADOR,
      fullName: 'Treinador Other',
      termsAcceptedAt: new Date(),
      termsKinship: 'TREINADOR',
    },
    update: { passwordHash },
  });

  // Guardian "Pai Demo" — apenas contato (sem login). Vinculado a Atleta Demo
  // via StudentGuardian com isPrimaryForBilling=true (cobrança fora do app).
  const guardian = await prisma.guardian.upsert({
    where: { id: 'seed_guardian_demo' },
    create: {
      id: 'seed_guardian_demo',
      tenantId: demo.id,
      fullName: 'Pai Demo',
      email: 'pai-contato@demo.com',
      phone: '11999990000',
      whatsapp: '11999990000',
      kinship: 'Pai',
    },
    update: {},
  });

  const atletaDemo = await prisma.student.upsert({
    where: { id: 'seed_student_demo' },
    create: {
      id: 'seed_student_demo',
      tenantId: demo.id,
      fullName: 'Atleta Demo',
      birthDate: new Date('2015-06-01'),
      categoryLabel: 'Sub 10',
      documentType: StudentDocumentType.CPF,
      documentNumber: '39053344705',
      active: true,
      accountUserId: atletaDemoUser.id,
    },
    update: {
      documentType: StudentDocumentType.CPF,
      documentNumber: '39053344705',
      accountUserId: atletaDemoUser.id,
    },
  });

  // Aluno sem família compartilhada — atende ao seu próprio app (modelo padrão)
  // Reusa atletaDemoUser não é coerente; demos um próprio.
  const atletaSemVinculoUser = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: demo.id, email: 'sem-vinculo@demo.com' },
    },
    create: {
      tenantId: demo.id,
      email: 'sem-vinculo@demo.com',
      passwordHash,
      role: UserRole.ATLETA,
      fullName: 'Atleta Sem Vínculo',
    },
    update: { passwordHash },
  });

  await prisma.student.upsert({
    where: { id: 'seed_student_no_guardian' },
    create: {
      id: 'seed_student_no_guardian',
      tenantId: demo.id,
      fullName: 'Atleta Sem Vínculo',
      active: true,
      accountUserId: atletaSemVinculoUser.id,
    },
    update: { accountUserId: atletaSemVinculoUser.id },
  });

  // Dois irmãos compartilhando a mesma conta familia@demo.com — demonstra switcher
  await prisma.student.upsert({
    where: { id: 'seed_student_familia_a' },
    create: {
      id: 'seed_student_familia_a',
      tenantId: demo.id,
      fullName: 'Filho A',
      birthDate: new Date('2014-03-10'),
      categoryLabel: 'Sub 12',
      active: true,
      accountUserId: familiaUser.id,
    },
    update: { accountUserId: familiaUser.id },
  });

  await prisma.student.upsert({
    where: { id: 'seed_student_familia_b' },
    create: {
      id: 'seed_student_familia_b',
      tenantId: demo.id,
      fullName: 'Filho B',
      birthDate: new Date('2016-08-22'),
      categoryLabel: 'Sub 10',
      active: true,
      accountUserId: familiaUser.id,
    },
    update: { accountUserId: familiaUser.id },
  });

  await prisma.studentGuardian.upsert({
    where: {
      studentId_guardianId: {
        studentId: atletaDemo.id,
        guardianId: guardian.id,
      },
    },
    create: {
      id: 'seed_sg_demo',
      tenantId: demo.id,
      studentId: atletaDemo.id,
      guardianId: guardian.id,
      isPrimaryForBilling: true,
    },
    update: {},
  });

  const turma = await prisma.turma.upsert({
    where: { id: 'seed_turma_demo' },
    create: {
      id: 'seed_turma_demo',
      tenantId: demo.id,
      name: 'Turma Manhã',
      weekDaysText: 'Sáb',
      scheduleText: '09:00',
      location: 'Campo Demo',
      capacity: 20,
      coachUserId: coachDemo.id,
      categoryLabel: 'Sub 10',
    },
    update: { coachUserId: coachDemo.id },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_turmaId: { studentId: atletaDemo.id, turmaId: turma.id },
    },
    create: {
      id: 'seed_enr_demo',
      tenantId: demo.id,
      studentId: atletaDemo.id,
      turmaId: turma.id,
    },
    update: {},
  });

  const profDemoUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'prof@demo.com' } },
    create: {
      tenantId: demo.id,
      email: 'prof@demo.com',
      passwordHash,
      role: UserRole.TREINADOR,
      fullName: 'Professor Demo',
      termsAcceptedAt: new Date(),
      termsKinship: 'TREINADOR',
    },
    update: { passwordHash },
  });

  await prisma.staffProfile.upsert({
    where: { userId: profDemoUser.id },
    create: {
      tenantId: demo.id,
      userId: profDemoUser.id,
      professionalType: ProfessionalType.PROFESSOR,
      registry: 'CREF 000000',
      active: true,
    },
    update: { active: true, professionalType: ProfessionalType.PROFESSOR },
  });

  const turmaProf = await prisma.turma.upsert({
    where: { id: 'seed_turma_prof' },
    create: {
      id: 'seed_turma_prof',
      tenantId: demo.id,
      name: 'Turma Professor',
      weekDaysText: 'Dom',
      scheduleText: '10:00',
      location: 'Campo Demo',
      capacity: 20,
      coachUserId: profDemoUser.id,
      categoryLabel: 'Sub 10',
    },
    update: { coachUserId: profDemoUser.id },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_turmaId: { studentId: atletaDemo.id, turmaId: turmaProf.id },
    },
    create: {
      id: 'seed_enr_prof',
      tenantId: demo.id,
      studentId: atletaDemo.id,
      turmaId: turmaProf.id,
    },
    update: {},
  });

  const turmaOther = await prisma.turma.upsert({
    where: { id: 'seed_turma_other' },
    create: {
      id: 'seed_turma_other',
      tenantId: other.id,
      name: 'Turma Other',
      capacity: 15,
      coachUserId: coachOther.id,
    },
    update: {},
  });

  const event = await prisma.calendarEvent.upsert({
    where: { id: 'seed_event_demo' },
    create: {
      id: 'seed_event_demo',
      tenantId: demo.id,
      type: EventType.TREINO,
      title: 'Treino de sábado',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 86400000 + 3600000),
      location: 'Campo Demo',
      status: EventStatus.SCHEDULED,
      isWholeSchool: false,
      createdById: adminDemo.id,
    },
    update: {},
  });

  await prisma.calendarEventTurma.upsert({
    where: {
      eventId_turmaId: { eventId: event.id, turmaId: turma.id },
    },
    create: { eventId: event.id, turmaId: turma.id },
    update: {},
  });

  await prisma.attendanceSession.upsert({
    where: {
      turmaId_eventId: { turmaId: turma.id, eventId: event.id },
    },
    create: {
      id: 'seed_att_sess',
      tenantId: demo.id,
      turmaId: turma.id,
      eventId: event.id,
      mode: AttendanceMode.MARK_PRESENT,
    },
    update: {},
  });

  await prisma.financialCharge.upsert({
    where: { id: 'seed_charge_demo' },
    create: {
      id: 'seed_charge_demo',
      tenantId: demo.id,
      studentId: atletaDemo.id,
      amountCents: 15000,
      dueDate: new Date(),
      status: ChargeStatus.PENDENTE,
    },
    update: {},
  });

  console.log('Seed OK — tenants: demo, other | senha: senha123');
  console.log('Logins demo:');
  console.log('  admin@demo.com / senha123  (ADMIN)');
  console.log('  coach@demo.com / senha123  (TREINADOR)');
  console.log('  prof@demo.com / senha123   (TREINADOR + StaffProfile PROFESSOR)');
  console.log('  pai@demo.com / senha123 (ATLETA — 1 aluno: Atleta Demo)');
  console.log('  familia@demo.com / senha123 (ATLETA — 2 alunos: Filho A, Filho B → switcher)');
  console.log('Turma other (isolamento):', turmaOther.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
