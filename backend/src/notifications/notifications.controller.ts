import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('preferences')
  listPreferences(@CurrentUser() user: AuthUser) {
    return this.notifications.listPreferences(user.tenantId, user.sub);
  }

  @Post('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.upsertPreferences(
      user.tenantId,
      user.sub,
      dto.preferences,
    );
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Number(takeRaw ?? 20) || 20, 100);
    return this.notifications.listInAppForUser(user.tenantId, user.sub, {
      cursor,
      take,
    });
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prisma.notification.updateMany({
      where: { id, tenantId: user.tenantId, userId: user.sub },
      data: { readAt: new Date() },
    });
  }
}
