import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { CreateIndividualPlanDto } from './dto/create-individual-plan.dto';
import { IndividualPlansService } from './individual-plans.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class StudentIndividualPlansController {
  constructor(private readonly plans: IndividualPlansService) {}

  @Get(':studentId/individual-plans')
  list(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.plans.listForStaff(user, studentId);
  }

  @Post(':studentId/individual-plans')
  create(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Body() dto: CreateIndividualPlanDto,
  ) {
    return this.plans.create(user, studentId, dto);
  }
}
