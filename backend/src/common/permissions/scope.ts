import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../types/auth-user';
import { isAccountOfStudent } from './athlete-scope';

export async function ensureStudentInTenant(
  prisma: PrismaService,
  tenantId: string,
  studentId: string,
) {
  const s = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
  });
  if (!s) throw new NotFoundException('Aluno não encontrado');
  return s;
}

export async function ensureCanReadStudent(
  prisma: PrismaService,
  user: AuthUser,
  studentId: string,
) {
  const s = await ensureStudentInTenant(prisma, user.tenantId, studentId);
  if (user.role === UserRole.ADMIN) return s;
  if (user.role === UserRole.TREINADOR) {
    const turmaIds = await listTurmaIdsForCoach(prisma, user);
    if (!turmaIds?.length) throw new ForbiddenException();
    const enr = await prisma.enrollment.findFirst({
      where: { studentId, tenantId: user.tenantId, turmaId: { in: turmaIds } },
    });
    if (!enr) throw new ForbiddenException();
    return s;
  }
  if (user.role === UserRole.ATLETA) {
    const ok = await isAccountOfStudent(prisma, user, studentId);
    if (!ok) throw new ForbiddenException();
    return s;
  }
  throw new ForbiddenException();
}

export async function ensureCoachTurma(
  prisma: PrismaService,
  user: AuthUser,
  turmaId: string,
) {
  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, tenantId: user.tenantId },
  });
  if (!turma) throw new NotFoundException('Turma não encontrada');
  if (user.role === UserRole.ADMIN) return turma;
  if (user.role !== UserRole.TREINADOR) throw new ForbiddenException();
  if (turma.coachUserId !== user.sub) throw new ForbiddenException();
  return turma;
}

export async function listTurmaIdsForCoach(
  prisma: PrismaService,
  user: AuthUser,
): Promise<string[] | null> {
  if (user.role === UserRole.ADMIN) return null;
  if (user.role !== UserRole.TREINADOR) return [];
  const turmas = await prisma.turma.findMany({
    where: { tenantId: user.tenantId, coachUserId: user.sub },
    select: { id: true },
  });
  return turmas.map((t) => t.id);
}
