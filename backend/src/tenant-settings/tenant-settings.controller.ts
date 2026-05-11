import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { SetTenantFeedbackDimensionsDto } from './dto/set-tenant-feedback-dimensions.dto';
import { TenantSettingsService } from './tenant-settings.service';

/**
 * Configurações do tenant (ADMIN). Por enquanto cobre apenas as dimensões
 * padrão de feedback físico pós-evento (RN-1325). Como a leitura é necessária
 * também para professores ao montar evento, o GET é liberado para ADMIN e
 * TREINADOR — apenas o PUT é restrito a ADMIN.
 */
@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}

  @Get('me/feedback-dimensions')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  get(@CurrentUser() user: AuthUser) {
    return this.settings.getFeedbackDimensions(user);
  }

  @Put('me/feedback-dimensions')
  @Roles(UserRole.ADMIN)
  set(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetTenantFeedbackDimensionsDto,
  ) {
    return this.settings.setFeedbackDimensions(user, dto);
  }
}
