import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { AuthService } from './auth.service';
import { AcceptTermsDto } from './dto/accept-terms.dto';
import { CreateCoachDto } from './dto/create-coach.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthUser) {
    return this.auth.logoutAllSessions(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('accept-terms')
  acceptTerms(@CurrentUser() user: AuthUser, @Body() dto: AcceptTermsDto) {
    return this.auth.acceptTerms(user, dto.kinship);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('coaches')
  createCoach(@CurrentUser() user: AuthUser, @Body() dto: CreateCoachDto) {
    return this.auth.createCoach(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('coaches')
  coaches(@CurrentUser() user: AuthUser) {
    return this.auth.listCoaches(user);
  }
}
