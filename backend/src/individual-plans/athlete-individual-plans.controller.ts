import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { IndividualPlansService } from './individual-plans.service';

/**
 * Endpoints da conta-atleta para visualizar planos do(s) seu(s) aluno(s).
 * O switcher (RN-200) é resolvido na rota: o consumidor passa o `studentId`
 * que quer consultar e o serviço valida `accountUserId` via athlete-scope.
 */
@Controller('athlete')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ATLETA)
export class AthleteIndividualPlansController {
  constructor(private readonly plans: IndividualPlansService) {}

  @Get('students/:studentId/individual-plans')
  list(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.plans.listForAthleteAccount(user, studentId);
  }

  @Get('individual-plans/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.getForAthleteAccount(user, id);
  }
}
