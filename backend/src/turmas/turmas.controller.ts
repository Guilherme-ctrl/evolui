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
import { ChangeCoachDto } from './dto/change-coach.dto';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { EnrollDto } from './dto/enroll.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { TurmasService } from './turmas.service';

@Controller('turmas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class TurmasController {
  constructor(private readonly turmas: TurmasService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.turmas.list(user, cursor, Number(take) || 30);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.turmas.get(user, id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTurmaDto) {
    return this.turmas.create(user, dto);
  }

  @Post(':id/delete')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.turmas.remove(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTurmaDto,
  ) {
    return this.turmas.update(user, id, dto);
  }

  @Post(':id/enrollments')
  @Roles(UserRole.ADMIN)
  enroll(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EnrollDto,
  ) {
    return this.turmas.enroll(user, id, dto);
  }

  @Post(':id/unenroll/:studentId')
  @Roles(UserRole.ADMIN)
  unenroll(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.turmas.unenroll(user, id, studentId);
  }

  @Patch(':id/coach')
  @Roles(UserRole.ADMIN)
  changeCoach(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ChangeCoachDto,
  ) {
    return this.turmas.changeCoach(user, id, body.coachUserId);
  }
}
