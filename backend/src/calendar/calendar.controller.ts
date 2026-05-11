import {
  Body,
  Controller,
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
import { CalendarService } from './calendar.service';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { SetEventFeedbackDimensionsDto } from './dto/set-event-feedback-dimensions.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('events')
  list(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('type') type?: string,
  ) {
    return this.calendar.list(
      user,
      from,
      to,
      cursor,
      Number(take) || 40,
      type,
    );
  }

  // IMPORTANTE: precisa estar declarada antes de `events/:id` para que o
  // router não a interprete como um id ("feedback-overview").
  @Get('events/feedback-overview')
  feedbackOverview(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.calendar.feedbackOverview(user, {
      from,
      to,
      types: type,
      cursor,
      take: Number(take) || 25,
    });
  }

  @Get('events/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.calendar.get(user, id);
  }

  @Post('events')
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.calendar.create(user, dto);
  }

  @Patch('events/:id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.calendar.update(user, id, dto);
  }

  @Post('events/:id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelEventDto,
  ) {
    return this.calendar.cancel(user, id, dto);
  }

  // ---- Feedback físico pós-evento (RN-1325/1326) ----

  @Patch('events/:id/feedback-dimensions')
  @Roles(UserRole.ADMIN)
  setEventFeedbackDimensions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetEventFeedbackDimensionsDto,
  ) {
    return this.calendar.setEventFeedbackDimensions(user, id, dto);
  }

  @Get('events/:id/feedback')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  eventFeedbackReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.calendar.getEventFeedbackReport(user, id);
  }
}
