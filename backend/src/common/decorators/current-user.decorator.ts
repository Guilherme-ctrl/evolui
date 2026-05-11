import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../types/auth-user';

const ACTIVE_STUDENT_HEADER = 'x-active-student-id';

function firstStringHeader(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
  }
  return undefined;
}

/**
 * Injeta o `AuthUser` validado pelo `JwtAuthGuard` e mescla `activeStudentId`
 * vindo do header `X-Active-Student-Id` (quando enviado). A validação de
 * pertencimento do aluno à conta acontece via `athlete-scope.resolveActiveStudent`
 * nos serviços que dependem do aluno ativo.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    const user = req.user;
    if (!user) return user;
    const activeStudentId = firstStringHeader(req.headers[ACTIVE_STUDENT_HEADER]);
    return activeStudentId ? { ...user, activeStudentId } : user;
  },
);
