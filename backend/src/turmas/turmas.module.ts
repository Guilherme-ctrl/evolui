import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TurmasController } from './turmas.controller';
import { TurmasService } from './turmas.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TurmasController],
  providers: [TurmasService],
})
export class TurmasModule {}
