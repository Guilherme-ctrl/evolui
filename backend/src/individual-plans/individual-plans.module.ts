import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IndividualPlansService } from './individual-plans.service';
import { IndividualPlansController } from './individual-plans.controller';
import { StudentIndividualPlansController } from './student-individual-plans.controller';
import { IndividualPlanExercisesController } from './individual-plan-exercises.controller';
import { AthleteIndividualPlansController } from './athlete-individual-plans.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    IndividualPlansController,
    StudentIndividualPlansController,
    IndividualPlanExercisesController,
    AthleteIndividualPlansController,
  ],
  providers: [IndividualPlansService],
  exports: [IndividualPlansService],
})
export class IndividualPlansModule {}
