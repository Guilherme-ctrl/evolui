import {
  Body,
  Controller,
  Delete,
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
import { AddWorkoutExerciseDto } from './dto/add-workout-exercise.dto';
import { CreateWorkoutAssignmentDto } from './dto/create-workout-assignment.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { ReorderWorkoutExercisesDto } from './dto/reorder-workout-exercises.dto';
import { SetFeedbackDimensionsDto } from './dto/set-feedback-dimensions.dto';
import { UpdateWorkoutExerciseDto } from './dto/update-workout-exercise.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutsService } from './workouts.service';

@Controller('workouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.workouts.list(user, {
      search: search?.trim() || undefined,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workouts.getOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkoutDto) {
    return this.workouts.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkoutDto,
  ) {
    return this.workouts.update(user, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workouts.setArchived(user, id, true);
  }

  @Post(':id/unarchive')
  unarchive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workouts.setArchived(user, id, false);
  }

  // ---- Exercícios ----

  @Post(':id/exercises')
  addExercise(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddWorkoutExerciseDto,
  ) {
    return this.workouts.addExercise(user, id, dto);
  }

  @Patch(':id/exercises/:exerciseId')
  updateExercise(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: UpdateWorkoutExerciseDto,
  ) {
    return this.workouts.updateExercise(user, id, exerciseId, dto);
  }

  @Delete(':id/exercises/:exerciseId')
  removeExercise(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.workouts.removeExercise(user, id, exerciseId);
  }

  @Post(':id/exercises/reorder')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReorderWorkoutExercisesDto,
  ) {
    return this.workouts.reorderExercises(user, id, dto);
  }

  // ---- Atribuições ----

  @Post(':id/assignments')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateWorkoutAssignmentDto,
  ) {
    return this.workouts.assign(user, id, dto);
  }

  @Delete(':id/assignments/:assignmentId')
  unassign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.workouts.unassign(user, id, assignmentId);
  }

  // ---- Feedback físico pós-treino (RN-1323) ----

  @Patch(':id/feedback-dimensions')
  setFeedbackDimensions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetFeedbackDimensionsDto,
  ) {
    return this.workouts.setFeedbackDimensions(user, id, dto);
  }

  @Get(':id/feedback')
  feedbackReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.workouts.getWorkoutFeedbackReport(user, id);
  }
}
