import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista contas-atleta ativas do tenant — usado pelo admin no select de "conta existente". */
  listAtletas(user: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        role: UserRole.ATLETA,
        active: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStudents: {
          select: { id: true, fullName: true },
          orderBy: { fullName: 'asc' },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }
}
