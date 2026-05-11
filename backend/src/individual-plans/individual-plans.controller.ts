import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { CancelIndividualPlanDto } from './dto/cancel-plan.dto';
import { CompleteIndividualPlanDto } from './dto/complete-plan.dto';
import { PauseIndividualPlanDto } from './dto/pause-plan.dto';
import { ReassignIndividualPlanDto } from './dto/reassign-plan.dto';
import { UpdateIndividualPlanDto } from './dto/update-individual-plan.dto';
import { CreateIndividualPlanSessionDto } from './dto/create-session.dto';
import { UpdateIndividualPlanSessionDto } from './dto/update-session.dto';
import { IndividualPlansService } from './individual-plans.service';

@Controller('individual-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class IndividualPlansController {
  constructor(private readonly plans: IndividualPlansService) {}

  @Get('recent')
  recent(@CurrentUser() user: AuthUser) {
    return this.plans.listRecentForAssignedProfessional(user, 5);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.getOne(user, id);
  }

  @Patch(':id')
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateIndividualPlanDto,
  ) {
    return this.plans.updateMeta(user, id, dto);
  }

  @Post(':id/sessions')
  addSession(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateIndividualPlanSessionDto,
  ) {
    return this.plans.addSession(user, id, dto);
  }

  @Patch(':id/sessions/:sessionId')
  updateSession(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateIndividualPlanSessionDto,
  ) {
    return this.plans.updateSession(user, id, sessionId, dto);
  }

  @Delete(':id/sessions/:sessionId')
  deleteSession(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.plans.deleteSession(user, id, sessionId);
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.publish(user, id);
  }

  @Post(':id/pause')
  pause(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PauseIndividualPlanDto,
  ) {
    return this.plans.pause(user, id, dto.reason);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.resume(user, id);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteIndividualPlanDto,
  ) {
    return this.plans.complete(user, id, dto.completionNote);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelIndividualPlanDto,
  ) {
    return this.plans.cancel(user, id, dto.reason);
  }

  @Post(':id/reassign')
  @Roles(UserRole.ADMIN)
  reassign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReassignIndividualPlanDto,
  ) {
    return this.plans.reassign(user, id, dto.assignedProfessionalId);
  }
}
