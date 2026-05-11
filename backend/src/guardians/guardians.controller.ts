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
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { GuardiansService } from './guardians.service';

@Controller('guardians')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.guardians.list(user, cursor, Number(take) || 40);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.guardians.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGuardianDto) {
    return this.guardians.create(user, dto);
  }

  /** Preferir no cliente: DELETE nem sempre é tratado de forma uniforme em proxies/mobile. */
  @Post(':id/delete')
  removeViaPost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.guardians.remove(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    return this.guardians.update(user, id, dto);
  }
}
