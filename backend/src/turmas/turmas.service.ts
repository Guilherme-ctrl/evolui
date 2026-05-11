import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  ensureCoachTurma,
  listTurmaIdsForCoach,
} from '../common/permissions/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { EnrollDto } from './dto/enroll.dto';
import { enrollmentCategoryWarnings } from '../common/category-warning';

@Injectable()
export class TurmasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, cursor?: string, take = 30) {
    const cap = Math.min(take, 100);
    const coachTurmas = await listTurmaIdsForCoach(this.prisma, user);
    const where =
      coachTurmas === null
        ? { tenantId: user.tenantId }
        : { tenantId: user.tenantId, id: { in: coachTurmas } };
    return this.prisma.turma.findMany({
      where,
      orderBy: { name: 'asc' },
      take: cap + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        coach: { select: { id: true, fullName: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async get(user: AuthUser, id: string) {
    await ensureCoachTurma(this.prisma, user, id);
    return this.prisma.turma.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        coach: { select: { id: true, fullName: true, email: true } },
        enrollments: { include: { student: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateTurmaDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const coach = await this.prisma.user.findFirst({
      where: {
        id: dto.coachUserId,
        tenantId: user.tenantId,
        role: UserRole.TREINADOR,
        active: true,
      },
    });
    if (!coach) throw new BadRequestException('Treinador inválido');
    return this.prisma.turma.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        ageRangeText: dto.ageRangeText,
        weekDaysText: dto.weekDaysText,
        scheduleText: dto.scheduleText,
        location: dto.location,
        capacity: dto.capacity,
        coachUserId: dto.coachUserId,
        categoryLabel: dto.categoryLabel,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateTurmaDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const existing = await this.prisma.turma.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    if (dto.coachUserId) {
      const coach = await this.prisma.user.findFirst({
        where: {
          id: dto.coachUserId,
          tenantId: user.tenantId,
          role: UserRole.TREINADOR,
          active: true,
        },
      });
      if (!coach) throw new BadRequestException('Treinador inválido');
    }
    const scheduleFields = [
      'weekDaysText',
      'scheduleText',
      'location',
    ] as const;
    const scheduleChanged = scheduleFields.some(
      (f) => dto[f] !== undefined && dto[f] !== existing[f],
    );
    const previousJson = {
      weekDaysText: existing.weekDaysText,
      scheduleText: existing.scheduleText,
      location: existing.location,
    };
    const turma = await this.prisma.turma.update({
      where: { id },
      data: {
        name: dto.name,
        ageRangeText: dto.ageRangeText,
        weekDaysText: dto.weekDaysText,
        scheduleText: dto.scheduleText,
        location: dto.location,
        capacity: dto.capacity,
        coachUserId: dto.coachUserId,
        categoryLabel: dto.categoryLabel,
      },
    });
    if (scheduleChanged) {
      await this.prisma.turmaScheduleAudit.create({
        data: {
          tenantId: user.tenantId,
          turmaId: id,
          previousJson,
          nextJson: {
            weekDaysText: turma.weekDaysText,
            scheduleText: turma.scheduleText,
            location: turma.location,
          },
          createdById: user.sub,
        },
      });
      const userIds = await this.notifications.recipientUserIdsForTurmas(
        user.tenantId,
        [id],
      );
      await this.notifications.emitToUsers({
        tenantId: user.tenantId,
        userIds,
        type: 'SCHEDULE_CHANGE',
        title: 'Horário de treino atualizado',
        body: `A turma ${turma.name} teve alteração de horário ou local. Confira o calendário.`,
      });
    }
    return turma;
  }

  async enroll(user: AuthUser, turmaId: string, dto: EnrollDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const turma = await this.prisma.turma.findFirst({
      where: { id: turmaId, tenantId: user.tenantId },
    });
    if (!turma) throw new NotFoundException();
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: user.tenantId, active: true },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');
    const enrolled = await this.prisma.enrollment.count({
      where: { turmaId, tenantId: user.tenantId },
    });
    if (enrolled >= turma.capacity) {
      throw new BadRequestException('Turma sem vagas (CA-05.01).');
    }
    const enrollment = await this.prisma.enrollment.create({
      data: {
        tenantId: user.tenantId,
        turmaId,
        studentId: dto.studentId,
      },
    });
    const warnings = enrollmentCategoryWarnings(
      student.categoryLabel,
      turma.categoryLabel,
    );
    return { ...enrollment, warnings };
  }

  async unenroll(user: AuthUser, turmaId: string, studentId: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    await this.prisma.enrollment.deleteMany({
      where: { turmaId, studentId, tenantId: user.tenantId },
    });
    return { ok: true };
  }

  async changeCoach(user: AuthUser, turmaId: string, coachUserId: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const coach = await this.prisma.user.findFirst({
      where: {
        id: coachUserId,
        tenantId: user.tenantId,
        role: UserRole.TREINADOR,
        active: true,
      },
    });
    if (!coach) throw new BadRequestException('Treinador inválido');
    return this.prisma.turma.update({
      where: { id: turmaId },
      data: { coachUserId },
    });
  }

  async remove(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const turma = await this.prisma.turma.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!turma) throw new NotFoundException();
    await this.prisma.turma.delete({ where: { id } });
    return { ok: true };
  }
}
