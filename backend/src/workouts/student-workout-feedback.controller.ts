import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { WorkoutsService } from './workouts.service';

/**
 * Endpoint dedicado para o histórico cronológico de feedbacks físicos de um
 * aluno (todos os treinos). ADMIN e TREINADOR (com StaffProfile ativo) podem
 * consultar. Vive em `/students/:studentId/workout-feedback` para casar com a
 * navegação típica (perfil do aluno → "Feedback físico").
 */
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class StudentWorkoutFeedbackController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get(':studentId/workout-feedback')
  history(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.workouts.getStudentFeedbackHistory(user, studentId);
  }
}
