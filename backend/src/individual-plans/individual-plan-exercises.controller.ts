import { Body, Controller, Delete, Param, Post, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { UseFromLibraryDto } from '../exercise-library/dto/use-from-library.dto';
import { CreateIndividualPlanExerciseDto } from './dto/create-exercise.dto';
import { UpdateIndividualPlanExerciseDto } from './dto/update-exercise.dto';
import { IndividualPlansService } from './individual-plans.service';

@Controller('individual-plan-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class IndividualPlanExercisesController {
  constructor(private readonly plans: IndividualPlansService) {}

  @Post(':sessionId/exercises')
  create(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateIndividualPlanExerciseDto,
  ) {
    return this.plans.addExercise(user, sessionId, dto);
  }

  @Post(':sessionId/exercises/from-library')
  createFromLibrary(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: UseFromLibraryDto,
  ) {
    return this.plans.addExerciseFromLibrary(user, sessionId, dto);
  }

  @Patch(':sessionId/exercises/:exerciseId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: UpdateIndividualPlanExerciseDto,
  ) {
    return this.plans.updateExercise(user, sessionId, exerciseId, dto);
  }

  @Delete(':sessionId/exercises/:exerciseId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.plans.deleteExercise(user, sessionId, exerciseId);
  }
}
