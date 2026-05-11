import { UserRole } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

const DEMO_SLUG = 'demo';

/** Remove aluno do tenant demo e dependências em cascata (Prisma). */
export async function deleteDemoStudent(
  prisma: PrismaService,
  studentId: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!tenant) return;
  await prisma.student.deleteMany({
    where: { id: studentId, tenantId: tenant.id },
  });
}

export async function deleteDemoTurma(prisma: PrismaService, turmaId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!tenant) return;
  await prisma.turma.deleteMany({
    where: { id: turmaId, tenantId: tenant.id },
  });
}

export async function deleteDemoGuardian(
  prisma: PrismaService,
  guardianId: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!tenant) return;
  await prisma.guardian.deleteMany({
    where: { id: guardianId, tenantId: tenant.id },
  });
}

export async function deleteDemoUserCoach(
  prisma: PrismaService,
  userId: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!tenant) return;
  await prisma.user.deleteMany({
    where: { id: userId, tenantId: tenant.id, role: UserRole.TREINADOR },
  });
}

export async function deleteFinancialChargesByIds(
  prisma: PrismaService,
  ids: string[],
) {
  if (!ids.length) return;
  await prisma.financialCharge.deleteMany({ where: { id: { in: ids } } });
}

export async function deleteFinancialChargeWithAudits(
  prisma: PrismaService,
  chargeId: string,
) {
  await prisma.financialCharge.deleteMany({ where: { id: chargeId } });
}

export async function deleteCommunicationMessagesByIds(
  prisma: PrismaService,
  ids: string[],
) {
  if (!ids.length) return;
  await prisma.communicationMessage.deleteMany({ where: { id: { in: ids } } });
}

export async function deleteNotificationsByDedupeKeys(
  prisma: PrismaService,
  keys: string[],
) {
  if (!keys.length) return;
  await prisma.notification.deleteMany({ where: { dedupeKey: { in: keys } } });
}

export async function deleteReportById(
  prisma: PrismaService,
  reportId: string,
) {
  await prisma.report.deleteMany({ where: { id: reportId } });
}

export async function deleteCalendarEventCascade(
  prisma: PrismaService,
  eventId: string,
) {
  await prisma.calendarEvent.deleteMany({ where: { id: eventId } });
}

/**
 * Gera payload válido para criar um aluno via API após a refator ATLETA:
 * todo aluno precisa de uma conta-atleta (email/senha) ou de um accountUserId.
 * Use junto com `deleteDemoAccountByEmail` no afterEach/finally.
 */
export function buildStudentPayload(input: {
  fullName: string;
  active?: boolean;
  emailPrefix?: string;
}): {
  fullName: string;
  active?: boolean;
  accountEmail: string;
  accountPassword: string;
} {
  const prefix = (input.emailPrefix ?? 'e2e-atleta').replace(/[^a-z0-9-]/gi, '');
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@demo.test`;
  return {
    fullName: input.fullName,
    ...(input.active !== undefined ? { active: input.active } : {}),
    accountEmail: email,
    accountPassword: 'senha123',
  };
}

/** Remove conta-atleta criada automaticamente pelos e2e (por padrão de e-mail). */
export async function deleteDemoAccountByEmail(
  prisma: PrismaService,
  email: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!tenant) return;
  await prisma.user.deleteMany({
    where: { tenantId: tenant.id, email, role: UserRole.ATLETA },
  });
}
