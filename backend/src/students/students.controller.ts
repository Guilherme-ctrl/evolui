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
import { CreateStudentDto } from './dto/create-student.dto';
import { DeleteStudentDto } from './dto/delete-student.dto';
import { LinkGuardianDto } from './dto/link-guardian.dto';
import { PatchStudentActiveDto } from './dto/patch-student-active.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { SetAccountUserDto } from './dto/set-account-user.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.students.list(user, cursor, Number(take) || 30);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.getOne(user, id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  @Patch(':id/active')
  @Roles(UserRole.ADMIN)
  setActive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchStudentActiveDto,
  ) {
    return this.students.setActive(user, id, dto.active);
  }

  @Patch(':id/account-user')
  @Roles(UserRole.ADMIN)
  setAccountUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetAccountUserDto,
  ) {
    return this.students.setAccountUser(user, id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(user, id, dto);
  }

  @Post(':id/guardians')
  @Roles(UserRole.ADMIN)
  link(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LinkGuardianDto,
  ) {
    return this.students.linkGuardian(user, id, dto);
  }

  @Post(':id/guardians/:guardianId/unlink')
  @Roles(UserRole.ADMIN)
  unlinkViaPost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('guardianId') guardianId: string,
  ) {
    return this.students.unlinkGuardian(user, id, guardianId);
  }

  @Delete(':id/guardians/:guardianId')
  @Roles(UserRole.ADMIN)
  unlink(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('guardianId') guardianId: string,
  ) {
    return this.students.unlinkGuardian(user, id, guardianId);
  }

  /** Preferir no cliente: alguns ambientes não enviam corpo em DELETE de forma confiável. */
  @Post(':id/delete')
  @Roles(UserRole.ADMIN)
  removeViaPost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DeleteStudentDto,
  ) {
    return this.students.remove(user, id, dto.reason);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DeleteStudentDto,
  ) {
    return this.students.remove(user, id, dto.reason);
  }
}
