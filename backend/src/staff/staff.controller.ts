import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffDto) {
    return this.staff.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.staff.list(user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(user, id, dto);
  }
}
