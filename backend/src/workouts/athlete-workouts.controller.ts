import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { SubmitWorkoutFeedbackDto } from './dto/submit-workout-feedback.dto';
import { WorkoutsService } from './workouts.service';

/**
 * Visão da conta-atleta dos treinos do(s) seu(s) aluno(s). Combina atribuições
 * diretas (scope=STUDENT) com atribuições à turma do aluno (scope=TURMA). Dedup
 * por workoutId, dando precedência à atribuição direta.
 */
@Controller('athlete')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ATLETA)
export class AthleteWorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get('students/:studentId/workouts')
  list(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.workouts.listForAthleteAccount(user, studentId);
  }

  @Get('students/:studentId/workouts/:workoutId/feedback/today')
  todayFeedback(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Param('workoutId') workoutId: string,
  ) {
    return this.workouts.getTodayFeedback(user, studentId, workoutId);
  }

  @Post('students/:studentId/workouts/:workoutId/feedback')
  submitFeedback(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Param('workoutId') workoutId: string,
    @Body() dto: SubmitWorkoutFeedbackDto,
  ) {
    return this.workouts.submitFeedback(user, studentId, workoutId, dto);
  }
}
