import {
  Body,
  Controller,
  Get,
  Param,
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
import { CalendarService } from './calendar.service';
import { SubmitEventFeedbackDto } from './dto/submit-event-feedback.dto';

/**
 * Endpoints da conta-atleta para feedback físico **por evento do calendário**.
 * Separado do controller de calendário principal para deixar o agrupamento
 * `/athlete/students/:studentId/...` consistente com workouts (RN-200 +
 * `X-Active-Student-Id`).
 */
@Controller('athlete')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ATLETA)
export class AthleteEventFeedbackController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('students/:studentId/calendar/pending-feedback')
  pending(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    return this.calendar.pendingFeedbackForStudent(user, studentId, {
      limit: limit != null ? Number(limit) : undefined,
      days: days != null ? Number(days) : undefined,
    });
  }

  @Get('students/:studentId/calendar/events/:eventId/feedback')
  current(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.calendar.getEventFeedbackForAthlete(user, studentId, eventId);
  }

  @Post('students/:studentId/calendar/events/:eventId/feedback')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Param('eventId') eventId: string,
    @Body() dto: SubmitEventFeedbackDto,
  ) {
    return this.calendar.submitEventFeedback(user, studentId, eventId, dto);
  }
}
