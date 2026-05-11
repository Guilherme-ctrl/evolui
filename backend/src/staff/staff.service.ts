import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
  }

  async create(user: AuthUser, dto: CreateStaffDto) {
    this.assertAdmin(user);
    const email = dto.email.toLowerCase().trim();
    const dup = await this.prisma.user.findFirst({
      where: { tenantId: user.tenantId, email },
    });
    if (dup) throw new ConflictException('E-mail já cadastrado nesta escolinha.');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: user.tenantId,
          email,
          passwordHash,
          role: UserRole.TREINADOR,
          fullName: dto.fullName.trim(),
        },
      });
      const profile = await tx.staffProfile.create({
        data: {
          tenantId: user.tenantId,
          userId: u.id,
          professionalType: dto.professionalType,
          registry: dto.registry?.trim() || null,
          bio: dto.bio?.trim() || null,
        },
        include: { user: { select: { id: true, email: true, fullName: true } } },
      });
      return profile;
    });
  }

  async list(user: AuthUser) {
    this.assertAdmin(user);
    return this.prisma.staffProfile.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, email: true, fullName: true, active: true } },
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateStaffDto) {
    this.assertAdmin(user);
    const profile = await this.prisma.staffProfile.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { user: { select: { id: true } } },
    });
    if (!profile) throw new NotFoundException();
    return this.prisma.staffProfile.update({
      where: { id },
      data: {
        professionalType: dto.professionalType,
        registry: dto.registry,
        bio: dto.bio,
        active: dto.active,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true, active: true } },
      },
    });
  }
}
