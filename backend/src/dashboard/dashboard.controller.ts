import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  load(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.load(user, from, to);
  }

  @Get('home')
  home(@CurrentUser() user: AuthUser) {
    return this.dashboard.home(user);
  }

  @Get('export.json')
  @Header('Content-Type', 'application/json; charset=utf-8')
  export(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.exportSnapshot(user, from, to);
  }
}
