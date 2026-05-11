import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  ChargeStatus,
  Prisma,
  StudentDocumentType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import {
  ensureCanReadStudent,
  listTurmaIdsForCoach,
} from '../common/permissions/scope';
import { studentIdsForAccountUser } from '../common/permissions/athlete-scope';
import {
  resolveStudentDocumentForUpsert,
  StudentDocumentValidationError,
} from '../common/br-document.util';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { LinkGuardianDto } from './dto/link-guardian.dto';
import { SetAccountUserDto } from './dto/set-account-user.dto';
import { IndividualPlansService } from '../individual-plans/individual-plans.service';

const HEALTH_FIELDS = ['medicalNotes', 'physicalRestrictions'] as const;

type ResolvedAccount = { accountUserId: string };

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly individualPlans: IndividualPlansService,
  ) {}

  private async visibleStudentIds(user: AuthUser): Promise<string[] | null> {
    if (user.role === UserRole.ADMIN) return null;
    if (user.role === UserRole.TREINADOR) {
      const turmaIds = await listTurmaIdsForCoach(this.prisma, user);
      if (!turmaIds?.length) return [];
      const rows = await this.prisma.enrollment.findMany({
        where: { tenantId: user.tenantId, turmaId: { in: turmaIds } },
        select: { studentId: true },
        distinct: ['studentId'],
      });
      return rows.map((r) => r.studentId);
    }
    if (user.role === UserRole.ATLETA) {
      return studentIdsForAccountUser(this.prisma, user);
    }
    return [];
  }

  async list(user: AuthUser, cursor?: string, take = 30) {
    const cap = Math.min(take, 100);
    const vis = await this.visibleStudentIds(user);
    const where =
      vis === null
        ? { tenantId: user.tenantId }
        : { tenantId: user.tenantId, id: { in: vis } };
    const rows = await this.prisma.student.findMany({
      where,
      orderBy: { fullName: 'asc' },
      take: cap + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        guardians: { include: { guardian: true } },
        accountUser: { select: { id: true, fullName: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (user.role === UserRole.ATLETA) {
      return rows.map((s) => ({
        ...s,
        documentType: undefined,
        documentNumber: undefined,
        medicalNotes: undefined,
        physicalRestrictions: undefined,
      }));
    }
    return rows;
  }

  async getOne(user: AuthUser, id: string) {
    await ensureCanReadStudent(this.prisma, user, id);
    const stripHealth = user.role === UserRole.ATLETA;
    const s = await this.prisma.student.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        guardians: { include: { guardian: true } },
        accountUser: { select: { id: true, fullName: true, email: true } },
        enrollments: { include: { turma: true } },
      },
    });
    if (!s) throw new NotFoundException();
    if (stripHealth) {
      return {
        ...s,
        medicalNotes: undefined,
        physicalRestrictions: undefined,
        documentType: undefined,
        documentNumber: undefined,
      };
    }
    return s;
  }

  /**
   * Resolve a `accountUserId` final, criando uma nova conta ATLETA quando o
   * payload trouxer `accountEmail` + `accountPassword`. Aceita reaproveitar
   * conta existente (irmãos compartilhando — RN-200).
   */
  private async resolveAccountUser(
    tx: Prisma.TransactionClient,
    tenantId: string,
    studentFullName: string,
    input: {
      accountUserId?: string;
      accountEmail?: string;
      accountPassword?: string;
    },
  ): Promise<ResolvedAccount> {
    if (input.accountUserId) {
      const u = await tx.user.findFirst({
        where: {
          id: input.accountUserId,
          tenantId,
          role: UserRole.ATLETA,
          active: true,
        },
        select: { id: true },
      });
      if (!u) {
        throw new BadRequestException(
          'Conta-atleta inválida ou inativa nesta escolinha.',
        );
      }
      return { accountUserId: u.id };
    }

    const email = (input.accountEmail ?? '').trim().toLowerCase();
    const rawPassword = input.accountPassword ?? '';
    if (!email || !rawPassword) {
      throw new BadRequestException(
        'Informe e-mail e senha da conta-atleta, ou selecione uma conta existente.',
      );
    }
    if (rawPassword.length < 6) {
      throw new BadRequestException('Senha deve ter ao menos 6 caracteres.');
    }
    const dup = await tx.user.findFirst({
      where: { tenantId, email },
    });
    if (dup) {
      throw new ConflictException('E-mail já cadastrado nesta escolinha.');
    }
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const u = await tx.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        role: UserRole.ATLETA,
        fullName: studentFullName.trim(),
        active: true,
      },
    });
    return { accountUserId: u.id };
  }

  async create(user: AuthUser, dto: CreateStudentDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    let documentType: StudentDocumentType | null = null;
    let documentNumber: string | null = null;
    try {
      const r = resolveStudentDocumentForUpsert(null, {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
      });
      documentType = r.documentType;
      documentNumber = r.documentNumber;
    } catch (e) {
      if (e instanceof StudentDocumentValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const baseStudentData = {
      tenantId: user.tenantId,
      fullName: dto.fullName,
      photoUrl: dto.photoUrl,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      categoryLabel: dto.categoryLabel,
      documentType,
      documentNumber,
      preferredPosition: dto.preferredPosition,
      emergencyContact: dto.emergencyContact,
      medicalNotes: dto.medicalNotes,
      physicalRestrictions: dto.physicalRestrictions,
      active: dto.active ?? true,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await this.resolveAccountUser(
          tx,
          user.tenantId,
          dto.fullName,
          {
            accountUserId: dto.accountUserId,
            accountEmail: dto.accountEmail,
            accountPassword: dto.accountPassword,
          },
        );
        return tx.student.create({
          data: {
            ...baseStudentData,
            accountUserId: account.accountUserId,
          },
          include: {
            accountUser: { select: { id: true, fullName: true, email: true } },
          },
        });
      });
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if (e instanceof BadRequestException) throw e;
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta as { target?: string[] } | undefined)?.target;
        if (target?.some((t) => String(t).includes('email'))) {
          throw new ConflictException('E-mail já cadastrado nesta escolinha.');
        }
        throw new BadRequestException(
          'Já existe aluno com este documento nesta escolinha.',
        );
      }
      throw e;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateStudentDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const existing = await this.prisma.student.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    let documentType = existing.documentType;
    let documentNumber = existing.documentNumber;
    if (dto.documentType !== undefined || dto.documentNumber !== undefined) {
      try {
        const r = resolveStudentDocumentForUpsert(
          {
            documentType: existing.documentType,
            documentNumber: existing.documentNumber,
          },
          {
            documentType: dto.documentType,
            documentNumber: dto.documentNumber,
          },
        );
        documentType = r.documentType;
        documentNumber = r.documentNumber;
      } catch (e) {
        if (e instanceof StudentDocumentValidationError) {
          throw new BadRequestException(e.message);
        }
        throw e;
      }
      if (String(existing.documentType ?? '') !== String(documentType ?? '')) {
        await this.prisma.studentHealthAudit.create({
          data: {
            tenantId: user.tenantId,
            studentId: id,
            changedById: user.sub,
            field: 'documentType',
            previousValue: existing.documentType,
            newValue: documentType,
          },
        });
      }
      if (
        String(existing.documentNumber ?? '') !== String(documentNumber ?? '')
      ) {
        await this.prisma.studentHealthAudit.create({
          data: {
            tenantId: user.tenantId,
            studentId: id,
            changedById: user.sub,
            field: 'documentNumber',
            previousValue: existing.documentNumber,
            newValue: documentNumber,
          },
        });
      }
    }
    for (const field of HEALTH_FIELDS) {
      if (
        dto[field] !== undefined &&
        String(dto[field]) !== String(existing[field] ?? '')
      ) {
        await this.prisma.studentHealthAudit.create({
          data: {
            tenantId: user.tenantId,
            studentId: id,
            changedById: user.sub,
            field,
            previousValue: existing[field] ?? null,
            newValue: dto[field] != null ? String(dto[field]) : null,
          },
        });
      }
    }
    try {
      const wasActive = existing.active;
      const updated = await this.prisma.student.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          photoUrl: dto.photoUrl,
          birthDate:
            dto.birthDate === undefined
              ? undefined
              : dto.birthDate
                ? new Date(dto.birthDate)
                : null,
          categoryLabel: dto.categoryLabel,
          documentType,
          documentNumber,
          preferredPosition: dto.preferredPosition,
          emergencyContact: dto.emergencyContact,
          medicalNotes: dto.medicalNotes,
          physicalRestrictions: dto.physicalRestrictions,
          active: dto.active,
        },
      });
      if (wasActive && dto.active === false) {
        await this.individualPlans.pauseAllPublishedFor(
          user.tenantId,
          id,
          user.sub,
          'STUDENT_INACTIVATED',
        );
      }
      return updated;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Já existe aluno com este documento nesta escolinha.',
        );
      }
      throw e;
    }
  }

  async linkGuardian(user: AuthUser, studentId: string, dto: LinkGuardianDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tenantId },
    });
    if (!student) throw new NotFoundException();
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: dto.guardianId, tenantId: user.tenantId },
    });
    if (!guardian) throw new NotFoundException('Responsável não encontrado');
    return this.prisma.studentGuardian.create({
      data: {
        tenantId: user.tenantId,
        studentId,
        guardianId: dto.guardianId,
        isPrimaryForBilling: dto.isPrimaryForBilling,
      },
    });
  }

  async setActive(user: AuthUser, id: string, active: boolean) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const existing = await this.prisma.student.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    const updated = await this.prisma.student.update({
      where: { id },
      data: { active },
    });
    if (existing.active && !active) {
      await this.individualPlans.pauseAllPublishedFor(
        user.tenantId,
        id,
        user.sub,
        'STUDENT_INACTIVATED',
      );
    }
    return updated;
  }

  async remove(user: AuthUser, id: string, reason: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new BadRequestException(
        'Informe o motivo da exclusão (mín. 3 caracteres).',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.student.findFirst({
        where: { id, tenantId: user.tenantId },
      });
      if (!existing) throw new NotFoundException();

      const openCharges = await tx.financialCharge.count({
        where: {
          studentId: id,
          tenantId: user.tenantId,
          status: { in: [ChargeStatus.PENDENTE, ChargeStatus.ATRASADO] },
        },
      });
      if (openCharges > 0) {
        throw new BadRequestException(
          'Não é possível excluir: há cobrança em aberto (pendente ou atrasada). Quite ou regularize antes.',
        );
      }

      await tx.studentDeletionAudit.create({
        data: {
          tenantId: user.tenantId,
          studentId: id,
          fullNameSnapshot: existing.fullName,
          deletedById: user.sub,
          reason: trimmed,
        },
      });

      await tx.student.delete({ where: { id } });
    });
    return { ok: true };
  }

  async unlinkGuardian(user: AuthUser, studentId: string, guardianId: string) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException();
    await this.prisma.studentGuardian.deleteMany({
      where: { studentId, guardianId, tenantId: user.tenantId },
    });
    return { ok: true };
  }

  /**
   * Reaponta o aluno para outra conta-atleta. A conta antiga continua
   * existindo (pode atender outros alunos); apenas o vínculo deste student muda.
   */
  async setAccountUser(user: AuthUser, id: string, dto: SetAccountUserDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!student) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      const account = await this.resolveAccountUser(
        tx,
        user.tenantId,
        student.fullName,
        {
          accountUserId: dto.accountUserId,
          accountEmail: dto.accountEmail,
          accountPassword: dto.accountPassword,
        },
      );
      return tx.student.update({
        where: { id },
        data: { accountUserId: account.accountUserId },
        include: {
          guardians: { include: { guardian: true } },
          accountUser: { select: { id: true, fullName: true, email: true } },
          enrollments: { include: { turma: true } },
        },
      });
    });
  }
}
