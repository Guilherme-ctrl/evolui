import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';

/**
 * Guardian = contato responsável (pai/mãe/tutor) usado para cobrança e
 * canais externos (e-mail/SMS/WhatsApp). Quem opera o app é a conta-atleta
 * (`Student.accountUser`), nunca o Guardian — ele não tem login.
 */
@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
  }

  async list(user: AuthUser, cursor?: string, take = 40) {
    this.ensureAdmin(user);
    const cap = Math.min(take, 100);
    return this.prisma.guardian.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { fullName: 'asc' },
      take: cap + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async get(user: AuthUser, id: string) {
    this.ensureAdmin(user);
    const g = await this.prisma.guardian.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { students: { include: { student: true } } },
    });
    if (!g) throw new NotFoundException();
    return g;
  }

  async create(user: AuthUser, dto: CreateGuardianDto) {
    this.ensureAdmin(user);
    if (dto.email) {
      const dup = await this.prisma.guardian.findFirst({
        where: {
          tenantId: user.tenantId,
          email: dto.email.toLowerCase().trim(),
        },
      });
      if (dup) throw new ConflictException('E-mail já cadastrado (CA-04.03).');
    }
    return this.prisma.guardian.create({
      data: {
        tenantId: user.tenantId,
        fullName: dto.fullName,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        email: dto.email?.toLowerCase().trim(),
        kinship: dto.kinship,
        address: dto.address,
        cpf: dto.cpf,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateGuardianDto) {
    this.ensureAdmin(user);
    const existing = await this.prisma.guardian.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    if (dto.email && dto.email !== existing.email) {
      const dup = await this.prisma.guardian.findFirst({
        where: {
          tenantId: user.tenantId,
          email: dto.email.toLowerCase().trim(),
          NOT: { id },
        },
      });
      if (dup) throw new ConflictException('E-mail já cadastrado (CA-04.03).');
    }
    return this.prisma.guardian.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        email:
          dto.email === undefined
            ? undefined
            : dto.email
              ? dto.email.toLowerCase().trim()
              : null,
        kinship: dto.kinship,
        address: dto.address,
        cpf: dto.cpf,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    this.ensureAdmin(user);
    await this.prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.findFirst({
        where: { id, tenantId: user.tenantId },
      });
      if (!guardian) throw new NotFoundException();
      await tx.studentGuardian.deleteMany({
        where: { guardianId: id, tenantId: user.tenantId },
      });
      await tx.guardian.delete({ where: { id } });
    });
    return { ok: true };
  }
}
