import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_CATEGORY_META,
  NOTIFICATION_NON_OPTIONAL_TYPES,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  isValidPreferenceCategory,
  notificationPreferenceCategory,
} from './notification-categories';
import { buildInAppListPreview } from './in-app-list-preview';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPreferences(tenantId: string, userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { tenantId, userId },
    });
    const byCat = new Map(rows.map((r) => [r.category, r.inAppEnabled]));
    return NOTIFICATION_CATEGORY_META.map((meta) => ({
      category: meta.category,
      label: meta.label,
      description: meta.description,
      requiredInApp: meta.requiredInApp,
      inAppEnabled: meta.requiredInApp
        ? true
        : (byCat.get(meta.category) ?? true),
    }));
  }

  async upsertPreferences(
    tenantId: string,
    userId: string,
    entries: { category: string; inAppEnabled: boolean }[],
  ) {
    for (const e of entries) {
      if (!isValidPreferenceCategory(e.category)) continue;
      const inAppEnabled = NOTIFICATION_NON_OPTIONAL_TYPES.has(e.category)
        ? true
        : e.inAppEnabled;
      await this.prisma.notificationPreference.upsert({
        where: {
          userId_category: { userId, category: e.category },
        },
        create: {
          tenantId,
          userId,
          category: e.category,
          inAppEnabled,
        },
        update: { inAppEnabled },
      });
    }
    return this.listPreferences(tenantId, userId);
  }

  private async filterUserIdsByInAppPreference(
    tenantId: string,
    userIds: string[],
    notificationType: string,
    bypassPreferenceMute?: boolean,
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    if (bypassPreferenceMute) return [...new Set(userIds)].filter(Boolean);
    if (NOTIFICATION_NON_OPTIONAL_TYPES.has(notificationType)) {
      return userIds;
    }
    const prefCat = notificationPreferenceCategory(notificationType);
    if (
      !(NOTIFICATION_PREFERENCE_CATEGORIES as readonly string[]).includes(
        prefCat,
      )
    ) {
      return userIds;
    }
    const muted = await this.prisma.notificationPreference.findMany({
      where: {
        tenantId,
        userId: { in: userIds },
        category: prefCat,
        inAppEnabled: false,
      },
      select: { userId: true },
    });
    const mutedSet = new Set(muted.map((m) => m.userId));
    return userIds.filter((id) => !mutedSet.has(id));
  }

  async emitToUsers(input: {
    tenantId: string;
    userIds: string[];
    type: string;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
    dedupeKey?: string;
    /** RN-1304: publicação TRATAMENTO ignora silenciamento da categoria. */
    bypassPreferenceMute?: boolean;
  }) {
    let unique = [...new Set(input.userIds)].filter(Boolean);
    unique = await this.filterUserIdsByInAppPreference(
      input.tenantId,
      unique,
      input.type,
      input.bypassPreferenceMute,
    );
    if (unique.length === 0) return;
    const data = unique.map((userId) => ({
      tenantId: input.tenantId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payloadJson: input.payload ?? undefined,
      dedupeKey: input.dedupeKey ?? undefined,
    }));
    if (input.dedupeKey) {
      await this.prisma.notification.createMany({
        data,
        skipDuplicates: true,
      });
    } else {
      await this.prisma.notification.createMany({ data });
    }
  }

  /**
   * Notifica a conta-atleta do aluno com título/body já seguros
   * (CA-03.02 / RN-1304). `payloadJson` só pode conter campos não sensíveis
   * (ex.: `studentName`). Para responsáveis legais que precisem ser
   * comunicados por canais externos (e-mail/SMS), use `Guardian` separadamente.
   */
  async notifyIndividualPlanEvent(input: {
    tenantId: string;
    studentId: string;
    notificationType:
      | 'INDIVIDUAL_PLAN_PUBLISHED'
      | 'INDIVIDUAL_PLAN_UPDATED'
      | 'INDIVIDUAL_PLAN_PAUSED'
      | 'INDIVIDUAL_PLAN_RESUMED'
      | 'INDIVIDUAL_PLAN_COMPLETED'
      | 'INDIVIDUAL_PLAN_CANCELLED';
    title: string;
    body: string;
    dedupeKey: string;
    bypassPreferenceMute?: boolean;
    payload?: Prisma.InputJsonValue;
  }) {
    const userIds = await this.recipientUserIdsForStudent(
      input.tenantId,
      input.studentId,
    );
    await this.emitToUsers({
      tenantId: input.tenantId,
      userIds,
      type: input.notificationType,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey,
      bypassPreferenceMute: input.bypassPreferenceMute,
      payload: input.payload,
    });
  }

  /**
   * Destinatários in-app das turmas: as contas-atleta (`Student.accountUser`)
   * dos alunos matriculados. Uma mesma conta-atleta atendendo N irmãos é
   * retornada uma única vez (RN-200 — switcher).
   */
  async recipientUserIdsForTurmas(tenantId: string, turmaIds: string[]) {
    if (turmaIds.length === 0) return [];
    const enrollments = await this.prisma.enrollment.findMany({
      where: { tenantId, turmaId: { in: turmaIds } },
      select: { student: { select: { accountUserId: true } } },
    });
    const ids = new Set<string>();
    for (const e of enrollments) {
      if (e.student.accountUserId) ids.add(e.student.accountUserId);
    }
    return [...ids];
  }

  /** Destinatário in-app de um aluno: a conta-atleta vinculada. */
  async recipientUserIdsForStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: studentId },
      select: { accountUserId: true },
    });
    if (!student?.accountUserId) return [];
    return [student.accountUserId];
  }

  /** Lista in-app com `body` substituído por preview seguro (A5 / CA-03.02). */
  async listInAppForUser(
    tenantId: string,
    userId: string,
    options: { cursor?: string; take: number },
  ) {
    const take = options.take;
    const rows = await this.prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    });
    return rows.map((r) => {
      const meta = NOTIFICATION_CATEGORY_META.find(
        (m) => m.category === r.type,
      );
      const title =
        r.type === 'COMMS' ? (meta?.label ?? 'Comunicados') : r.title;
      return {
        ...r,
        title,
        body: buildInAppListPreview({
          type: r.type,
          title: r.title,
          body: r.body,
          payloadJson: r.payloadJson,
        }),
      };
    });
  }
}
