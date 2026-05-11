import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CommunicationScope, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { ensureCoachTurma } from '../common/permissions/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** IDs das contas-atleta ativas do tenant (destinatários in-app GLOBAL). */
  private async athleteUserIdsInTenant(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: UserRole.ATLETA, active: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async createFromCalendar(input: {
    tenantId: string;
    authorUserId: string;
    title: string;
    body: string;
    calendarEventId: string;
    turmaIds: string[];
    isWholeSchool: boolean;
  }) {
    const recipientUserIds = input.isWholeSchool
      ? await this.athleteUserIdsInTenant(input.tenantId)
      : await this.notifications.recipientUserIdsForTurmas(
          input.tenantId,
          input.turmaIds,
        );
    return this.createWithRecipients({
      tenantId: input.tenantId,
      authorUserId: input.authorUserId,
      scope: CommunicationScope.GLOBAL,
      title: input.title,
      body: input.body,
      calendarEventId: input.calendarEventId,
      recipientUserIds,
    });
  }

  async createWithRecipients(data: {
    tenantId: string;
    authorUserId: string;
    scope: CommunicationScope;
    turmaId?: string | null;
    title: string;
    body: string;
    calendarEventId?: string | null;
    recipientUserId?: string | null;
    recipientUserIds: string[];
  }) {
    const msg = await this.prisma.communicationMessage.create({
      data: {
        tenantId: data.tenantId,
        scope: data.scope,
        turmaId: data.turmaId ?? undefined,
        title: data.title,
        body: data.body,
        authorUserId: data.authorUserId,
        calendarEventId: data.calendarEventId ?? undefined,
        recipientUserId: data.recipientUserId ?? undefined,
      },
    });
    const unique = [...new Set(data.recipientUserIds)].filter(Boolean);
    if (unique.length) {
      await this.prisma.communicationRecipient.createMany({
        data: unique.map((userId) => ({ messageId: msg.id, userId })),
        skipDuplicates: true,
      });
    }
    await this.notifications.emitToUsers({
      tenantId: data.tenantId,
      userIds: unique,
      type: 'COMMS',
      title: data.title,
      body: data.body.slice(0, 200),
    });
    return msg;
  }

  async create(user: AuthUser, dto: CreateMessageDto) {
    if (dto.scope === CommunicationScope.GLOBAL) {
      if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
      const recipientUserIds = await this.athleteUserIdsInTenant(
        user.tenantId,
      );
      return this.createWithRecipients({
        tenantId: user.tenantId,
        authorUserId: user.sub,
        scope: CommunicationScope.GLOBAL,
        title: dto.title,
        body: dto.body,
        calendarEventId: dto.calendarEventId,
        recipientUserIds,
      });
    }
    if (dto.scope === CommunicationScope.TURMA) {
      if (!dto.turmaId) throw new BadRequestException('turmaId obrigatório');
      await ensureCoachTurma(this.prisma, user, dto.turmaId);
      const recipientUserIds =
        await this.notifications.recipientUserIdsForTurmas(user.tenantId, [
          dto.turmaId,
        ]);
      return this.createWithRecipients({
        tenantId: user.tenantId,
        authorUserId: user.sub,
        scope: CommunicationScope.TURMA,
        turmaId: dto.turmaId,
        title: dto.title,
        body: dto.body,
        calendarEventId: dto.calendarEventId,
        recipientUserIds,
      });
    }
    if (dto.scope === CommunicationScope.DIRECT) {
      if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
      if (!dto.recipientUserId) {
        throw new BadRequestException('recipientUserId obrigatório');
      }
      return this.createWithRecipients({
        tenantId: user.tenantId,
        authorUserId: user.sub,
        scope: CommunicationScope.DIRECT,
        title: dto.title,
        body: dto.body,
        calendarEventId: dto.calendarEventId,
        recipientUserId: dto.recipientUserId,
        recipientUserIds: [dto.recipientUserId],
      });
    }
    throw new BadRequestException('Escopo inválido');
  }

  async listAuthored(
    user: AuthUser,
    opts: {
      cursor?: string;
      take?: number;
      scope?: CommunicationScope;
      turmaId?: string;
    },
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.TREINADOR) {
      throw new ForbiddenException();
    }
    const cap = Math.min(opts.take ?? 30, 100);
    const where: {
      tenantId: string;
      authorUserId: string;
      scope?: CommunicationScope;
      turmaId?: string;
    } = {
      tenantId: user.tenantId,
      authorUserId: user.sub,
    };
    if (opts.scope) where.scope = opts.scope;
    if (opts.turmaId) where.turmaId = opts.turmaId;
    return this.prisma.communicationMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: cap + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: {
        turma: { select: { id: true, name: true } },
        calendarEvent: {
          select: { id: true, title: true, startsAt: true },
        },
      },
    });
  }

  async inbox(user: AuthUser, cursor?: string, take = 30) {
    const cap = Math.min(take, 100);
    const messages = await this.prisma.communicationMessage.findMany({
      where: {
        tenantId: user.tenantId,
        recipients: { some: { userId: user.sub } },
      },
      orderBy: { createdAt: 'desc' },
      take: cap + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        recipients: { where: { userId: user.sub } },
        author: { select: { fullName: true } },
        calendarEvent: true,
      },
    });
    return messages;
  }

  async markRead(user: AuthUser, messageId: string) {
    await this.prisma.communicationRecipient.updateMany({
      where: { messageId, userId: user.sub },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
