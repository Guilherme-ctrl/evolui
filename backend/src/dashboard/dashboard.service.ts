import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  FeedbackDimension,
  parseFeedbackDimensions,
} from '../tenant-settings/tenant-settings.service';

/**
 * Retenção (CA-13.02): alunos ativos no fim do período / alunos ativos no início do período.
 * Período default: mês civil (from/to).
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async load(user: AuthUser, fromIso?: string, toIso?: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const to = toIso ? new Date(toIso) : new Date();
    const from = fromIso
      ? new Date(fromIso)
      : new Date(to.getFullYear(), to.getMonth(), 1);
    const tenantId = user.tenantId;

    const [activeStudents, inactiveStudents, turmas, charges] =
      await Promise.all([
        this.prisma.student.count({
          where: { tenantId, active: true },
        }),
        this.prisma.student.count({
          where: { tenantId, active: false },
        }),
        this.prisma.turma.findMany({
          where: { tenantId },
          include: { _count: { select: { enrollments: true } } },
        }),
        this.prisma.financialCharge.findMany({
          where: {
            tenantId,
            status: 'ATRASADO',
          },
        }),
      ]);

    const attendanceSessions = await this.prisma.attendanceSession.count({
      where: {
        tenantId,
        finalizedAt: { gte: from, lte: to },
      },
    });
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        session: {
          tenantId,
          finalizedAt: { gte: from, lte: to },
        },
      },
      select: { present: true },
    });
    const presentCount = attendanceRecords.filter((r) => r.present).length;
    const totalMarks = attendanceRecords.length;
    const avgPresenceRate =
      totalMarks > 0
        ? Math.round((1000 * presentCount) / totalMarks) / 10
        : null;

    const delinquentCents = charges.reduce((s, c) => s + c.amountCents, 0);

    const turmasOcupacao = turmas.map((t) => ({
      turmaId: t.id,
      name: t.name,
      enrolled: t._count.enrollments,
      capacity: t.capacity,
      pct:
        t.capacity > 0
          ? Math.round((1000 * t._count.enrollments) / t.capacity) / 10
          : 0,
    }));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      students: { active: activeStudents, inactive: inactiveStudents },
      attendance: {
        sessionsClosed: attendanceSessions,
        avgPresenceRatePct: avgPresenceRate,
      },
      finance: {
        delinquentCharges: charges.length,
        delinquentAmountCents: delinquentCents,
      },
      turmas: turmasOcupacao,
      retentionNote:
        'Retenção = ativos fim / ativos início do período (ajuste futuro com snapshot).',
    };
  }

  async exportSnapshot(user: AuthUser, fromIso?: string, toIso?: string) {
    const data = await this.load(user, fromIso, toIso);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Agregador único para a Home do Admin: 1 chamada substitui as ~5 do
   * front (dashboard + staff + delinquency + evaluations summary + overview
   * semanal). Sempre devolve um shape estável (zeros/null para vazios).
   */
  async home(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const tenantId = user.tenantId;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // Semana ISO (segunda → domingo).
    const dow = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Mês civil corrente (KPI avaliações).
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const [
      tenant,
      activeStudents,
      inactiveStudents,
      staffCount,
      delinqCharges,
      todayEventsRaw,
      weekEventsRaw,
      distinctEvalRows,
      totalEvalThisMonth,
    ] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { defaultFeedbackDimensions: true },
      }),
      this.prisma.student.count({ where: { tenantId, active: true } }),
      this.prisma.student.count({ where: { tenantId, active: false } }),
      this.prisma.staffProfile.count({
        where: {
          tenantId,
          active: true,
          user: { is: { active: true } },
        },
      }),
      this.prisma.financialCharge.findMany({
        where: {
          tenantId,
          status: { in: ['PENDENTE', 'ATRASADO'] },
        },
        orderBy: { dueDate: 'asc' },
        include: {
          student: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          tenantId,
          startsAt: { gte: startOfToday, lt: endOfToday },
          status: { not: 'CANCELLED' },
        },
        orderBy: { startsAt: 'asc' },
        include: {
          turmas: { include: { turma: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          tenantId,
          startsAt: { gte: weekStart, lt: weekEnd },
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          startsAt: true,
          feedbackDimensions: true,
          _count: { select: { feedbacks: true } },
        },
      }),
      this.prisma.evaluation.findMany({
        where: { tenantId, evaluatedAt: { gte: monthStart, lte: monthEnd } },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
      this.prisma.evaluation.count({
        where: { tenantId, evaluatedAt: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    // --- Finanças --------------------------------------------------------
    const delinquentCharges = delinqCharges.length;
    const delinquentAmountCents = delinqCharges.reduce(
      (s, c) => s + c.amountCents,
      0,
    );
    type AggRow = {
      studentId: string;
      fullName: string;
      charges: number;
      totalCents: number;
      oldestDueDate: Date;
    };
    const byStudent = new Map<string, AggRow>();
    for (const c of delinqCharges) {
      const cur = byStudent.get(c.student.id);
      if (cur) {
        cur.charges += 1;
        cur.totalCents += c.amountCents;
        if (c.dueDate < cur.oldestDueDate) cur.oldestDueDate = c.dueDate;
      } else {
        byStudent.set(c.student.id, {
          studentId: c.student.id,
          fullName: c.student.fullName,
          charges: 1,
          totalCents: c.amountCents,
          oldestDueDate: c.dueDate,
        });
      }
    }
    const topStudents = Array.from(byStudent.values())
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, 3)
      .map((r) => ({
        studentId: r.studentId,
        fullName: r.fullName,
        charges: r.charges,
        totalCents: r.totalCents,
        oldestDueDate: r.oldestDueDate.toISOString(),
        daysOverdue: Math.max(
          0,
          Math.floor(
            (now.getTime() - r.oldestDueDate.getTime()) / (24 * 60 * 60_000),
          ),
        ),
      }));

    // --- Eventos de hoje -------------------------------------------------
    const byType: Record<string, number> = {};
    for (const e of todayEventsRaw) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
    }
    const todayItems = todayEventsRaw.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      status: e.status,
      isWholeSchool: e.isWholeSchool,
      turmas: e.turmas.map((t) => ({
        turmaId: t.turmaId,
        turma: { id: t.turma.id, name: t.turma.name },
      })),
    }));

    // --- KPI Feedback físico (semana até agora) --------------------------
    const tenantDefaultDims: FeedbackDimension[] = parseFeedbackDimensions(
      tenant.defaultFeedbackDimensions as Prisma.JsonValue,
    );
    let eligible = 0;
    let withFeedback = 0;
    for (const e of weekEventsRaw) {
      if (e.startsAt > now) continue; // só conta o que já aconteceu
      const eff =
        e.feedbackDimensions == null
          ? tenantDefaultDims
          : parseFeedbackDimensions(e.feedbackDimensions);
      if (eff.length === 0) continue;
      eligible += 1;
      if (e._count.feedbacks > 0) withFeedback += 1;
    }
    const physicalFeedbackWeek = {
      eligible,
      withFeedback,
      pct:
        eligible === 0
          ? null
          : Math.round((1000 * withFeedback) / eligible) / 10,
      windowFrom: weekStart.toISOString(),
      windowTo: now.toISOString(),
    };

    // --- KPI Avaliações pedagógicas (mês) --------------------------------
    const evaluations = {
      periodFrom: monthStart.toISOString(),
      periodTo: monthEnd.toISOString(),
      activeStudents,
      distinctStudentsEvaluated: distinctEvalRows.length,
      totalEvaluations: totalEvalThisMonth,
      percentage:
        activeStudents > 0
          ? Math.round((1000 * distinctEvalRows.length) / activeStudents) / 10
          : null,
    };

    return {
      generatedAt: now.toISOString(),
      students: { active: activeStudents, inactive: inactiveStudents },
      professionalsActive: staffCount,
      finance: {
        delinquentCharges,
        delinquentAmountCents,
        topStudents,
      },
      todayEvents: {
        total: todayEventsRaw.length,
        byType,
        items: todayItems,
      },
      physicalFeedbackWeek,
      evaluations,
    };
  }
}
