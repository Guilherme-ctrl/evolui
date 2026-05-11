import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AthleteWorkoutsController } from './athlete-workouts.controller';
import { StudentWorkoutFeedbackController } from './student-workout-feedback.controller';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    WorkoutsController,
    AthleteWorkoutsController,
    StudentWorkoutFeedbackController,
  ],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
