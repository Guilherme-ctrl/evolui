import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { CreateChargeDto } from './dto/create-charge.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { BulkChargesDto } from './dto/bulk-charges.dto';
import { BulkRegisterPaymentDto } from './dto/bulk-register-payment.dto';
import { RevertChargeDto } from './dto/revert-charge.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Post('sync-overdue')
  @Roles(UserRole.ADMIN)
  syncOverdue(@CurrentUser() user: AuthUser) {
    return this.finance.syncOverduePublic(user);
  }

  @Post('charges/bulk')
  @Roles(UserRole.ADMIN)
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkChargesDto) {
    return this.finance.createBulkCharges(user, dto);
  }

  @Post('charges')
  @Roles(UserRole.ADMIN)
  createCharge(@CurrentUser() user: AuthUser, @Body() dto: CreateChargeDto) {
    return this.finance.createCharge(user, dto);
  }

  @Post('charges/pay-bulk')
  @Roles(UserRole.ADMIN)
  payBulk(@CurrentUser() user: AuthUser, @Body() dto: BulkRegisterPaymentDto) {
    return this.finance.registerPaymentsBulk(user, dto);
  }

  @Post('charges/:id/pay')
  @Roles(UserRole.ADMIN)
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
  ) {
    return this.finance.registerPayment(user, id, dto);
  }

  @Post('charges/:id/revert')
  @Roles(UserRole.ADMIN)
  revert(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RevertChargeDto,
  ) {
    return this.finance.revertPayment(user, id, dto);
  }

  @Get('delinquency/export.csv')
  @Roles(UserRole.ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@CurrentUser() user: AuthUser) {
    return this.finance.exportDelinquencyCsv(user);
  }

  @Get('delinquency')
  @Roles(UserRole.ADMIN)
  delinquency(@CurrentUser() user: AuthUser) {
    return this.finance.delinquency(user);
  }

  @Get('students/:studentId/extrato')
  @Roles(UserRole.ADMIN, UserRole.TREINADOR, UserRole.ATLETA)
  extrato(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.finance.extrato(user, studentId);
  }
}
