import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommunicationScope, UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { CommunicationsService } from './communications.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('communications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Post('messages')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    return this.communications.create(user, dto);
  }

  @Get('messages/authored')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR)
  listAuthored(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('scope') scope?: string,
    @Query('turmaId') turmaId?: string,
  ) {
    const parsedScope =
      scope &&
      Object.values(CommunicationScope).includes(scope as CommunicationScope)
        ? (scope as CommunicationScope)
        : undefined;
    return this.communications.listAuthored(user, {
      cursor,
      take: Number(take) || 30,
      scope: parsedScope,
      turmaId: turmaId || undefined,
    });
  }

  @Get('inbox')
  @Roles(UserRole.ATLETA)
  inbox(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.communications.inbox(user, cursor, Number(take) || 30);
  }

  @Post('messages/:id/read')
  @Roles(UserRole.ATLETA)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.communications.markRead(user, id);
  }
}
