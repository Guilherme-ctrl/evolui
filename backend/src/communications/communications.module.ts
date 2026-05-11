import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
