import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvalConfigDto } from './dto/update-eval-config.dto';
import { EvaluationsService } from './evaluations.service';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get('config')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  getConfig(@CurrentUser() user: AuthUser) {
    return this.evaluations.getTenantConfig(user);
  }

  @Get('admin-summary')
  @Roles(UserRole.ADMIN)
  adminSummary(@CurrentUser() user: AuthUser) {
    return this.evaluations.adminSummary(user);
  }

  @Post('config')
  @Roles(UserRole.ADMIN)
  updateConfig(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateEvalConfigDto,
  ) {
    return this.evaluations.updateTenantConfig(user, dto);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEvaluationDto) {
    return this.evaluations.create(user, dto);
  }

  @Get('students/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
  listForStudent(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.evaluations.listForStudent(user, studentId);
  }
}
