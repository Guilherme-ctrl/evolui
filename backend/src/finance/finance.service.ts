import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChargeStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { ensureCanReadStudent } from '../common/permissions/scope';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { BulkChargesDto } from './dto/bulk-charges.dto';
import { BulkRegisterPaymentDto } from './dto/bulk-register-payment.dto';
import { RevertChargeDto } from './dto/revert-charge.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async notifyNewCharge(
    tenantId: string,
    studentId: string,
    chargeId: string,
  ) {
    const userIds = await this.notifications.recipientUserIdsForStudent(
      tenantId,
      studentId,
    );
    const studentRow = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { fullName: true },
    });
    await this.notifications.emitToUsers({
      tenantId,
      userIds,
      type: 'BILLING',
      title: 'Nova cobrança registrada',
      body: 'Há uma nova competência financeira no extrato do aluno.',
      payload: studentRow?.fullName
        ? { studentName: studentRow.fullName }
        : undefined,
      dedupeKey: `BILLING:${chargeId}`,
    });
  }

  async createCharge(user: AuthUser, dto: CreateChargeDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: user.tenantId },
    });
    if (!student) throw new NotFoundException();
    const charge = await this.prisma.financialCharge.create({
      data: {
        tenantId: user.tenantId,
        studentId: dto.studentId,
        amountCents: dto.amountCents,
        dueDate: new Date(dto.dueDate),
        status: ChargeStatus.PENDENTE,
        notes: dto.notes,
      },
    });
    await this.notifyNewCharge(user.tenantId, dto.studentId, charge.id);
    return charge;
  }

  async createBulkCharges(user: AuthUser, dto: BulkChargesDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: user.tenantId },
    });
    if (!student) throw new NotFoundException();

    const [yStr, mStr] = dto.startMonth.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m || m < 1 || m > 12) {
      throw new BadRequestException('startMonth inválido.');
    }

    const created: { id: string; dueDate: Date }[] = [];

    for (let i = 0; i < dto.months; i++) {
      const mi = m - 1 + i;
      const d = new Date(y, mi, 1);
      const yy = d.getFullYear();
      const mm = d.getMonth() + 1;
      const dim = new Date(yy, mm, 0).getDate();
      const day = Math.min(dto.dueDayOfMonth, dim);
      const dueDate = new Date(yy, mm - 1, day);
      dueDate.setHours(0, 0, 0, 0);

      const charge = await this.prisma.financialCharge.create({
        data: {
          tenantId: user.tenantId,
          studentId: dto.studentId,
          amountCents: dto.amountCents,
          dueDate,
          status: ChargeStatus.PENDENTE,
          notes: `Mensalidade ${yy}-${String(mm).padStart(2, '0')} (lote)`,
        },
      });
      created.push({ id: charge.id, dueDate });
      await this.notifyNewCharge(user.tenantId, dto.studentId, charge.id);
    }

    return { count: created.length, charges: created };
  }

  async registerPayment(
    user: AuthUser,
    chargeId: string,
    dto: RegisterPaymentDto,
  ) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const charge = await this.prisma.financialCharge.findFirst({
      where: { id: chargeId, tenantId: user.tenantId },
    });
    if (!charge) throw new NotFoundException();
    return this.prisma.financialCharge.update({
      where: { id: chargeId },
      data: {
        status: ChargeStatus.PAGO,
        paidAt: new Date(),
        paymentMethod: dto.paymentMethod,
        notes: dto.notes ?? charge.notes,
      },
    });
  }

  async registerPaymentsBulk(user: AuthUser, dto: BulkRegisterPaymentDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const unique = [
      ...new Set(
        dto.chargeIds.map((id) => id.trim()).filter((id) => id.length > 0),
      ),
    ];
    if (unique.length === 0) {
      throw new BadRequestException('Selecione ao menos uma cobrança.');
    }
    const charges = await this.prisma.financialCharge.findMany({
      where: {
        id: { in: unique },
        tenantId: user.tenantId,
        status: { in: [ChargeStatus.PENDENTE, ChargeStatus.ATRASADO] },
      },
    });
    if (charges.length !== unique.length) {
      throw new BadRequestException(
        'Uma ou mais cobranças não existem, já estão pagas ou não pertencem a este tenant.',
      );
    }
    const paidAt = new Date();
    const noteCommon = dto.notes?.trim() ? dto.notes.trim() : null;
    await this.prisma.$transaction(
      charges.map((c) =>
        this.prisma.financialCharge.update({
          where: { id: c.id },
          data: {
            status: ChargeStatus.PAGO,
            paidAt,
            paymentMethod: dto.paymentMethod,
            notes: noteCommon ?? c.notes,
          },
        }),
      ),
    );
    return { count: charges.length, paidAt };
  }

  async revertPayment(user: AuthUser, chargeId: string, dto: RevertChargeDto) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const reason = (dto.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Motivo obrigatório para reversão.');
    }
    const charge = await this.prisma.financialCharge.findFirst({
      where: { id: chargeId, tenantId: user.tenantId },
    });
    if (!charge) throw new NotFoundException();
    if (charge.status !== ChargeStatus.PAGO) {
      throw new BadRequestException('Só é possível reverter cobranças pagas.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(charge.dueDate);
    due.setHours(0, 0, 0, 0);
    const toStatus =
      due < today ? ChargeStatus.ATRASADO : ChargeStatus.PENDENTE;

    await this.prisma.$transaction([
      this.prisma.financialChargeAudit.create({
        data: {
          tenantId: user.tenantId,
          chargeId,
          fromStatus: ChargeStatus.PAGO,
          toStatus,
          changedById: user.sub,
          reason,
        },
      }),
      this.prisma.financialCharge.update({
        where: { id: chargeId },
        data: {
          status: toStatus,
          paidAt: null,
          paymentMethod: null,
        },
      }),
    ]);

    return this.prisma.financialCharge.findFirst({ where: { id: chargeId } });
  }

  async syncOverduePublic(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    await this.syncOverdue(user.tenantId);
    return { ok: true };
  }

  private async syncOverdue(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.financialCharge.updateMany({
      where: {
        tenantId,
        status: ChargeStatus.PENDENTE,
        dueDate: { lt: today },
      },
      data: { status: ChargeStatus.ATRASADO },
    });
  }

  async delinquency(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    await this.syncOverdue(user.tenantId);
    return this.prisma.financialCharge.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: [ChargeStatus.PENDENTE, ChargeStatus.ATRASADO] },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        student: {
          include: {
            guardians: { include: { guardian: true } },
          },
        },
      },
    });
  }

  async extrato(user: AuthUser, studentId: string) {
    await ensureCanReadStudent(this.prisma, user, studentId);
    return this.prisma.financialCharge.findMany({
      where: { tenantId: user.tenantId, studentId },
      orderBy: { dueDate: 'desc' },
    });
  }

  async exportDelinquencyCsv(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    await this.syncOverdue(user.tenantId);
    const rows = await this.prisma.financialCharge.findMany({
      where: {
        tenantId: user.tenantId,
        status: { in: [ChargeStatus.PENDENTE, ChargeStatus.ATRASADO] },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        student: {
          include: {
            guardians: { include: { guardian: true } },
          },
        },
      },
    });
    const lines = [
      'studentId,studentName,amountCents,dueDate,status',
      ...rows.map(
        (r) =>
          `${r.studentId},"${r.student.fullName.replace(/"/g, '""')}",${r.amountCents},${r.dueDate.toISOString().slice(0, 10)},${r.status}`,
      ),
    ];
    return lines.join('\n');
  }
}
