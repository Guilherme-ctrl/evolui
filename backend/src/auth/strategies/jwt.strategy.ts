import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';

type JwtPayload = {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  tv?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (typeof payload.tv !== 'number' || Number.isNaN(payload.tv)) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        active: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException();
    }
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
  }
}
