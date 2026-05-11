import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IndividualPlansModule } from '../individual-plans/individual-plans.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [PrismaModule, IndividualPlansModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
