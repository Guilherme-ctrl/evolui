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
import { CreateExerciseLibraryItemDto } from './dto/create-exercise-library-item.dto';
import { UpdateExerciseLibraryItemDto } from './dto/update-exercise-library-item.dto';
import { ExerciseLibraryService } from './exercise-library.service';

@Controller('exercise-library')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TREINADOR)
export class ExerciseLibraryController {
  constructor(private readonly library: ExerciseLibraryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.library.list(user, {
      search: search?.trim() || undefined,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.getOne(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExerciseLibraryItemDto,
  ) {
    return this.library.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExerciseLibraryItemDto,
  ) {
    return this.library.update(user, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.setArchived(user, id, true);
  }

  @Post(':id/unarchive')
  unarchive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.setArchived(user, id, false);
  }
}
