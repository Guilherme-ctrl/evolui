import { ForbiddenException } from '@nestjs/common';
import { ProfessionalType, UserRole } from '@prisma/client';
import { StaffService } from './staff.service';

describe('StaffService', () => {
  it('create nega TREINADOR (apenas ADMIN)', async () => {
    const prisma = {} as never;
    const svc = new StaffService(prisma);
    const coach = {
      sub: 'u1',
      tenantId: 't1',
      role: UserRole.TREINADOR,
      email: 'c@x.com',
    };
    await expect(
      svc.create(coach, {
        email: 'p@x.com',
        password: 'secret12',
        fullName: 'Prof',
        professionalType: ProfessionalType.PROFESSOR,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
