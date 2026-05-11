import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { CreateExerciseLibraryItemDto } from './dto/create-exercise-library-item.dto';
import { UpdateExerciseLibraryItemDto } from './dto/update-exercise-library-item.dto';

const itemInclude = {
  ownerStaff: {
    select: {
      id: true,
      userId: true,
      professionalType: true,
      user: { select: { id: true, fullName: true } },
    },
  },
  createdByUser: {
    select: { id: true, fullName: true, role: true },
  },
} satisfies Prisma.ExerciseLibraryItemInclude;

@Injectable()
export class ExerciseLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quem pode ver/usar a biblioteca: ADMIN do tenant, ou TREINADOR com
   * `StaffProfile.active`. A biblioteca é compartilhada por tenant (PI-5.2).
   */
  private async requireAccessOrStaff(user: AuthUser) {
    if (user.role === UserRole.ADMIN) return null;
    if (user.role !== UserRole.TREINADOR) throw new ForbiddenException();
    const profile = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tenantId, userId: user.sub, active: true },
    });
    if (!profile) throw new ForbiddenException();
    return profile;
  }

  /**
   * Resolve o `ownerStaffId` (opcional) para o usuário atual.
   * - ADMIN: usa `StaffProfile` se existir (autor mais "rico" no relatório),
   *   mas é permitido criar **sem** ele — `ownerStaffId` fica `null` e
   *   o autor é registrado em `createdByUserId` (RN-1311).
   * - TREINADOR: precisa de `StaffProfile.active` (mantém regra existente).
   */
  private async resolveOwnerStaffId(user: AuthUser): Promise<string | null> {
    if (user.role === UserRole.ADMIN) {
      const profile = await this.prisma.staffProfile.findFirst({
        where: { tenantId: user.tenantId, userId: user.sub, active: true },
        select: { id: true },
      });
      return profile?.id ?? null;
    }
    if (user.role !== UserRole.TREINADOR) throw new ForbiddenException();
    const profile = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tenantId, userId: user.sub, active: true },
      select: { id: true },
    });
    if (!profile) throw new ForbiddenException();
    return profile.id;
  }

  async list(
    user: AuthUser,
    opts: { search?: string; includeArchived?: boolean } = {},
  ) {
    await this.requireAccessOrStaff(user);
    const where: Prisma.ExerciseLibraryItemWhereInput = {
      tenantId: user.tenantId,
    };
    if (!opts.includeArchived) where.archived = false;
    if (opts.search?.trim()) {
      where.name = { contains: opts.search.trim(), mode: 'insensitive' };
    }
    return this.prisma.exerciseLibraryItem.findMany({
      where,
      orderBy: [{ archived: 'asc' }, { name: 'asc' }],
      include: itemInclude,
      take: 200,
    });
  }

  async getOne(user: AuthUser, id: string) {
    await this.requireAccessOrStaff(user);
    const item = await this.prisma.exerciseLibraryItem.findFirst({
      where: { id, tenantId: user.tenantId },
      include: itemInclude,
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  async create(user: AuthUser, dto: CreateExerciseLibraryItemDto) {
    const ownerStaffId = await this.resolveOwnerStaffId(user);
    return this.prisma.exerciseLibraryItem.create({
      data: {
        tenantId: user.tenantId,
        ownerStaffId,
        createdByUserId: user.sub,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        videoUrl: dto.videoUrl?.trim() || null,
        defaultSets: dto.defaultSets ?? null,
        defaultRepetitions: dto.defaultRepetitions ?? null,
        defaultDurationSeconds: dto.defaultDurationSeconds ?? null,
        defaultRestSeconds: dto.defaultRestSeconds ?? null,
        notes: dto.notes?.trim() || null,
      },
      include: itemInclude,
    });
  }

  /**
   * Autoria efetiva: ADMIN sempre pode editar/arquivar; do contrário, precisa
   * ser o `createdByUserId` (autor real). Fallback histórico via `ownerStaff.userId`
   * cobre registros antigos onde `createdByUserId` foi backfilled a partir do staff.
   */
  private isOwnerOrAdmin(
    user: AuthUser,
    item: {
      createdByUserId: string;
      ownerStaff: { userId: string } | null;
    },
  ) {
    if (user.role === UserRole.ADMIN) return true;
    if (item.createdByUserId === user.sub) return true;
    return item.ownerStaff?.userId === user.sub;
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateExerciseLibraryItemDto,
  ) {
    await this.requireAccessOrStaff(user);
    const item = await this.prisma.exerciseLibraryItem.findFirst({
      where: { id, tenantId: user.tenantId },
      include: itemInclude,
    });
    if (!item) throw new NotFoundException();
    if (!this.isOwnerOrAdmin(user, item)) throw new ForbiddenException();
    return this.prisma.exerciseLibraryItem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : (dto.description?.trim() ?? null),
        videoUrl:
          dto.videoUrl === undefined ? undefined : (dto.videoUrl?.trim() ?? null),
        defaultSets: dto.defaultSets === undefined ? undefined : dto.defaultSets,
        defaultRepetitions:
          dto.defaultRepetitions === undefined
            ? undefined
            : dto.defaultRepetitions,
        defaultDurationSeconds:
          dto.defaultDurationSeconds === undefined
            ? undefined
            : dto.defaultDurationSeconds,
        defaultRestSeconds:
          dto.defaultRestSeconds === undefined
            ? undefined
            : dto.defaultRestSeconds,
        notes:
          dto.notes === undefined ? undefined : (dto.notes?.trim() ?? null),
      },
      include: itemInclude,
    });
  }

  async setArchived(user: AuthUser, id: string, archived: boolean) {
    await this.requireAccessOrStaff(user);
    const item = await this.prisma.exerciseLibraryItem.findFirst({
      where: { id, tenantId: user.tenantId },
      include: itemInclude,
    });
    if (!item) throw new NotFoundException();
    if (!this.isOwnerOrAdmin(user, item)) throw new ForbiddenException();
    return this.prisma.exerciseLibraryItem.update({
      where: { id },
      data: { archived },
      include: itemInclude,
    });
  }
}
