import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  ensureCanReadStudent,
  ensureStudentInTenant,
} from '../common/permissions/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReportDto } from './dto/create-report.dto';
import { AggregateReportDto } from './dto/aggregate-report.dto';
import type { ReportAggregate } from './report-aggregate.types';

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayEnd(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function scoreToNumber(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const map: Record<string, number> = {
      Excelente: 5,
      'Muito bom': 4,
      Bom: 3,
      'Precisa melhorar': 2,
    };
    return map[v] ?? null;
  }
  return null;
}

function firstName(fullName: string): string {
  const t = fullName.trim().split(/\s+/)[0];
  return t || 'Atleta';
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async buildAggregate(
    tenantId: string,
    studentId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ReportAggregate> {
    await ensureStudentInTenant(this.prisma, tenantId, studentId);
    const start = dayStart(periodStart);
    const end = dayEnd(periodEnd);
    if (start > end) {
      throw new BadRequestException(
        'periodStart deve ser anterior a periodEnd.',
      );
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        session: {
          tenantId,
          finalizedAt: { not: null },
          event: {
            startsAt: { gte: start, lte: end },
          },
        },
      },
      select: {
        present: true,
        sessionId: true,
      },
    });
    const sessionIds = [...new Set(records.map((r) => r.sessionId))];
    const presentCount = records.filter((r) => r.present).length;
    const absentCount = records.filter((r) => !r.present).length;
    const totalMarks = presentCount + absentCount;
    const ratePct =
      totalMarks > 0 ? Math.round((100 * presentCount) / totalMarks) : 0;

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        tenantId,
        studentId,
        evaluatedAt: { gte: start, lte: end },
      },
      select: { scores: true },
    });

    const dimSums: Record<string, { sum: number; n: number }> = {};
    for (const ev of evaluations) {
      const scores = ev.scores as Record<string, unknown>;
      if (!scores || typeof scores !== 'object') continue;
      for (const [k, v] of Object.entries(scores)) {
        const num = scoreToNumber(v);
        if (num === null) continue;
        if (!dimSums[k]) dimSums[k] = { sum: 0, n: 0 };
        dimSums[k].sum += num;
        dimSums[k].n += 1;
      }
    }
    const avgByDimension: Record<string, number | null> = {};
    for (const [k, { sum, n }] of Object.entries(dimSums)) {
      avgByDimension[k] = n > 0 ? Math.round((sum / n) * 10) / 10 : null;
    }

    const mediaCount = await this.prisma.mediaAsset.count({
      where: {
        tenantId,
        studentTags: { some: { studentId } },
        createdAt: { gte: start, lte: end },
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { tenantId, studentId },
      select: { turmaId: true },
    });
    const turmaIds = [...new Set(enrollments.map((e) => e.turmaId))];

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        tenantId,
        startsAt: { gte: start, lte: end },
        OR: [
          { isWholeSchool: true },
          ...(turmaIds.length
            ? [{ turmas: { some: { turmaId: { in: turmaIds } } } }]
            : []),
        ],
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        type: true,
        status: true,
      },
      orderBy: { startsAt: 'asc' },
    });

    return {
      attendance: {
        sessions: sessionIds.length,
        presentCount,
        absentCount,
        ratePct,
      },
      evaluations: {
        count: evaluations.length,
        avgByDimension,
      },
      mediaCount,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        type: e.type,
        status: e.status,
      })),
    };
  }

  buildSummaryText(
    aggregate: ReportAggregate,
    studentFullName: string,
  ): string {
    const name = firstName(studentFullName);
    const {
      attendance: a,
      evaluations: ev,
      mediaCount,
      events: evs,
    } = aggregate;
    const dimEntries = Object.entries(ev.avgByDimension).filter(
      ([, v]) => v != null,
    );
    const dimPhrase =
      dimEntries.length > 0
        ? ` As médias registradas nas dimensões acompanhadas indicam evolução constante (${dimEntries
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')}).`
        : '';
    return (
      `Olá! Este relatório cobre o desempenho de ${name} no período. ` +
      `Houve ${a.sessions} sessão(ões) de presença contabilizada(s), com taxa de comparecimento de ${a.ratePct}% ` +
      `(${a.presentCount} presenças e ${a.absentCount} ausências registradas). ` +
      `Foram feitas ${ev.count} avaliação(ões) no intervalo.${dimPhrase} ` +
      `Há ${mediaCount} mídia(s) vinculada(s) a ${name} e ${evs.length} evento(s) no calendário da escolinha no período. ` +
      `Seguimos incentivando o compromisso com os treinos e a diversão em campo — qualquer dúvida, fale com a equipe.`
    );
  }

  async createFromAggregate(user: AuthUser, dto: AggregateReportDto) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TREINADOR) {
      throw new ForbiddenException();
    }
    await ensureCanReadStudent(this.prisma, user, dto.studentId);
    const student = await ensureStudentInTenant(
      this.prisma,
      user.tenantId,
      dto.studentId,
    );
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const dataJson = await this.buildAggregate(
      user.tenantId,
      dto.studentId,
      periodStart,
      periodEnd,
    );
    const summaryText = this.buildSummaryText(dataJson, student.fullName);
    return this.prisma.report.create({
      data: {
        tenantId: user.tenantId,
        studentId: dto.studentId,
        periodStart,
        periodEnd,
        title: dto.title,
        summaryText,
        dataJson: dataJson as unknown as Prisma.InputJsonValue,
        status: ReportStatus.DRAFT,
        createdById: user.sub,
      },
      include: { student: { select: { id: true, fullName: true } } },
    });
  }

  async createDraft(user: AuthUser, dto: CreateReportDto) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TREINADOR) {
      throw new ForbiddenException();
    }
    await ensureCanReadStudent(this.prisma, user, dto.studentId);
    return this.prisma.report.create({
      data: {
        tenantId: user.tenantId,
        studentId: dto.studentId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        title: dto.title,
        summaryText: dto.summaryText,
        dataJson: dto.dataJson
          ? (dto.dataJson as Prisma.InputJsonValue)
          : undefined,
        status: ReportStatus.DRAFT,
        createdById: user.sub,
      },
    });
  }

  async publish(user: AuthUser, id: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const report = await this.prisma.report.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!report) throw new NotFoundException();
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: ReportStatus.PUBLISHED, publishedAt: new Date() },
    });
    const userIds = await this.notifications.recipientUserIdsForStudent(
      user.tenantId,
      report.studentId,
    );
    const studentRow = await this.prisma.student.findFirst({
      where: { id: report.studentId, tenantId: user.tenantId },
      select: { fullName: true },
    });
    await this.notifications.emitToUsers({
      tenantId: user.tenantId,
      userIds,
      type: 'REPORT',
      title: 'Novo relatório publicado',
      body: report.title,
      payload: studentRow?.fullName
        ? { studentName: studentRow.fullName }
        : undefined,
      dedupeKey: `REPORT:${id}`,
    });
    return updated;
  }

  async listRecentAdmin(user: AuthUser, take = 50) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const cap = Math.min(take, 100);
    return this.prisma.report.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: cap,
      include: { student: { select: { id: true, fullName: true } } },
    });
  }

  async getOne(user: AuthUser, id: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (!report) throw new NotFoundException();
    if (user.role === UserRole.ADMIN) return report;
    if (user.role === UserRole.ATLETA) {
      if (report.status !== ReportStatus.PUBLISHED) {
        throw new ForbiddenException();
      }
      await ensureCanReadStudent(this.prisma, user, report.studentId);
      return report;
    }
    if (user.role === UserRole.TREINADOR) {
      await ensureCanReadStudent(this.prisma, user, report.studentId);
      return report;
    }
    throw new ForbiddenException();
  }

  async listForStudent(user: AuthUser, studentId: string) {
    await ensureCanReadStudent(this.prisma, user, studentId);
    return this.prisma.report.findMany({
      where: {
        tenantId: user.tenantId,
        studentId,
        status: ReportStatus.PUBLISHED,
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async generateMonthlyIfEnabled(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    if (process.env.REPORTS_MONTHLY_GENERATE !== 'true') {
      throw new ForbiddenException(
        'Geração mensal desligada (REPORTS_MONTHLY_GENERATE).',
      );
    }
    const now = new Date();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const students = await this.prisma.student.findMany({
      where: { tenantId: user.tenantId, active: true },
      select: { id: true, fullName: true },
    });
    const created: string[] = [];
    for (const s of students) {
      const dataJson = await this.buildAggregate(
        user.tenantId,
        s.id,
        lastMonthStart,
        lastMonthEnd,
      );
      const summaryText = this.buildSummaryText(dataJson, s.fullName);
      const rep = await this.prisma.report.create({
        data: {
          tenantId: user.tenantId,
          studentId: s.id,
          periodStart: lastMonthStart,
          periodEnd: lastMonthEnd,
          title: `Relatório ${lastMonthStart.toISOString().slice(0, 7)} — ${firstName(s.fullName)}`,
          summaryText,
          dataJson: dataJson as unknown as Prisma.InputJsonValue,
          status: ReportStatus.DRAFT,
          createdById: user.sub,
        },
      });
      created.push(rep.id);
    }
    return { created: created.length, ids: created };
  }
}
