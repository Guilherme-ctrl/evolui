import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, EventType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  ensureCoachTurma,
  listTurmaIdsForCoach,
} from '../common/permissions/scope';
import {
  resolveActiveStudent,
  studentIdsForAccountUser,
} from '../common/permissions/athlete-scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunicationsService } from '../communications/communications.service';
import {
  FeedbackDimension,
  parseFeedbackDimensions,
} from '../tenant-settings/tenant-settings.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CancelEventDto } from './dto/cancel-event.dto';
import { SetEventFeedbackDimensionsDto } from './dto/set-event-feedback-dimensions.dto';
import { SubmitEventFeedbackDto } from './dto/submit-event-feedback.dto';

type EventWithTurmas = {
  title: string;
  type: EventType;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  turmas: { turmaId: string }[];
  status?: EventStatus;
  cancelReason?: string | null;
  canceledAt?: Date | null;
};

const EVENT_TYPE_VALUES: ReadonlySet<string> = new Set(
  Object.values(EventType),
);

/**
 * Aceita CSV de tipos vindo da query string (`?type=TREINO,JOGO`). Ignora
 * tokens vazios ou desconhecidos para não derrubar a request por erro de
 * digitação na URL.
 */
function parseEventTypesCsv(raw?: string): EventType[] {
  if (!raw) return [];
  const seen = new Set<EventType>();
  for (const tok of raw.split(',')) {
    const t = tok.trim().toUpperCase();
    if (t && EVENT_TYPE_VALUES.has(t)) seen.add(t as EventType);
  }
  return Array.from(seen);
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly communications: CommunicationsService,
  ) {}

  /**
   * Dimensões efetivas: override do evento se houver (mesmo `[]` desliga
   * intencionalmente), caso contrário usa o default do tenant.
   */
  private static computeEffective(
    eventOverride: unknown,
    tenantDefault: unknown,
  ): FeedbackDimension[] {
    if (eventOverride === null || eventOverride === undefined) {
      return parseFeedbackDimensions(tenantDefault);
    }
    return parseFeedbackDimensions(eventOverride);
  }

  private async getTenantDefaultDims(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { defaultFeedbackDimensions: true },
    });
    return t.defaultFeedbackDimensions;
  }

  private decorateEvent<
    T extends {
      feedbackDimensions: Prisma.JsonValue | null;
    },
  >(event: T, tenantDefault: Prisma.JsonValue) {
    return {
      ...event,
      effectiveFeedbackDimensions: CalendarService.computeEffective(
        event.feedbackDimensions,
        tenantDefault,
      ),
    };
  }

  private eventAuditSnapshot(event: EventWithTurmas) {
    return {
      title: event.title,
      type: event.type,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      location: event.location,
      turmaIds: [...new Set(event.turmas.map((t) => t.turmaId))].sort(),
      ...(event.status !== undefined ? { status: event.status } : {}),
      ...(event.cancelReason !== undefined
        ? { cancelReason: event.cancelReason }
        : {}),
      ...(event.canceledAt !== undefined
        ? {
            canceledAt: event.canceledAt
              ? event.canceledAt.toISOString()
              : null,
          }
        : {}),
    };
  }

  private async visibleTurmaIds(user: AuthUser): Promise<string[] | null> {
    if (user.role === UserRole.ADMIN) return null;
    if (user.role === UserRole.TREINADOR) {
      const ids = await listTurmaIdsForCoach(this.prisma, user);
      return ids ?? [];
    }
    if (user.role === UserRole.ATLETA) {
      const studentIds = await studentIdsForAccountUser(this.prisma, user);
      if (!studentIds.length) return [];
      const enr = await this.prisma.enrollment.findMany({
        where: { tenantId: user.tenantId, studentId: { in: studentIds } },
        select: { turmaId: true },
        distinct: ['turmaId'],
      });
      return enr.map((e) => e.turmaId);
    }
    return [];
  }

  async list(
    user: AuthUser,
    fromIso?: string,
    toIso?: string,
    cursor?: string,
    take = 40,
    typesCsv?: string,
  ) {
    const cap = Math.min(take, 100);
    const turmaFilter = await this.visibleTurmaIds(user);
    const from = fromIso ? new Date(fromIso) : undefined;
    const to = toIso ? new Date(toIso) : undefined;
    const dateFilter =
      from || to
        ? {
            startsAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};
    const types = parseEventTypesCsv(typesCsv);
    const typeFilter = types.length ? { type: { in: types } } : {};
    const where =
      turmaFilter === null
        ? { tenantId: user.tenantId, ...dateFilter, ...typeFilter }
        : {
            tenantId: user.tenantId,
            ...dateFilter,
            ...typeFilter,
            OR: [
              { isWholeSchool: true },
              { turmas: { some: { turmaId: { in: turmaFilter } } } },
            ],
          };
    const events = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: cap + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { turmas: { include: { turma: true } } },
    });
    const tenantDefault = await this.getTenantDefaultDims(user.tenantId);
    return events.map((e) => this.decorateEvent(e, tenantDefault));
  }

  /**
   * Resumo de feedback por evento usado na página "Histórico de treinos".
   * Compartilha a mesma lógica de visibilidade do `list`, mas adiciona:
   *  - ADMIN/TREINADOR: `feedbackCount` e `averages[]` por dimensão efetiva.
   *  - ATLETA: `myFeedback` (resposta do aluno ativo) — sem médias/agregados,
   *    para respeitar privacidade do grupo.
   *
   * Aceita filtros opcionais `from`, `to`, `types` (CSV) e suporta paginação
   * por cursor descendente (mais recentes primeiro), com `take` máximo 50.
   */
  async feedbackOverview(
    user: AuthUser,
    opts: {
      from?: string;
      to?: string;
      types?: string;
      cursor?: string;
      take?: number;
    },
  ) {
    const cap = Math.min(Math.max(opts.take ?? 25, 1), 50);
    const turmaFilter = await this.visibleTurmaIds(user);
    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;
    const dateFilter =
      from || to
        ? {
            startsAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};
    const types = parseEventTypesCsv(opts.types);
    const typeFilter = types.length ? { type: { in: types } } : {};

    // Para o ATLETA, restringe ao aluno ativo (cobre conta com múltiplos
    // alunos): turmas matriculadas + eventos da escola toda.
    let athleteActiveStudentId: string | null = null;
    let effectiveTurmaFilter = turmaFilter;
    if (user.role === UserRole.ATLETA) {
      athleteActiveStudentId = await resolveActiveStudent(this.prisma, user);
      if (!athleteActiveStudentId) throw new BadRequestException();
      const enr = await this.prisma.enrollment.findMany({
        where: { tenantId: user.tenantId, studentId: athleteActiveStudentId },
        select: { turmaId: true },
        distinct: ['turmaId'],
      });
      effectiveTurmaFilter = enr.map((e) => e.turmaId);
    }

    const where =
      effectiveTurmaFilter === null
        ? { tenantId: user.tenantId, ...dateFilter, ...typeFilter }
        : {
            tenantId: user.tenantId,
            ...dateFilter,
            ...typeFilter,
            OR: [
              { isWholeSchool: true },
              { turmas: { some: { turmaId: { in: effectiveTurmaFilter } } } },
            ],
          };

    const events = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: cap + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: { turmas: { include: { turma: true } } },
    });
    const hasMore = events.length > cap;
    const page = hasMore ? events.slice(0, cap) : events;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    if (!page.length) {
      return { events: [], nextCursor: null as string | null };
    }
    const tenantDefault = await this.getTenantDefaultDims(user.tenantId);
    const eventIds = page.map((e) => e.id);

    if (user.role === UserRole.ATLETA && athleteActiveStudentId) {
      const mine = await this.prisma.calendarEventFeedback.findMany({
        where: {
          tenantId: user.tenantId,
          studentId: athleteActiveStudentId,
          eventId: { in: eventIds },
        },
        select: {
          id: true,
          eventId: true,
          scores: true,
          notes: true,
          updatedAt: true,
        },
      });
      const byEvent = new Map<string, (typeof mine)[number]>();
      for (const f of mine) byEvent.set(f.eventId, f);
      return {
        events: page.map((e) => {
          const decorated = this.decorateEvent(e, tenantDefault);
          const f = byEvent.get(e.id) ?? null;
          return {
            ...decorated,
            myFeedback: f
              ? {
                  id: f.id,
                  scores: (f.scores ?? {}) as Record<string, number>,
                  notes: f.notes,
                  updatedAt: f.updatedAt.toISOString(),
                }
              : null,
          };
        }),
        nextCursor,
      };
    }

    // Staff (ADMIN/TREINADOR): agregação por evento — uma query única, soma
    // em memória para evitar N+1.
    const allFeedbacks = await this.prisma.calendarEventFeedback.findMany({
      where: { tenantId: user.tenantId, eventId: { in: eventIds } },
      select: { eventId: true, scores: true },
    });
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const f of allFeedbacks) {
      const arr = grouped.get(f.eventId) ?? [];
      arr.push((f.scores ?? {}) as Record<string, unknown>);
      grouped.set(f.eventId, arr);
    }

    return {
      events: page.map((e) => {
        const decorated = this.decorateEvent(e, tenantDefault);
        const dims = decorated.effectiveFeedbackDimensions;
        const fbs = grouped.get(e.id) ?? [];
        const averages = dims.map((d) => {
          let sum = 0;
          let count = 0;
          for (const scores of fbs) {
            const v = scores[d.key];
            if (typeof v === 'number' && v >= 1 && v <= 5) {
              sum += v;
              count++;
            }
          }
          return {
            key: d.key,
            label: d.label,
            count,
            average: count ? Math.round((sum / count) * 100) / 100 : null,
          };
        });
        return {
          ...decorated,
          feedbackCount: fbs.length,
          averages,
        };
      }),
      nextCursor,
    };
  }

  async get(user: AuthUser, id: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { turmas: { include: { turma: true } } },
    });
    if (!event) throw new NotFoundException();
    const tenantDefault = await this.getTenantDefaultDims(user.tenantId);
    const decorated = this.decorateEvent(event, tenantDefault);
    if (event.isWholeSchool) {
      if (
        user.role === UserRole.ADMIN ||
        user.role === UserRole.TREINADOR ||
        user.role === UserRole.ATLETA
      ) {
        return decorated;
      }
      throw new ForbiddenException();
    }
    if (user.role === UserRole.ADMIN) return decorated;
    const turmaIds = event.turmas.map((t) => t.turmaId);
    if (user.role === UserRole.TREINADOR) {
      for (const tid of turmaIds) {
        try {
          await ensureCoachTurma(this.prisma, user, tid);
          return decorated;
        } catch {
          /* try next */
        }
      }
      throw new ForbiddenException();
    }
    if (user.role === UserRole.ATLETA) {
      const visible = await this.visibleTurmaIds(user);
      if (!visible?.length) throw new ForbiddenException();
      const ok = turmaIds.some((tid) => visible.includes(tid));
      if (!ok) throw new ForbiddenException();
      return decorated;
    }
    throw new ForbiddenException();
  }

  private async notifyEventTurmas(
    tenantId: string,
    turmaIds: string[],
    title: string,
    body: string,
    type: string,
    eventId: string,
  ) {
    const userIds = await this.notifications.recipientUserIdsForTurmas(
      tenantId,
      turmaIds,
    );
    await this.notifications.emitToUsers({
      tenantId,
      userIds,
      type,
      title,
      body,
      dedupeKey: `${type}:${eventId}`,
    });
  }

  async create(user: AuthUser, dto: CreateEventDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const turmaIds = dto.isWholeSchool ? [] : (dto.turmaIds ?? []);
    if (!dto.isWholeSchool && turmaIds.length === 0) {
      throw new ForbiddenException(
        'Informe turmas ou marque evento da escolinha.',
      );
    }
    const event = await this.prisma.calendarEvent.create({
      data: {
        tenantId: user.tenantId,
        type: dto.type,
        title: dto.title,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        location: dto.location,
        isWholeSchool: dto.isWholeSchool,
        createdById: user.sub,
        turmas: {
          create: turmaIds.map((turmaId) => ({ turmaId })),
        },
      },
      include: { turmas: true },
    });
    if (dto.isWholeSchool) {
      const allTurmas = await this.prisma.turma.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      await this.notifyEventTurmas(
        user.tenantId,
        allTurmas.map((t) => t.id),
        'Novo evento',
        dto.title,
        'CAL_NEW',
        event.id,
      );
    } else {
      await this.notifyEventTurmas(
        user.tenantId,
        turmaIds,
        'Novo evento',
        dto.title,
        'CAL_NEW',
        event.id,
      );
    }
    await this.communications.createFromCalendar({
      tenantId: user.tenantId,
      authorUserId: user.sub,
      title: `Calendário: ${dto.title}`,
      body: `Novo evento em ${dto.startsAt}`,
      calendarEventId: event.id,
      turmaIds,
      isWholeSchool: dto.isWholeSchool,
    });
    return event;
  }

  async update(user: AuthUser, id: string, dto: UpdateEventDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const existing = await this.prisma.calendarEvent.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { turmas: true },
    });
    if (!existing) throw new NotFoundException();
    const previousJson = this.eventAuditSnapshot(existing);
    const relevantChange =
      (dto.startsAt !== undefined &&
        new Date(dto.startsAt).getTime() !== existing.startsAt.getTime()) ||
      (dto.endsAt !== undefined &&
        new Date(dto.endsAt).getTime() !== existing.endsAt.getTime()) ||
      (dto.location !== undefined && dto.location !== existing.location);
    const event = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        location: dto.location,
        isWholeSchool: dto.isWholeSchool,
        ...(dto.turmaIds !== undefined || dto.isWholeSchool === true
          ? {
              turmas: {
                deleteMany: {},
                create:
                  dto.isWholeSchool === true
                    ? []
                    : (dto.turmaIds ?? []).map((turmaId) => ({ turmaId })),
              },
            }
          : {}),
      },
      include: { turmas: true },
    });
    const nextJson = this.eventAuditSnapshot(event);
    await this.prisma.calendarEventAudit.create({
      data: {
        tenantId: user.tenantId,
        eventId: event.id,
        previousJson,
        nextJson,
        createdById: user.sub,
      },
    });
    const commTurmaIds = event.isWholeSchool
      ? []
      : event.turmas.map((t) => t.turmaId);
    await this.communications.createFromCalendar({
      tenantId: user.tenantId,
      authorUserId: user.sub,
      title: `Calendário alterado: ${event.title}`,
      body: `O evento foi atualizado. Início: ${event.startsAt.toISOString()}${
        event.location ? `. Local: ${event.location}` : ''
      }.`,
      calendarEventId: event.id,
      turmaIds: commTurmaIds,
      isWholeSchool: event.isWholeSchool,
    });
    if (relevantChange) {
      const notifyTurmaIds = event.isWholeSchool
        ? (
            await this.prisma.turma.findMany({
              where: { tenantId: user.tenantId },
              select: { id: true },
            })
          ).map((t) => t.id)
        : event.turmas.map((t) => t.turmaId);
      await this.notifyEventTurmas(
        user.tenantId,
        notifyTurmaIds,
        'Treino ou evento alterado',
        `${existing.title}: horário ou local atualizados. Veja o calendário.`,
        'CAL_UPDATE',
        event.id,
      );
    }
    return event;
  }

  async cancel(user: AuthUser, id: string, dto: CancelEventDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const existing = await this.prisma.calendarEvent.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { turmas: true },
    });
    if (!existing) throw new NotFoundException();
    const turmaIds = existing.turmas.map((t) => t.turmaId);
    const previousJson = this.eventAuditSnapshot(existing);
    const canceledEvent = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        status: EventStatus.CANCELLED,
        cancelReason: dto.reason,
        canceledAt: new Date(),
        canceledById: user.sub,
      },
    });
    const nextJson = this.eventAuditSnapshot({
      title: existing.title,
      type: existing.type,
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      location: existing.location,
      turmas: existing.turmas,
      status: EventStatus.CANCELLED,
      cancelReason: dto.reason,
      canceledAt: canceledEvent.canceledAt,
    });
    await this.prisma.calendarEventAudit.create({
      data: {
        tenantId: user.tenantId,
        eventId: id,
        previousJson,
        nextJson,
        createdById: user.sub,
      },
    });
    await this.notifyEventTurmas(
      user.tenantId,
      existing.isWholeSchool
        ? (
            await this.prisma.turma.findMany({
              where: { tenantId: user.tenantId },
              select: { id: true },
            })
          ).map((t) => t.id)
        : turmaIds,
      'Evento cancelado',
      `${existing.title} foi cancelado.`,
      'CAL_CANCEL',
      id,
    );
    await this.communications.createFromCalendar({
      tenantId: user.tenantId,
      authorUserId: user.sub,
      title: `Calendário: evento cancelado — ${existing.title}`,
      body: `O evento foi cancelado. Motivo: ${dto.reason}`,
      calendarEventId: id,
      turmaIds: existing.isWholeSchool ? [] : turmaIds,
      isWholeSchool: existing.isWholeSchool,
    });
    return canceledEvent;
  }

  // ---------- Feedback físico pós-evento (RN-1325/1326) ----------

  /**
   * Apenas ADMIN pode setar/limpar o override por evento. TREINADOR não mexe
   * em config de feedback (alinhado com create/update do evento, que já são
   * restritos a ADMIN).
   */
  async setEventFeedbackDimensions(
    user: AuthUser,
    eventId: string,
    dto: SetEventFeedbackDimensionsDto,
  ) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, tenantId: user.tenantId },
    });
    if (!event) throw new NotFoundException();

    let payload: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    if (dto.unset === true || dto.dimensions === null) {
      payload = Prisma.DbNull;
    } else if (Array.isArray(dto.dimensions)) {
      const seen = new Set<string>();
      for (const d of dto.dimensions) {
        if (seen.has(d.key)) {
          throw new BadRequestException(
            `Dimensão duplicada: ${d.key}. Cada key deve aparecer apenas uma vez.`,
          );
        }
        seen.add(d.key);
      }
      const ordered = [...dto.dimensions]
        .sort((a, b) => a.order - b.order)
        .map((d, i) => ({ key: d.key, label: d.label.trim(), order: i }));
      payload = ordered as unknown as Prisma.InputJsonValue;
    } else {
      throw new BadRequestException(
        'Envie `dimensions` (array, [] ou null) ou `unset: true`.',
      );
    }

    const updated = await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { feedbackDimensions: payload },
      include: { turmas: { include: { turma: true } } },
    });
    const tenantDefault = await this.getTenantDefaultDims(user.tenantId);
    return this.decorateEvent(updated, tenantDefault);
  }

  /** Garante que o aluno pertence à conta-atleta logada e à turma do evento. */
  private async ensureAthleteCanSeeEventForStudent(
    user: AuthUser,
    eventId: string,
    studentId: string,
  ) {
    if (user.role !== UserRole.ATLETA) throw new ForbiddenException();
    const visible = await studentIdsForAccountUser(this.prisma, user);
    if (!visible.includes(studentId)) throw new ForbiddenException();
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, tenantId: user.tenantId },
      include: { turmas: true },
    });
    if (!event) throw new NotFoundException();
    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Evento cancelado não aceita feedback.');
    }
    if (!event.isWholeSchool) {
      const turmaIds = event.turmas.map((t) => t.turmaId);
      const enr = await this.prisma.enrollment.findFirst({
        where: {
          tenantId: user.tenantId,
          studentId,
          turmaId: { in: turmaIds },
        },
      });
      if (!enr) {
        throw new ForbiddenException(
          'O aluno não está matriculado em nenhuma turma deste evento.',
        );
      }
    }
    return event;
  }

  /** Submissão de feedback pelo ATLETA. Upsert por `(eventId, studentId)`. */
  async submitEventFeedback(
    user: AuthUser,
    studentId: string,
    eventId: string,
    dto: SubmitEventFeedbackDto,
  ) {
    const event = await this.ensureAthleteCanSeeEventForStudent(
      user,
      eventId,
      studentId,
    );
    const tenantDefault = await this.getTenantDefaultDims(user.tenantId);
    const dims = CalendarService.computeEffective(
      event.feedbackDimensions,
      tenantDefault,
    );
    if (!dims.length) {
      throw new BadRequestException(
        'Este evento não tem feedback configurado.',
      );
    }
    const dimByKey = new Map(dims.map((d) => [d.key, d]));
    const cleanScores: Record<string, number> = {};
    for (const [k, v] of Object.entries(dto.scores ?? {})) {
      if (!dimByKey.has(k)) {
        throw new BadRequestException(
          `Dimensão desconhecida no feedback: ${k}.`,
        );
      }
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        throw new BadRequestException(
          `Valor inválido para ${k}: precisa ser inteiro entre 1 e 5.`,
        );
      }
      cleanScores[k] = v;
    }
    if (!Object.keys(cleanScores).length) {
      throw new BadRequestException(
        'Responda pelo menos uma dimensão antes de enviar.',
      );
    }
    return this.prisma.calendarEventFeedback.upsert({
      where: {
        eventId_studentId: { eventId, studentId },
      },
      create: {
        tenantId: user.tenantId,
        eventId,
        studentId,
        submittedByUserId: user.sub,
        scores: cleanScores as unknown as Prisma.InputJsonValue,
        notes: dto.notes?.trim() || null,
      },
      update: {
        scores: cleanScores as unknown as Prisma.InputJsonValue,
        notes: dto.notes?.trim() || null,
        submittedByUserId: user.sub,
      },
    });
  }

  /**
   * Lista, para o `studentId` indicado, **eventos passados** dentro de uma
   * janela (default 14 dias) que ainda não receberam feedback do aluno e
   * possuem dimensões efetivas configuradas.
   *
   * Usado pela Home do ATLETA. RBAC: ATLETA + ownership; ou ADMIN/TREINADOR
   * com acesso ao aluno (para fins administrativos, ex.: dashboard pessoal).
   *
   * Implementação: 1 query única que já exclui eventos com feedback do aluno
   * (via `NOT { feedbacks: { some: { studentId } } }`), evitando o N+1 que o
   * frontend usava na Fase 1.
   */
  async pendingFeedbackForStudent(
    user: AuthUser,
    studentId: string,
    options: { days?: number; limit?: number } = {},
  ) {
    const days = Math.min(Math.max(options.days ?? 14, 1), 60);
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);

    // RBAC.
    if (user.role === UserRole.ATLETA) {
      const sid = await resolveActiveStudent(this.prisma, user);
      if (!sid || sid !== studentId) {
        // Permite passar explicitamente um id desde que pertença à conta.
        const owns = await this.prisma.student.findFirst({
          where: {
            id: studentId,
            tenantId: user.tenantId,
            accountUserId: user.sub,
          },
          select: { id: true },
        });
        if (!owns) throw new ForbiddenException();
      }
    } else if (user.role === UserRole.TREINADOR) {
      // TREINADOR só pode olhar alunos de suas turmas.
      const visibleTurmas = await listTurmaIdsForCoach(this.prisma, user);
      const enr = await this.prisma.enrollment.findFirst({
        where: {
          tenantId: user.tenantId,
          studentId,
          turmaId: { in: visibleTurmas ?? [] },
        },
      });
      if (!enr) throw new ForbiddenException();
    } else if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }

    // Turmas onde o aluno está matriculado (para filtrar eventos visíveis).
    const enrollments = await this.prisma.enrollment.findMany({
      where: { tenantId: user.tenantId, studentId },
      select: { turmaId: true },
      distinct: ['turmaId'],
    });
    const turmaIds = enrollments.map((e) => e.turmaId);

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60_000);

    // Tomamos um múltiplo do limite para conseguir filtrar `effectiveDims>0`
    // em memória sem perder páginas. 4x cobre tenants com poucas dims ativas.
    const fetchTake = limit * 4;
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        tenantId: user.tenantId,
        status: { not: 'CANCELLED' },
        startsAt: { gte: since, lte: now },
        OR: [
          { isWholeSchool: true },
          ...(turmaIds.length
            ? [{ turmas: { some: { turmaId: { in: turmaIds } } } }]
            : []),
        ],
        feedbacks: { none: { studentId } },
      },
      orderBy: [{ startsAt: 'desc' }],
      take: fetchTake,
      include: { turmas: { include: { turma: true } } },
    });

    const tenantDefault = await this.getTenantDefaultDims(user.tenantId);
    const decorated = events
      .map((e) => this.decorateEvent(e, tenantDefault))
      .filter((e) => e.effectiveFeedbackDimensions.length > 0)
      .slice(0, limit);

    return {
      studentId,
      windowDays: days,
      events: decorated,
    };
  }

  /** Resposta atual do aluno ativo para um evento (null se não respondeu). */
  async getEventFeedbackForAthlete(
    user: AuthUser,
    studentId: string,
    eventId: string,
  ) {
    await this.ensureAthleteCanSeeEventForStudent(user, eventId, studentId);
    return this.prisma.calendarEventFeedback.findUnique({
      where: { eventId_studentId: { eventId, studentId } },
    });
  }

  /**
   * Relatório do evento (ADMIN/TREINADOR com acesso). Calcula médias usando
   * as dims efetivas e devolve a lista de submissões com aluno e autor.
   */
  async getEventFeedbackReport(user: AuthUser, eventId: string) {
    // Reaproveita o `get` para já validar acesso ao evento; ele inclui as
    // dims efetivas decoradas.
    const decorated = await this.get(user, eventId);
    if (user.role === UserRole.ATLETA) {
      throw new ForbiddenException();
    }
    const dims = (decorated as unknown as {
      effectiveFeedbackDimensions: FeedbackDimension[];
    }).effectiveFeedbackDimensions;
    const feedbacks = await this.prisma.calendarEventFeedback.findMany({
      where: { tenantId: user.tenantId, eventId },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        student: { select: { id: true, fullName: true, active: true } },
        submittedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });
    const averages = dims.map((d) => {
      let sum = 0;
      let count = 0;
      for (const f of feedbacks) {
        const scores = (f.scores ?? {}) as Record<string, unknown>;
        const v = scores[d.key];
        if (typeof v === 'number' && v >= 1 && v <= 5) {
          sum += v;
          count++;
        }
      }
      return {
        key: d.key,
        label: d.label,
        count,
        average: count ? Math.round((sum / count) * 100) / 100 : null,
      };
    });
    return {
      eventId,
      effectiveFeedbackDimensions: dims,
      averages,
      feedbacks,
    };
  }

  /**
   * Histórico cronológico do aluno em **todos os eventos** do tenant. Inclui
   * dimensões efetivas no momento da consulta para que a UI possa renderizar.
   */
  async getStudentEventFeedbackHistory(user: AuthUser, studentId: string) {
    if (user.role === UserRole.ATLETA) throw new ForbiddenException();
    if (user.role === UserRole.TREINADOR) {
      // TREINADOR só pode ver alunos das suas turmas — vamos validar.
      const visibleTurmas = await listTurmaIdsForCoach(this.prisma, user);
      const enr = await this.prisma.enrollment.findFirst({
        where: {
          tenantId: user.tenantId,
          studentId,
          turmaId: { in: visibleTurmas ?? [] },
        },
      });
      if (!enr) throw new ForbiddenException();
    }
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tenantId },
      select: { id: true, fullName: true, active: true },
    });
    if (!student) throw new NotFoundException();
    const tenantDefault = await this.getTenantDefaultDims(user.tenantId);
    const rows = await this.prisma.calendarEventFeedback.findMany({
      where: { tenantId: user.tenantId, studentId },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        event: {
          select: {
            id: true,
            title: true,
            type: true,
            startsAt: true,
            feedbackDimensions: true,
          },
        },
        submittedByUser: { select: { id: true, fullName: true } },
      },
    });
    return {
      student,
      feedbacks: rows.map((r) => ({
        ...r,
        event: {
          ...r.event,
          effectiveFeedbackDimensions: CalendarService.computeEffective(
            r.event.feedbackDimensions,
            tenantDefault,
          ),
        },
      })),
    };
  }
}
