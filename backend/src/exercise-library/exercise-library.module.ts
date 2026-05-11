import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExerciseLibraryController } from './exercise-library.controller';
import { ExerciseLibraryService } from './exercise-library.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExerciseLibraryController],
  providers: [ExerciseLibraryService],
  exports: [ExerciseLibraryService],
})
export class ExerciseLibraryModule {}
