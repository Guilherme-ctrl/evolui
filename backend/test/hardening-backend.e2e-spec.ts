import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import {
  deleteCalendarEventCascade,
  deleteNotificationsByDedupeKeys,
} from './e2e-db-cleanup';

describe('Hardening backend (calendário, presença, notificações)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(
    tenantSlug: string,
    email: string,
    password: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tenantSlug, email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('alterar evento grava CalendarEventAudit e CommunicationMessage com calendarEventId', async () => {
    const token = await login('demo', 'admin@demo.com', 'senha123');
    const before = await prisma.calendarEventAudit.count({
      where: { eventId: 'seed_event_demo' },
    });
    try {
      await request(app.getHttpServer())
        .patch('/api/calendar/events/seed_event_demo')
        .set('Authorization', `Bearer ${token}`)
        .send({ location: 'Audit E2E local' })
        .expect(200);
      const after = await prisma.calendarEventAudit.count({
        where: { eventId: 'seed_event_demo' },
      });
      expect(after).toBe(before + 1);
      const msg = await prisma.communicationMessage.findFirst({
        where: {
          calendarEventId: 'seed_event_demo',
          title: { startsWith: 'Calendário alterado:' },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(msg).toBeTruthy();
      expect(msg?.calendarEventId).toBe('seed_event_demo');
    } finally {
      await prisma.calendarEvent.update({
        where: { id: 'seed_event_demo' },
        data: { location: 'Campo Demo' },
      });
      await prisma.communicationMessage.deleteMany({
        where: {
          calendarEventId: 'seed_event_demo',
          title: { startsWith: 'Calendário alterado:' },
        },
      });
      const afterCleanup = await prisma.calendarEventAudit.count({
        where: { eventId: 'seed_event_demo' },
      });
      const delta = Math.max(0, afterCleanup - before);
      if (delta > 0) {
        const rows = await prisma.calendarEventAudit.findMany({
          where: { eventId: 'seed_event_demo' },
          orderBy: { createdAt: 'desc' },
          take: delta,
          select: { id: true },
        });
        await prisma.calendarEventAudit.deleteMany({
          where: { id: { in: rows.map((r) => r.id) } },
        });
      }
    }
  });

  it('CAL_UPDATE com mesmo dedupeKey só cria uma Notification por usuário', async () => {
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const parent = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'pai@demo.com' },
    });
    const notifications = app.get(NotificationsService);
    const key = 'CAL_UPDATE:dedupe-probe';
    await prisma.notification.deleteMany({
      where: { userId: parent.id, dedupeKey: key },
    });
    await notifications.emitToUsers({
      tenantId: demo.id,
      userIds: [parent.id],
      type: 'CAL_UPDATE',
      title: 'dup',
      body: 'dup',
      dedupeKey: key,
    });
    await notifications.emitToUsers({
      tenantId: demo.id,
      userIds: [parent.id],
      type: 'CAL_UPDATE',
      title: 'dup',
      body: 'dup',
      dedupeKey: key,
    });
    const n = await prisma.notification.count({
      where: { userId: parent.id, dedupeKey: key },
    });
    expect(n).toBe(1);
  });

  it('cancelar evento cria aviso de cancelamento e uma Notification CAL_CANCEL por responsável', async () => {
    const adminToken = await login('demo', 'admin@demo.com', 'senha123');
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const parent = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'pai@demo.com' },
    });
    let eventId = '';
    try {
      const starts = new Date(Date.now() + 86400000 * 5);
      const ends = new Date(starts.getTime() + 3600000);
      const createRes = await request(app.getHttpServer())
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'TREINO',
          title: `e2e-evento-cancel ${Date.now()}`,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
          isWholeSchool: false,
          turmaIds: ['seed_turma_demo'],
        })
        .expect(201);
      eventId = createRes.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/calendar/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Motivo teste e2e' })
        .expect(201);
      const msg = await prisma.communicationMessage.findFirst({
        where: {
          calendarEventId: eventId,
          title: { contains: 'cancelado' },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(msg).toBeTruthy();
      const calCancel = await prisma.notification.count({
        where: {
          userId: parent.id,
          type: 'CAL_CANCEL',
          dedupeKey: `CAL_CANCEL:${eventId}`,
        },
      });
      expect(calCancel).toBe(1);
    } finally {
      if (eventId) {
        await deleteNotificationsByDedupeKeys(prisma, [
          `CAL_CANCEL:${eventId}`,
        ]);
        await prisma.communicationMessage.deleteMany({
          where: { calendarEventId: eventId },
        });
        await deleteCalendarEventCascade(prisma, eventId);
      }
    }
  });

  it('reabrir sessão de presença grava AttendanceReopenAudit', async () => {
    const coachToken = await login('demo', 'coach@demo.com', 'senha123');
    const before = await prisma.attendanceReopenAudit.count({
      where: { sessionId: 'seed_att_sess' },
    });
    try {
      const open = () =>
        request(app.getHttpServer())
          .post('/api/attendance/sessions')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            turmaId: 'seed_turma_demo',
            eventId: 'seed_event_demo',
            mode: 'MARK_PRESENT',
          })
          .expect(201);
      await open();
      await open();
      const after = await prisma.attendanceReopenAudit.count({
        where: { sessionId: 'seed_att_sess' },
      });
      expect(after).toBe(before + 2);
    } finally {
      const afterCleanup = await prisma.attendanceReopenAudit.count({
        where: { sessionId: 'seed_att_sess' },
      });
      const delta = Math.max(0, afterCleanup - before);
      if (delta > 0) {
        const rows = await prisma.attendanceReopenAudit.findMany({
          where: { sessionId: 'seed_att_sess' },
          orderBy: { reopenedAt: 'desc' },
          take: delta,
          select: { id: true },
        });
        await prisma.attendanceReopenAudit.deleteMany({
          where: { id: { in: rows.map((r) => r.id) } },
        });
      }
    }
  });
});
