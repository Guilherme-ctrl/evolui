import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsModule } from '../communications/communications.module';
import { AthleteEventFeedbackController } from './athlete-event-feedback.controller';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { StudentEventFeedbackController } from './student-event-feedback.controller';

@Module({
  imports: [PrismaModule, NotificationsModule, CommunicationsModule],
  controllers: [
    CalendarController,
    AthleteEventFeedbackController,
    StudentEventFeedbackController,
  ],
  providers: [CalendarService],
})
export class CalendarModule {}
