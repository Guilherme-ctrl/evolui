import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { GuardiansModule } from './guardians/guardians.module';
import { TurmasModule } from './turmas/turmas.module';
import { CalendarModule } from './calendar/calendar.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AttendanceModule } from './attendance/attendance.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { ReportsModule } from './reports/reports.module';
import { CommunicationsModule } from './communications/communications.module';
import { MediaModule } from './media/media.module';
import { FinanceModule } from './finance/finance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersModule } from './users/users.module';
import { StaffModule } from './staff/staff.module';
import { IndividualPlansModule } from './individual-plans/individual-plans.module';
import { ExerciseLibraryModule } from './exercise-library/exercise-library.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { TenantSettingsModule } from './tenant-settings/tenant-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    AuthModule,
    StudentsModule,
    GuardiansModule,
    TurmasModule,
    CalendarModule,
    NotificationsModule,
    AttendanceModule,
    EvaluationsModule,
    ReportsModule,
    CommunicationsModule,
    MediaModule,
    FinanceModule,
    DashboardModule,
    UsersModule,
    StaffModule,
    IndividualPlansModule,
    ExerciseLibraryModule,
    WorkoutsModule,
    TenantSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
