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
  ensureCanReadStudent,
  ensureCoachTurma,
} from '../common/permissions/scope';
import { OpenSessionDto } from './dto/open-session.dto';
import { FinalizeSessionDto } from './dto/finalize-session.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async openSession(user: AuthUser, dto: OpenSessionDto) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TREINADOR) {
      throw new ForbiddenException();
    }
    await ensureCoachTurma(this.prisma, user, dto.turmaId);
    const link = await this.prisma.calendarEventTurma.findUnique({
      where: {
        eventId_turmaId: { eventId: dto.eventId, turmaId: dto.turmaId },
      },
    });
    if (!link) {
      throw new BadRequestException('Evento não pertence à turma.');
    }
    const existing = await this.prisma.attendanceSession.findUnique({
      where: {
        turmaId_eventId: { turmaId: dto.turmaId, eventId: dto.eventId },
      },
    });
    const session = await this.prisma.attendanceSession.upsert({
      where: {
        turmaId_eventId: { turmaId: dto.turmaId, eventId: dto.eventId },
      },
      create: {
        tenantId: user.tenantId,
        turmaId: dto.turmaId,
        eventId: dto.eventId,
        mode: dto.mode,
      },
      update: { mode: dto.mode, reopenedAt: new Date() },
      include: {
        event: true,
        turma: true,
      },
    });
    if (existing) {
      await this.prisma.attendanceReopenAudit.create({
        data: {
          tenantId: user.tenantId,
          sessionId: session.id,
          reopenedById: user.sub,
        },
      });
    }
    return session;
  }

  async getSession(user: AuthUser, sessionId: string) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId: user.tenantId },
      include: {
        records: true,
        turma: true,
        event: true,
      },
    });
    if (!session) throw new NotFoundException();
    await ensureCoachTurma(this.prisma, user, session.turmaId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { turmaId: session.turmaId, tenantId: user.tenantId },
      include: { student: true },
    });
    return { session, enrollments };
  }

  async finalize(user: AuthUser, sessionId: string, dto: FinalizeSessionDto) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TREINADOR) {
      throw new ForbiddenException();
    }
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: sessionId, tenantId: user.tenantId },
    });
    if (!session) throw new NotFoundException();
    await ensureCoachTurma(this.prisma, user, session.turmaId);
    const studentIds = await this.prisma.enrollment.findMany({
      where: { turmaId: session.turmaId, tenantId: user.tenantId },
      select: { studentId: true },
    });
    const allowed = new Set(studentIds.map((s) => s.studentId));
    for (const r of dto.records) {
      if (!allowed.has(r.studentId))
        throw new BadRequestException('Aluno fora da turma.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.deleteMany({ where: { sessionId } });
      if (dto.records.length) {
        await tx.attendanceRecord.createMany({
          data: dto.records.map((r) => ({
            sessionId,
            studentId: r.studentId,
            present: r.present,
          })),
        });
      }
      await tx.attendanceSession.update({
        where: { id: sessionId },
        data: {
          finalizedAt: new Date(),
          finalizedById: user.sub,
        },
      });
    });
    return this.prisma.attendanceSession.findFirst({
      where: { id: sessionId },
      include: { records: true },
    });
  }

  async historyForStudent(user: AuthUser, studentId: string) {
    await ensureCanReadStudent(this.prisma, user, studentId);
    return this.prisma.attendanceRecord.findMany({
      where: { studentId, session: { tenantId: user.tenantId } },
      orderBy: { id: 'desc' },
      include: {
        session: { include: { event: true, turma: true } },
      },
      take: 200,
    });
  }
}
