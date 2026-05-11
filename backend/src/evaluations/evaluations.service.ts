import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  ensureCanReadStudent,
  ensureCoachTurma,
} from '../common/permissions/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvalConfigDto } from './dto/update-eval-config.dto';
import { buildAutoFeedback } from './evaluations.util';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async updateTenantConfig(user: AuthUser, dto: UpdateEvalConfigDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    return this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        evaluationModel: dto.evaluationModel,
        evaluationDimensions:
          dto.evaluationDimensions !== undefined
            ? (dto.evaluationDimensions as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  async getTenantConfig(user: AuthUser) {
    return this.prisma.tenant.findFirst({
      where: { id: user.tenantId },
      select: {
        evaluationModel: true,
        evaluationDimensions: true,
      },
    });
  }

  async create(user: AuthUser, dto: CreateEvaluationDto) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TREINADOR) {
      throw new ForbiddenException();
    }
    await ensureCoachTurma(this.prisma, user, dto.turmaId);
    const enr = await this.prisma.enrollment.findFirst({
      where: {
        studentId: dto.studentId,
        turmaId: dto.turmaId,
        tenantId: user.tenantId,
      },
    });
    if (!enr) throw new BadRequestException('Aluno não está na turma.');
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: user.tenantId },
    });
    if (!tenant) throw new NotFoundException();
    const autoFeedback = buildAutoFeedback(
      dto.scores as Record<string, unknown>,
      tenant.evaluationModel,
    );
    const evaluation = await this.prisma.evaluation.create({
      data: {
        tenantId: user.tenantId,
        studentId: dto.studentId,
        turmaId: dto.turmaId,
        coachUserId: user.sub,
        comment: dto.comment,
        autoFeedback,
        scores: dto.scores,
      },
    });
    const userIds = await this.notifications.recipientUserIdsForStudent(
      user.tenantId,
      dto.studentId,
    );
    const studentRow = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: user.tenantId },
      select: { fullName: true },
    });
    await this.notifications.emitToUsers({
      tenantId: user.tenantId,
      userIds,
      type: 'EVALUATION',
      title: 'Nova avaliação disponível',
      body: 'Seu filho recebeu um novo feedback do treinador.',
      payload: studentRow?.fullName
        ? { studentName: studentRow.fullName }
        : undefined,
      dedupeKey: `EVALUATION:${evaluation.id}`,
    });
    return evaluation;
  }

  async listForStudent(user: AuthUser, studentId: string) {
    await ensureCanReadStudent(this.prisma, user, studentId);
    return this.prisma.evaluation.findMany({
      where: { tenantId: user.tenantId, studentId },
      orderBy: { evaluatedAt: 'desc' },
      take: 100,
      include: { coach: { select: { fullName: true } } },
    });
  }

  /**
   * KPI da Home do Admin: cobertura de avaliações no mês civil corrente.
   * Retorna o período usado, total de alunos ativos no tenant, quantos
   * receberam ao menos uma avaliação no período e o percentual.
   */
  async adminSummary(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const now = new Date();
    const periodFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const periodTo = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const tenantId = user.tenantId;

    const [activeStudents, distinctRows, totalThisMonth] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, active: true } }),
      this.prisma.evaluation.findMany({
        where: {
          tenantId,
          evaluatedAt: { gte: periodFrom, lte: periodTo },
        },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
      this.prisma.evaluation.count({
        where: {
          tenantId,
          evaluatedAt: { gte: periodFrom, lte: periodTo },
        },
      }),
    ]);
    const distinctStudentsEvaluated = distinctRows.length;
    const percentage =
      activeStudents > 0
        ? Math.round((1000 * distinctStudentsEvaluated) / activeStudents) / 10
        : null;
    return {
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      activeStudents,
      distinctStudentsEvaluated,
      totalEvaluations: totalThisMonth,
      percentage,
    };
  }
}
