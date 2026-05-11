import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { CreateCoachDto } from './dto/create-coach.dto';
import { LoginDto } from './dto/login.dto';

type AccountStudentSummary = {
  id: string;
  fullName: string;
  birthDate: Date | null;
  categoryLabel: string | null;
  active: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async listCoaches(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        role: UserRole.TREINADOR,
        active: true,
      },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, email: true },
    });
  }

  async createCoach(actor: AuthUser, dto: CreateCoachDto) {
    const email = dto.email.toLowerCase().trim();
    const dup = await this.prisma.user.findFirst({
      where: { tenantId: actor.tenantId, email },
    });
    if (dup)
      throw new ConflictException('E-mail já cadastrado nesta escolinha.');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        tenantId: actor.tenantId,
        email,
        passwordHash,
        role: UserRole.TREINADOR,
        fullName: dto.fullName.trim(),
      },
      select: { id: true, fullName: true, email: true },
    });
  }

  async me(actor: AuthUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.sub, tenantId: actor.tenantId },
      include: {
        tenant: { select: { slug: true, name: true } },
        staffProfile: {
          select: {
            id: true,
            professionalType: true,
            active: true,
            registry: true,
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    const students = await this.accountStudents(user.id, user.tenantId, user.role);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      tenantName: user.tenant.name,
      staffProfile: user.staffProfile,
      termsAcceptedAt: user.termsAcceptedAt,
      termsKinship: user.termsKinship,
      students,
    };
  }

  async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new UnauthorizedException('Credenciais inválidas');
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: dto.email.toLowerCase().trim(),
        active: true,
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            professionalType: true,
            active: true,
            registry: true,
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');
    const expiresDays = Number(process.env.JWT_EXPIRES_DAYS ?? 7);
    const token = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      tv: user.tokenVersion,
    });
    const students = await this.accountStudents(user.id, user.tenantId, user.role);
    return {
      accessToken: token,
      expiresInDays: expiresDays,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        staffProfile: user.staffProfile,
        termsAcceptedAt: user.termsAcceptedAt,
        termsKinship: user.termsKinship,
        students,
      },
    };
  }

  async logoutAllSessions(actor: AuthUser) {
    await this.prisma.user.update({
      where: { id: actor.sub, tenantId: actor.tenantId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { ok: true };
  }

  /**
   * Aceite de termos no 1º login (RN-201). Idempotente: se já aceitou,
   * apenas atualiza `termsKinship` quando informado, mantendo o `termsAcceptedAt`
   * original como timestamp de aceite legal.
   */
  async acceptTerms(actor: AuthUser, kinship: string) {
    const cleaned = kinship.trim();
    const user = await this.prisma.user.findFirst({
      where: { id: actor.sub, tenantId: actor.tenantId },
      select: { id: true, termsAcceptedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        termsAcceptedAt: user.termsAcceptedAt ?? new Date(),
        termsKinship: cleaned,
      },
      select: { termsAcceptedAt: true, termsKinship: true },
    });
    return {
      termsAcceptedAt: updated.termsAcceptedAt,
      termsKinship: updated.termsKinship,
    };
  }

  /**
   * Para uma conta ATLETA, devolve todos os alunos cuja `accountUserId` é este
   * usuário (suporta switcher de aluno — RN-200). Para outras roles, lista vazia.
   */
  private async accountStudents(
    userId: string,
    tenantId: string,
    role: UserRole,
  ): Promise<AccountStudentSummary[]> {
    if (role !== UserRole.ATLETA) return [];
    return this.prisma.student.findMany({
      where: { tenantId, accountUserId: userId },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        birthDate: true,
        categoryLabel: true,
        active: true,
      },
    });
  }
}
