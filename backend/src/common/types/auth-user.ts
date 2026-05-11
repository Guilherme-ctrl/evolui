import { UserRole } from '@prisma/client';

/**
 * Usuário autenticado vindo do JWT, com o aluno ativo opcional anexado pelo
 * `@CurrentUser()` a partir do header `X-Active-Student-Id`. O `activeStudentId`
 * não é validado contra o banco aqui — quem precisar usar deve chamar
 * `resolveActiveStudent(prisma, user)` (athlete-scope) para garantir
 * pertencimento à conta.
 */
export type AuthUser = {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  /** Aluno ativo na sessão. Só preenchido quando o header está presente. */
  activeStudentId?: string;
};
