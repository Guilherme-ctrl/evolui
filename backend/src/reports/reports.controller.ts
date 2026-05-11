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
import { CreateReportDto } from './dto/create-report.dto';
import { AggregateReportDto } from './dto/aggregate-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list(@CurrentUser() user: AuthUser, @Query('take') take?: string) {
    return this.reports.listRecentAdmin(user, Number(take) || 50);
  }

  @Post('aggregate')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  aggregate(@CurrentUser() user: AuthUser, @Body() dto: AggregateReportDto) {
    return this.reports.createFromAggregate(user, dto);
  }

  @Post('generate-monthly')
  @Roles(UserRole.ADMIN)
  generateMonthly(@CurrentUser() user: AuthUser) {
    return this.reports.generateMonthlyIfEnabled(user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.createDraft(user, dto);
  }

  @Get('students/:studentId')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
  listForStudent(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.reports.listForStudent(user, studentId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getOne(user, id);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.publish(user, id);
  }
}
