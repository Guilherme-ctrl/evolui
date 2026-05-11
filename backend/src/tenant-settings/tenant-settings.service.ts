import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { SetTenantFeedbackDimensionsDto } from './dto/set-tenant-feedback-dimensions.dto';

export type FeedbackDimension = { key: string; label: string; order: number };

/**
 * Normaliza um valor JSON cru vindo de `Tenant.defaultFeedbackDimensions` ou
 * `CalendarEvent.feedbackDimensions` em um array ordenado, descartando entradas
 * malformadas. Centraliza a parse para que controllers e relatórios usem a
 * mesma definição.
 */
export function parseFeedbackDimensions(value: unknown): FeedbackDimension[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (x): x is FeedbackDimension =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as Record<string, unknown>).key === 'string' &&
        typeof (x as Record<string, unknown>).label === 'string',
    )
    .map((x, i) => ({
      key: x.key,
      label: x.label,
      order: typeof x.order === 'number' ? x.order : i,
    }))
    .sort((a, b) => a.order - b.order);
}

@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista o tenant resolvido + dimensões parseadas. */
  async getFeedbackDimensions(user: AuthUser) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { id: true, name: true, defaultFeedbackDimensions: true },
    });
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      dimensions: parseFeedbackDimensions(tenant.defaultFeedbackDimensions),
    };
  }

  async setFeedbackDimensions(
    user: AuthUser,
    dto: SetTenantFeedbackDimensionsDto,
  ) {
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
    await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        defaultFeedbackDimensions:
          ordered as unknown as Prisma.InputJsonValue,
      },
    });
    return this.getFeedbackDimensions(user);
  }
}
