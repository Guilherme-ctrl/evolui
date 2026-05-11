import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IndividualPlanStatus,
  IndividualPlanType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  ensureCanReadStudent,
  listTurmaIdsForCoach,
} from '../common/permissions/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIndividualPlanDto } from './dto/create-individual-plan.dto';
import { UpdateIndividualPlanDto } from './dto/update-individual-plan.dto';
import { CreateIndividualPlanSessionDto } from './dto/create-session.dto';
import { UpdateIndividualPlanSessionDto } from './dto/update-session.dto';
import { CreateIndividualPlanExerciseDto } from './dto/create-exercise.dto';
import { UpdateIndividualPlanExerciseDto } from './dto/update-exercise.dto';
import { UseFromLibraryDto } from '../exercise-library/dto/use-from-library.dto';

const PLAN_TYPE_LABEL: Record<IndividualPlanType, string> = {
  TREINO: 'Treino',
  REFORCO_TECNICO: 'Reforço técnico',
  TRATAMENTO: 'Tratamento',
  RECUPERACAO: 'Recuperação',
  OUTRO: 'Plano',
};

function firstTokenName(fullName: string): string {
  const t = fullName.trim().split(/\s+/)[0];
  return t || 'Profissional';
}

function utcYmd(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const planDetailInclude = {
  student: { select: { id: true, fullName: true, active: true } },
  assignedProfessional: {
    select: {
      id: true,
      userId: true,
      professionalType: true,
      user: { select: { id: true, fullName: true } },
    },
  },
  sessions: {
    orderBy: { order: 'asc' as const },
    include: {
      exercises: { orderBy: { order: 'asc' as const } },
    },
  },
} satisfies Prisma.IndividualPlanInclude;

type PlanDetail = Prisma.IndividualPlanGetPayload<{
  include: typeof planDetailInclude;
}>;

@Injectable()
export class IndividualPlansService {
  private readonly logger = new Logger(IndividualPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private logTransition(
    event: string,
    data: { planId: string; tenantId: string; action?: string },
  ) {
    this.logger.log(
      JSON.stringify({
        event,
        planId: data.planId,
        tenantId: data.tenantId,
        ...(data.action ? { action: data.action } : {}),
      }),
    );
  }

  private auditSnapshot(plan: {
    id: string;
    status: IndividualPlanStatus;
    type: IndividualPlanType;
    title: string;
    goal: string | null;
    studentId: string;
    assignedProfessionalId: string;
    sessionCount?: number;
  }) {
    return {
      id: plan.id,
      status: plan.status,
      type: plan.type,
      title: plan.title,
      goal: plan.goal,
      studentId: plan.studentId,
      assignedProfessionalId: plan.assignedProfessionalId,
      sessionCount: plan.sessionCount,
    };
  }

  async studentLinkedToProfessionalUser(
    tenantId: string,
    studentId: string,
    professionalUserId: string,
  ): Promise<boolean> {
    const n = await this.prisma.enrollment.count({
      where: {
        tenantId,
        studentId,
        turma: { coachUserId: professionalUserId },
      },
    });
    return n > 0;
  }

  private async requireActiveStaffForUser(user: AuthUser) {
    const profile = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tenantId, userId: user.sub, active: true },
    });
    if (!profile) throw new ForbiddenException();
    return profile;
  }

  private async assertStudentScopeForProfessional(
    tenantId: string,
    studentId: string,
    professionalUserId: string,
  ) {
    const ok = await this.studentLinkedToProfessionalUser(
      tenantId,
      studentId,
      professionalUserId,
    );
    if (!ok) throw new ForbiddenException();
  }

  private isAuthorOrAdmin(user: AuthUser, plan: PlanDetail): boolean {
    if (user.role === UserRole.ADMIN) return true;
    return plan.assignedProfessional.userId === user.sub;
  }

  private async canCoachViewPlan(user: AuthUser, plan: PlanDetail) {
    if (user.role === UserRole.ADMIN) return true;
    if (plan.assignedProfessional.userId === user.sub) return true;
    if (user.role !== UserRole.TREINADOR) return false;
    const turmaIds = await listTurmaIdsForCoach(this.prisma, user);
    if (!turmaIds?.length) return false;
    const enr = await this.prisma.enrollment.findFirst({
      where: {
        studentId: plan.studentId,
        tenantId: user.tenantId,
        turmaId: { in: turmaIds },
      },
    });
    return !!enr;
  }

  private maskTratamento(plan: PlanDetail, viewerFull: boolean): PlanDetail {
    if (viewerFull || plan.type !== IndividualPlanType.TRATAMENTO) return plan;
    return {
      ...plan,
      goal: null,
      title: 'Plano de acompanhamento',
      sessions: [],
    };
  }

  async pauseAllPublishedFor(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    reasonCode: string,
  ) {
    const published = await this.prisma.individualPlan.findMany({
      where: { tenantId, studentId, status: IndividualPlanStatus.PUBLISHED },
    });
    for (const p of published) {
      await this.prisma.$transaction(async (tx) => {
        const prev = await tx.individualPlan.findFirst({
          where: { id: p.id, tenantId },
          include: {
            sessions: { select: { id: true } },
          },
        });
        if (!prev || prev.status !== IndividualPlanStatus.PUBLISHED) return;
        const prevSnap = this.auditSnapshot({
          ...prev,
          sessionCount: prev.sessions.length,
        });
        await tx.individualPlan.update({
          where: { id: p.id },
          data: {
            status: IndividualPlanStatus.PAUSED,
            pausedAt: new Date(),
          },
        });
        const next = await tx.individualPlan.findFirst({
          where: { id: p.id },
          include: { sessions: { select: { id: true } } },
        });
        if (!next) return;
        await tx.individualPlanAudit.create({
          data: {
            tenantId,
            planId: p.id,
            action: 'PAUSE',
            previousJson: prevSnap as object,
            nextJson: this.auditSnapshot({
              ...next,
              sessionCount: next.sessions.length,
            }) as object,
            reason: reasonCode,
            createdById: actorUserId,
          },
        });
        this.logTransition('individual_plan.paused', {
          planId: p.id,
          tenantId,
          action: 'STUDENT_INACTIVATED',
        });
      });
    }
  }

  private async notifyAthleteAccountSafe(input: {
    tenantId: string;
    studentId: string;
    studentName: string;
    planType: IndividualPlanType;
    isClinical: boolean;
    notificationType:
      | 'INDIVIDUAL_PLAN_PUBLISHED'
      | 'INDIVIDUAL_PLAN_UPDATED'
      | 'INDIVIDUAL_PLAN_PAUSED'
      | 'INDIVIDUAL_PLAN_RESUMED'
      | 'INDIVIDUAL_PLAN_COMPLETED'
      | 'INDIVIDUAL_PLAN_CANCELLED';
    dedupeKey: string;
    profFirstName?: string;
    bypassPreferenceMute?: boolean;
  }) {
    const sn = input.studentName.trim() || 'seu filho';
    const prof = input.profFirstName ?? 'um profissional';
    const typeLabel = PLAN_TYPE_LABEL[input.planType];
    let title: string;
    let body: string;
    switch (input.notificationType) {
      case 'INDIVIDUAL_PLAN_PUBLISHED':
        if (input.isClinical) {
          title = `Novo plano de acompanhamento para ${sn}`;
          body = 'Abra o portal para ver os detalhes.';
        } else {
          title = `Novo plano para ${sn}`;
          body = `${typeLabel} prescrito por ${prof}.`;
        }
        break;
      case 'INDIVIDUAL_PLAN_UPDATED':
        title = `Plano atualizado · ${sn}`;
        body = 'Abra o portal para ver as mudanças.';
        break;
      case 'INDIVIDUAL_PLAN_PAUSED':
        title = `Plano em pausa · ${sn}`;
        body = 'Consulte o portal para mais informações.';
        break;
      case 'INDIVIDUAL_PLAN_RESUMED':
        title = `Plano retomado · ${sn}`;
        body = 'Consulte o portal para acompanhar.';
        break;
      case 'INDIVIDUAL_PLAN_COMPLETED':
        title = `Plano concluído · ${sn}`;
        body = 'Veja o resumo no portal do responsável.';
        break;
      case 'INDIVIDUAL_PLAN_CANCELLED':
        title = `Plano encerrado · ${sn}`;
        body = 'Consulte o portal para detalhes.';
        break;
      default:
        title = `Atualização · ${sn}`;
        body = 'Abra o portal para ver os detalhes.';
    }
    await this.notifications.notifyIndividualPlanEvent({
      tenantId: input.tenantId,
      studentId: input.studentId,
      notificationType: input.notificationType,
      title,
      body,
      dedupeKey: input.dedupeKey,
      bypassPreferenceMute: input.bypassPreferenceMute,
      payload: { studentName: sn },
    });
  }

  async listRecentForAssignedProfessional(user: AuthUser, take = 3) {
    if (user.role !== UserRole.TREINADOR && user.role !== UserRole.ADMIN) {
      return [];
    }
    const profile = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        active: true,
      },
    });
    if (!profile) return [];
    return this.prisma.individualPlan.findMany({
      where: { tenantId: user.tenantId, assignedProfessionalId: profile.id },
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        student: { select: { id: true, fullName: true } },
      },
    });
  }

  async listForStaff(user: AuthUser, studentId: string) {
    await ensureCanReadStudent(this.prisma, user, studentId);
    const rows = await this.prisma.individualPlan.findMany({
      where: { tenantId: user.tenantId, studentId },
      orderBy: { updatedAt: 'desc' },
      include: {
        assignedProfessional: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        _count: { select: { sessions: true } },
      },
    });
    return rows.map((r) => {
      const full =
        user.role === UserRole.ADMIN ||
        r.assignedProfessional.userId === user.sub;
      const masked =
        !full && r.type === IndividualPlanType.TRATAMENTO
          ? {
              ...r,
              title: 'Plano de acompanhamento',
              goal: null,
            }
          : r;
      return masked;
    });
  }

  async create(user: AuthUser, studentId: string, dto: CreateIndividualPlanDto) {
    await ensureCanReadStudent(this.prisma, user, studentId);
    // RN-1320: o tipo `TREINO` foi substituído pelo módulo Workouts (Doc 25).
    // IndividualPlan agora cobre apenas `TRATAMENTO` clínico. Treinos genéricos
    // (turma/aluno) devem ser criados em `/workouts`.
    if (dto.type !== IndividualPlanType.TRATAMENTO) {
      throw new BadRequestException(
        'Planos individuais foram restritos a TRATAMENTO clínico. Crie treinos em /workouts (Doc 25).',
      );
    }
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tenantId },
    });
    if (!student) throw new NotFoundException();

    let assignedProfessionalId: string;
    if (user.role === UserRole.ADMIN) {
      if (!dto.assignedProfessionalId?.trim()) {
        throw new BadRequestException('Informe o profissional responsável.');
      }
      const staff = await this.prisma.staffProfile.findFirst({
        where: {
          id: dto.assignedProfessionalId,
          tenantId: user.tenantId,
          active: true,
        },
        include: { user: true },
      });
      if (!staff) throw new BadRequestException('Profissional inválido.');
      await this.assertStudentScopeForProfessional(
        user.tenantId,
        studentId,
        staff.userId,
      );
      assignedProfessionalId = staff.id;
    } else {
      const profile = await this.requireActiveStaffForUser(user);
      await this.assertStudentScopeForProfessional(
        user.tenantId,
        studentId,
        user.sub,
      );
      assignedProfessionalId = profile.id;
    }

    return this.prisma.individualPlan.create({
      data: {
        tenantId: user.tenantId,
        studentId,
        assignedProfessionalId,
        type: dto.type,
        title: dto.title.trim(),
        goal: dto.goal?.trim() || null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        weeklyFrequency: dto.weeklyFrequency ?? null,
        status: IndividualPlanStatus.DRAFT,
        createdById: user.sub,
      },
      include: planDetailInclude,
    });
  }

  async getOne(user: AuthUser, planId: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    const canView = await this.canCoachViewPlan(user, plan);
    if (!canView) throw new ForbiddenException();
    const full = this.isAuthorOrAdmin(user, plan);
    return this.maskTratamento(plan, full);
  }

  async updateMeta(user: AuthUser, planId: string, dto: UpdateIndividualPlanDto) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();

    const wasPublished = plan.status === IndividualPlanStatus.PUBLISHED;
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    const updated = await this.prisma.individualPlan.update({
      where: { id: planId },
      data: {
        type: dto.type,
        title: dto.title?.trim(),
        goal: dto.goal === undefined ? undefined : dto.goal?.trim() ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:
          dto.endDate === undefined
            ? undefined
            : dto.endDate
              ? new Date(dto.endDate)
              : null,
        weeklyFrequency:
          dto.weeklyFrequency === undefined ? undefined : dto.weeklyFrequency,
      },
      include: planDetailInclude,
    });

    if (wasPublished) {
      await this.prisma.individualPlanAudit.create({
        data: {
          tenantId: user.tenantId,
          planId,
          action: 'UPDATE',
          previousJson: prevSnap as object,
          nextJson: this.auditSnapshot({
            ...updated,
            sessionCount: updated.sessions.length,
          }) as object,
          createdById: user.sub,
        },
      });
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: updated.studentId,
        studentName: updated.student.fullName,
        planType: updated.type,
        isClinical: updated.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: `ind-plan-update:${planId}:${utcYmd()}`,
        profFirstName: firstTokenName(updated.assignedProfessional.user.fullName),
      });
      this.logTransition('individual_plan.updated', { planId, tenantId: user.tenantId });
    }

    const full = this.isAuthorOrAdmin(user, updated);
    return this.maskTratamento(updated, full);
  }

  async addSession(
    user: AuthUser,
    planId: string,
    dto: CreateIndividualPlanSessionDto,
  ) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    const maxOrder = await this.prisma.individualPlanSession.aggregate({
      where: { planId },
      _max: { order: true },
    });
    const order = (maxOrder._max.order ?? -1) + 1;
    const wasPublished = plan.status === IndividualPlanStatus.PUBLISHED;
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    await this.prisma.individualPlanSession.create({
      data: {
        planId,
        order,
        title: dto.title.trim(),
        instructions: dto.instructions?.trim() || null,
        estimatedDurationMinutes: dto.estimatedDurationMinutes ?? null,
      },
    });

    const next = await this.prisma.individualPlan.findFirst({
      where: { id: planId },
      include: planDetailInclude,
    });
    if (!next) throw new NotFoundException();

    if (wasPublished) {
      await this.prisma.individualPlanAudit.create({
        data: {
          tenantId: user.tenantId,
          planId,
          action: 'UPDATE',
          previousJson: prevSnap as object,
          nextJson: this.auditSnapshot({
            ...next,
            sessionCount: next.sessions.length,
          }) as object,
          createdById: user.sub,
        },
      });
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: next.studentId,
        studentName: next.student.fullName,
        planType: next.type,
        isClinical: next.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: `ind-plan-update:${planId}:${utcYmd()}`,
        profFirstName: firstTokenName(next.assignedProfessional.user.fullName),
      });
      this.logTransition('individual_plan.updated', { planId, tenantId: user.tenantId });
    }

    return this.getOne(user, planId);
  }

  async updateSession(
    user: AuthUser,
    planId: string,
    sessionId: string,
    dto: UpdateIndividualPlanSessionDto,
  ) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    const sess = await this.prisma.individualPlanSession.findFirst({
      where: { id: sessionId, planId },
    });
    if (!sess) throw new NotFoundException();
    const wasPublished = plan.status === IndividualPlanStatus.PUBLISHED;
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    await this.prisma.individualPlanSession.update({
      where: { id: sessionId },
      data: {
        title: dto.title?.trim(),
        instructions:
          dto.instructions === undefined ? undefined : dto.instructions?.trim() ?? null,
        estimatedDurationMinutes:
          dto.estimatedDurationMinutes === undefined
            ? undefined
            : dto.estimatedDurationMinutes,
      },
    });

    const next = await this.prisma.individualPlan.findFirst({
      where: { id: planId },
      include: planDetailInclude,
    });
    if (!next) throw new NotFoundException();

    if (wasPublished) {
      await this.prisma.individualPlanAudit.create({
        data: {
          tenantId: user.tenantId,
          planId,
          action: 'UPDATE',
          previousJson: prevSnap as object,
          nextJson: this.auditSnapshot({
            ...next,
            sessionCount: next.sessions.length,
          }) as object,
          createdById: user.sub,
        },
      });
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: next.studentId,
        studentName: next.student.fullName,
        planType: next.type,
        isClinical: next.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: `ind-plan-update:${planId}:${utcYmd()}`,
        profFirstName: firstTokenName(next.assignedProfessional.user.fullName),
      });
      this.logTransition('individual_plan.updated', { planId, tenantId: user.tenantId });
    }

    return this.getOne(user, planId);
  }

  async deleteSession(user: AuthUser, planId: string, sessionId: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    const sess = await this.prisma.individualPlanSession.findFirst({
      where: { id: sessionId, planId },
    });
    if (!sess) throw new NotFoundException();
    const wasPublished = plan.status === IndividualPlanStatus.PUBLISHED;
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    await this.prisma.individualPlanSession.delete({ where: { id: sessionId } });

    const next = await this.prisma.individualPlan.findFirst({
      where: { id: planId },
      include: planDetailInclude,
    });
    if (!next) throw new NotFoundException();

    if (wasPublished) {
      await this.prisma.individualPlanAudit.create({
        data: {
          tenantId: user.tenantId,
          planId,
          action: 'UPDATE',
          previousJson: prevSnap as object,
          nextJson: this.auditSnapshot({
            ...next,
            sessionCount: next.sessions.length,
          }) as object,
          createdById: user.sub,
        },
      });
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: next.studentId,
        studentName: next.student.fullName,
        planType: next.type,
        isClinical: next.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: `ind-plan-update:${planId}:${utcYmd()}`,
        profFirstName: firstTokenName(next.assignedProfessional.user.fullName),
      });
      this.logTransition('individual_plan.updated', { planId, tenantId: user.tenantId });
    }

    return this.getOne(user, planId);
  }

  async addExercise(
    user: AuthUser,
    sessionId: string,
    dto: CreateIndividualPlanExerciseDto,
  ) {
    const sess = await this.prisma.individualPlanSession.findFirst({
      where: { id: sessionId },
      include: { plan: { include: planDetailInclude } },
    });
    if (!sess || sess.plan.tenantId !== user.tenantId) throw new NotFoundException();
    const plan = sess.plan;
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    const planId = plan.id;
    const wasPublished = plan.status === IndividualPlanStatus.PUBLISHED;
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    const maxOrder = await this.prisma.individualPlanExercise.aggregate({
      where: { sessionId },
      _max: { order: true },
    });
    const order = (maxOrder._max.order ?? -1) + 1;
    await this.prisma.individualPlanExercise.create({
      data: {
        sessionId,
        order,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        videoUrl: dto.videoUrl?.trim() || null,
        sets: dto.sets ?? null,
        repetitions: dto.repetitions ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        restSeconds: dto.restSeconds ?? null,
        notes: dto.notes?.trim() || null,
      },
    });

    const next = await this.prisma.individualPlan.findFirst({
      where: { id: planId },
      include: planDetailInclude,
    });
    if (!next) throw new NotFoundException();

    if (wasPublished) {
      await this.prisma.individualPlanAudit.create({
        data: {
          tenantId: user.tenantId,
          planId,
          action: 'UPDATE',
          previousJson: prevSnap as object,
          nextJson: this.auditSnapshot({
            ...next,
            sessionCount: next.sessions.length,
          }) as object,
          createdById: user.sub,
        },
      });
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: next.studentId,
        studentName: next.student.fullName,
        planType: next.type,
        isClinical: next.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: `ind-plan-update:${planId}:${utcYmd()}`,
        profFirstName: firstTokenName(next.assignedProfessional.user.fullName),
      });
      this.logTransition('individual_plan.updated', { planId, tenantId: user.tenantId });
    }

    return this.getOne(user, planId);
  }

  /**
   * Cria um IndividualPlanExercise a partir de um item da biblioteca (snapshot).
   * Overrides do DTO sobrescrevem os defaults do template; campos não informados
   * herdam do template. O exercício resultante é independente do template — editar
   * a biblioteca depois NÃO altera o exercício do plano.
   */
  async addExerciseFromLibrary(
    user: AuthUser,
    sessionId: string,
    dto: UseFromLibraryDto,
  ) {
    const sess = await this.prisma.individualPlanSession.findFirst({
      where: { id: sessionId },
      include: { plan: { select: { tenantId: true } } },
    });
    if (!sess || sess.plan.tenantId !== user.tenantId) {
      throw new NotFoundException();
    }
    const tpl = await this.prisma.exerciseLibraryItem.findFirst({
      where: { id: dto.libraryItemId, tenantId: user.tenantId, archived: false },
    });
    if (!tpl) {
      throw new BadRequestException('Exercício da biblioteca inválido ou arquivado.');
    }
    const create: CreateIndividualPlanExerciseDto = {
      name: tpl.name,
      description: tpl.description ?? undefined,
      videoUrl: tpl.videoUrl ?? undefined,
      sets: dto.sets ?? tpl.defaultSets ?? undefined,
      repetitions: dto.repetitions ?? tpl.defaultRepetitions ?? undefined,
      durationSeconds:
        dto.durationSeconds ?? tpl.defaultDurationSeconds ?? undefined,
      restSeconds: dto.restSeconds ?? tpl.defaultRestSeconds ?? undefined,
      notes: dto.notes ?? tpl.notes ?? undefined,
    };
    return this.addExercise(user, sessionId, create);
  }

  async updateExercise(
    user: AuthUser,
    sessionId: string,
    exerciseId: string,
    dto: UpdateIndividualPlanExerciseDto,
  ) {
    const ex = await this.prisma.individualPlanExercise.findFirst({
      where: { id: exerciseId, sessionId },
      include: {
        session: { include: { plan: { include: planDetailInclude } } },
      },
    });
    if (!ex || ex.session.plan.tenantId !== user.tenantId) {
      throw new NotFoundException();
    }
    const plan = ex.session.plan;
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    const planId = plan.id;
    const wasPublished = plan.status === IndividualPlanStatus.PUBLISHED;
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    await this.prisma.individualPlanExercise.update({
      where: { id: exerciseId },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description?.trim() ?? null,
        videoUrl:
          dto.videoUrl === undefined ? undefined : dto.videoUrl?.trim() ?? null,
        sets: dto.sets === undefined ? undefined : dto.sets,
        repetitions: dto.repetitions === undefined ? undefined : dto.repetitions,
        durationSeconds:
          dto.durationSeconds === undefined ? undefined : dto.durationSeconds,
        restSeconds: dto.restSeconds === undefined ? undefined : dto.restSeconds,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() ?? null,
      },
    });

    const next = await this.prisma.individualPlan.findFirst({
      where: { id: planId },
      include: planDetailInclude,
    });
    if (!next) throw new NotFoundException();

    if (wasPublished) {
      await this.prisma.individualPlanAudit.create({
        data: {
          tenantId: user.tenantId,
          planId,
          action: 'UPDATE',
          previousJson: prevSnap as object,
          nextJson: this.auditSnapshot({
            ...next,
            sessionCount: next.sessions.length,
          }) as object,
          createdById: user.sub,
        },
      });
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: next.studentId,
        studentName: next.student.fullName,
        planType: next.type,
        isClinical: next.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: `ind-plan-update:${planId}:${utcYmd()}`,
        profFirstName: firstTokenName(next.assignedProfessional.user.fullName),
      });
      this.logTransition('individual_plan.updated', { planId, tenantId: user.tenantId });
    }

    return this.getOne(user, planId);
  }

  async deleteExercise(
    user: AuthUser,
    sessionId: string,
    exerciseId: string,
  ) {
    const ex = await this.prisma.individualPlanExercise.findFirst({
      where: { id: exerciseId, sessionId },
      include: {
        session: { include: { plan: { include: planDetailInclude } } },
      },
    });
    if (!ex || ex.session.plan.tenantId !== user.tenantId) {
      throw new NotFoundException();
    }
    const plan = ex.session.plan;
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    const planId = plan.id;
    const wasPublished = plan.status === IndividualPlanStatus.PUBLISHED;
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    await this.prisma.individualPlanExercise.delete({ where: { id: exerciseId } });

    const next = await this.prisma.individualPlan.findFirst({
      where: { id: planId },
      include: planDetailInclude,
    });
    if (!next) throw new NotFoundException();

    if (wasPublished) {
      await this.prisma.individualPlanAudit.create({
        data: {
          tenantId: user.tenantId,
          planId,
          action: 'UPDATE',
          previousJson: prevSnap as object,
          nextJson: this.auditSnapshot({
            ...next,
            sessionCount: next.sessions.length,
          }) as object,
          createdById: user.sub,
        },
      });
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: next.studentId,
        studentName: next.student.fullName,
        planType: next.type,
        isClinical: next.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: `ind-plan-update:${planId}:${utcYmd()}`,
        profFirstName: firstTokenName(next.assignedProfessional.user.fullName),
      });
      this.logTransition('individual_plan.updated', { planId, tenantId: user.tenantId });
    }

    return this.getOne(user, planId);
  }

  private assertPublishable(plan: PlanDetail) {
    if (!plan.student.active) {
      throw new BadRequestException('Aluno inativo não pode receber publicação.');
    }
    const hasGoal = !!(plan.goal && plan.goal.trim().length > 0);
    if (!hasGoal && plan.sessions.length === 0) {
      throw new BadRequestException(
        'Inclua ao menos uma sessão ou um objetivo antes de publicar.',
      );
    }
  }

  async publish(user: AuthUser, planId: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    if (
      plan.status !== IndividualPlanStatus.DRAFT &&
      plan.status !== IndividualPlanStatus.PAUSED
    ) {
      throw new BadRequestException('Plano não está em rascunho ou pausa.');
    }
    this.assertPublishable(plan);

    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });

    const updated = await this.prisma.individualPlan.update({
      where: { id: planId },
      data: {
        status: IndividualPlanStatus.PUBLISHED,
        publishedAt: new Date(),
        pausedAt: null,
      },
      include: planDetailInclude,
    });

    await this.prisma.individualPlanAudit.create({
      data: {
        tenantId: user.tenantId,
        planId,
        action: 'PUBLISH',
        previousJson: prevSnap as object,
        nextJson: this.auditSnapshot({
          ...updated,
          sessionCount: updated.sessions.length,
        }) as object,
        createdById: user.sub,
      },
    });

    const isClinical = updated.type === IndividualPlanType.TRATAMENTO;
    await this.notifyAthleteAccountSafe({
      tenantId: user.tenantId,
      studentId: updated.studentId,
      studentName: updated.student.fullName,
      planType: updated.type,
      isClinical,
      notificationType: 'INDIVIDUAL_PLAN_PUBLISHED',
      dedupeKey: `ind-plan-publish:${planId}`,
      profFirstName: firstTokenName(updated.assignedProfessional.user.fullName),
      bypassPreferenceMute: isClinical,
    });
    this.logTransition('individual_plan.published', { planId, tenantId: user.tenantId });

    return this.getOne(user, planId);
  }

  async pause(user: AuthUser, planId: string, reason?: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    if (plan.status !== IndividualPlanStatus.PUBLISHED) {
      throw new BadRequestException('Apenas plano publicado pode ser pausado.');
    }
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });
    const updated = await this.prisma.individualPlan.update({
      where: { id: planId },
      data: { status: IndividualPlanStatus.PAUSED, pausedAt: new Date() },
      include: planDetailInclude,
    });
    await this.prisma.individualPlanAudit.create({
      data: {
        tenantId: user.tenantId,
        planId,
        action: 'PAUSE',
        previousJson: prevSnap as object,
        nextJson: this.auditSnapshot({
          ...updated,
          sessionCount: updated.sessions.length,
        }) as object,
        reason: reason?.trim() || null,
        createdById: user.sub,
      },
    });
    await this.notifyAthleteAccountSafe({
      tenantId: user.tenantId,
      studentId: updated.studentId,
      studentName: updated.student.fullName,
      planType: updated.type,
      isClinical: updated.type === IndividualPlanType.TRATAMENTO,
      notificationType: 'INDIVIDUAL_PLAN_PAUSED',
      dedupeKey: `ind-plan-pause:${planId}`,
      profFirstName: firstTokenName(updated.assignedProfessional.user.fullName),
    });
    this.logTransition('individual_plan.paused', { planId, tenantId: user.tenantId });
    return this.getOne(user, planId);
  }

  async resume(user: AuthUser, planId: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    if (plan.status !== IndividualPlanStatus.PAUSED) {
      throw new BadRequestException('Plano não está pausado.');
    }
    if (!plan.student.active) {
      throw new BadRequestException('Aluno inativo: não é possível retomar.');
    }
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });
    const updated = await this.prisma.individualPlan.update({
      where: { id: planId },
      data: {
        status: IndividualPlanStatus.PUBLISHED,
        pausedAt: null,
      },
      include: planDetailInclude,
    });
    await this.prisma.individualPlanAudit.create({
      data: {
        tenantId: user.tenantId,
        planId,
        action: 'RESUME',
        previousJson: prevSnap as object,
        nextJson: this.auditSnapshot({
          ...updated,
          sessionCount: updated.sessions.length,
        }) as object,
        createdById: user.sub,
      },
    });
    await this.notifyAthleteAccountSafe({
      tenantId: user.tenantId,
      studentId: updated.studentId,
      studentName: updated.student.fullName,
      planType: updated.type,
      isClinical: updated.type === IndividualPlanType.TRATAMENTO,
      notificationType: 'INDIVIDUAL_PLAN_RESUMED',
      dedupeKey: `ind-plan-resume:${planId}`,
      profFirstName: firstTokenName(updated.assignedProfessional.user.fullName),
    });
    this.logTransition('individual_plan.resumed', { planId, tenantId: user.tenantId });
    return this.getOne(user, planId);
  }

  async complete(user: AuthUser, planId: string, completionNote?: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    if (
      plan.status !== IndividualPlanStatus.PUBLISHED &&
      plan.status !== IndividualPlanStatus.PAUSED
    ) {
      throw new BadRequestException('Plano não pode ser concluído neste estado.');
    }
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });
    const updated = await this.prisma.individualPlan.update({
      where: { id: planId },
      data: {
        status: IndividualPlanStatus.COMPLETED,
        completedAt: new Date(),
        completionNote: completionNote?.trim() || null,
      },
      include: planDetailInclude,
    });
    await this.prisma.individualPlanAudit.create({
      data: {
        tenantId: user.tenantId,
        planId,
        action: 'COMPLETE',
        previousJson: prevSnap as object,
        nextJson: this.auditSnapshot({
          ...updated,
          sessionCount: updated.sessions.length,
        }) as object,
        createdById: user.sub,
      },
    });
    await this.notifyAthleteAccountSafe({
      tenantId: user.tenantId,
      studentId: updated.studentId,
      studentName: updated.student.fullName,
      planType: updated.type,
      isClinical: updated.type === IndividualPlanType.TRATAMENTO,
      notificationType: 'INDIVIDUAL_PLAN_COMPLETED',
      dedupeKey: `ind-plan-complete:${planId}`,
      profFirstName: firstTokenName(updated.assignedProfessional.user.fullName),
    });
    this.logTransition('individual_plan.completed', { planId, tenantId: user.tenantId });
    return this.getOne(user, planId);
  }

  async cancel(user: AuthUser, planId: string, reason: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    if (!this.isAuthorOrAdmin(user, plan)) throw new ForbiddenException();
    if (plan.status === IndividualPlanStatus.CANCELLED) {
      throw new BadRequestException('Plano já cancelado.');
    }
    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });
    const updated = await this.prisma.individualPlan.update({
      where: { id: planId },
      data: {
        status: IndividualPlanStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
      },
      include: planDetailInclude,
    });
    await this.prisma.individualPlanAudit.create({
      data: {
        tenantId: user.tenantId,
        planId,
        action: 'CANCEL',
        previousJson: prevSnap as object,
        nextJson: this.auditSnapshot({
          ...updated,
          sessionCount: updated.sessions.length,
        }) as object,
        reason: reason.trim(),
        createdById: user.sub,
      },
    });
    if (plan.status !== IndividualPlanStatus.DRAFT) {
      await this.notifyAthleteAccountSafe({
        tenantId: user.tenantId,
        studentId: updated.studentId,
        studentName: updated.student.fullName,
        planType: updated.type,
        isClinical: updated.type === IndividualPlanType.TRATAMENTO,
        notificationType: 'INDIVIDUAL_PLAN_CANCELLED',
        dedupeKey: `ind-plan-cancel:${planId}`,
        profFirstName: firstTokenName(updated.assignedProfessional.user.fullName),
      });
    }
    this.logTransition('individual_plan.cancelled', { planId, tenantId: user.tenantId });
    return this.getOne(user, planId);
  }

  async reassign(user: AuthUser, planId: string, newStaffId: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: newStaffId, tenantId: user.tenantId, active: true },
      include: { user: true },
    });
    if (!staff) throw new BadRequestException('Profissional inválido.');
    await this.assertStudentScopeForProfessional(
      user.tenantId,
      plan.studentId,
      staff.userId,
    );

    const prevSnap = this.auditSnapshot({
      ...plan,
      sessionCount: plan.sessions.length,
    });
    const updated = await this.prisma.individualPlan.update({
      where: { id: planId },
      data: { assignedProfessionalId: newStaffId },
      include: planDetailInclude,
    });
    await this.prisma.individualPlanAudit.create({
      data: {
        tenantId: user.tenantId,
        planId,
        action: 'REASSIGN',
        previousJson: prevSnap as object,
        nextJson: this.auditSnapshot({
          ...updated,
          sessionCount: updated.sessions.length,
        }) as object,
        createdById: user.sub,
      },
    });
    this.logTransition('individual_plan.reassigned', { planId, tenantId: user.tenantId });
    return this.getOne(user, planId);
  }

  async listForAthleteAccount(user: AuthUser, studentId: string) {
    await ensureCanReadStudent(this.prisma, user, studentId);
    return this.prisma.individualPlan.findMany({
      where: {
        tenantId: user.tenantId,
        studentId,
        status: {
          in: [
            IndividualPlanStatus.PUBLISHED,
            IndividualPlanStatus.PAUSED,
            IndividualPlanStatus.COMPLETED,
            IndividualPlanStatus.CANCELLED,
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        assignedProfessional: {
          include: { user: { select: { fullName: true } } },
        },
        _count: { select: { sessions: true } },
      },
    });
  }

  async getForAthleteAccount(user: AuthUser, planId: string) {
    const plan = await this.prisma.individualPlan.findFirst({
      where: { id: planId, tenantId: user.tenantId },
      include: planDetailInclude,
    });
    if (!plan) throw new NotFoundException();
    await ensureCanReadStudent(this.prisma, user, plan.studentId);
    if (plan.status === IndividualPlanStatus.DRAFT) throw new NotFoundException();
    return plan;
  }
}
