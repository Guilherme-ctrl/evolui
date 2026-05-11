import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../types/auth-user';

/**
 * Lista os alunos cuja conta de login (`accountUserId`) é este `User`.
 * Para qualquer role diferente de `ATLETA` devolve lista vazia — esse helper
 * é o substituto direto do antigo `studentIdsVisibleToResponsavelUser`.
 */
export async function studentIdsForAccountUser(
  prisma: PrismaService,
  user: AuthUser,
): Promise<string[]> {
  if (user.role !== UserRole.ATLETA) return [];
  const rows = await prisma.student.findMany({
    where: { tenantId: user.tenantId, accountUserId: user.sub },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** True quando `studentId` pertence à conta-atleta logada (mesmo tenant). */
export async function isAccountOfStudent(
  prisma: PrismaService,
  user: AuthUser,
  studentId: string,
): Promise<boolean> {
  if (user.role !== UserRole.ATLETA) return false;
  const s = await prisma.student.findFirst({
    where: { id: studentId, tenantId: user.tenantId, accountUserId: user.sub },
    select: { id: true },
  });
  return !!s;
}

/**
 * Resolve o aluno ativo da sessão (vindo do header `X-Active-Student-Id`,
 * propagado por `@CurrentUser()`).
 *
 * - `ADMIN` / `TREINADOR`: devolve `null` (não usa switcher).
 * - `ATLETA` sem header + `required=true` (default): 400 com mensagem clara.
 * - `ATLETA` com header que não pertence à conta: 403.
 */
export async function resolveActiveStudent(
  prisma: PrismaService,
  user: AuthUser,
  options: { required?: boolean } = {},
): Promise<string | null> {
  if (user.role !== UserRole.ATLETA) return null;
  const required = options.required ?? true;
  const sid = user.activeStudentId;
  if (!sid) {
    if (!required) return null;
    throw new BadRequestException(
      'Selecione um aluno: envie o header X-Active-Student-Id.',
    );
  }
  const ok = await isAccountOfStudent(prisma, user, sid);
  if (!ok) throw new ForbiddenException('Aluno fora do escopo desta conta.');
  return sid;
}
