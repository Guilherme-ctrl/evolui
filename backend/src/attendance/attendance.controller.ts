import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { AttendanceService } from './attendance.service';
import { FinalizeSessionDto } from './dto/finalize-session.dto';
import { OpenSessionDto } from './dto/open-session.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('sessions')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenSessionDto) {
    return this.attendance.openSession(user, dto);
  }

  @Get('sessions/:id')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  getSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendance.getSession(user, id);
  }

  @Post('sessions/:id/finalize')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  finalize(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FinalizeSessionDto,
  ) {
    return this.attendance.finalize(user, id, dto);
  }

  @Get('students/:studentId/history')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
  history(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.attendance.historyForStudent(user, studentId);
  }
}
