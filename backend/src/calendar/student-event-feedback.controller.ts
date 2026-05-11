import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { CalendarService } from './calendar.service';

/**
 * Histórico cronológico de feedbacks **de calendário** para um aluno. Lê todos
 * os eventos do tenant em que o aluno respondeu. ADMIN vê qualquer aluno;
 * TREINADOR vê apenas alunos das suas turmas (validação em
 * `CalendarService.getStudentEventFeedbackHistory`).
 */
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class StudentEventFeedbackController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':studentId/calendar-feedback')
  history(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.calendar.getStudentEventFeedbackHistory(user, studentId);
  }
}
