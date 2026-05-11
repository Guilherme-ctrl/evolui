import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { deleteNotificationsByDedupeKeys } from './e2e-db-cleanup';

describe('Notificações — preferências (ROT-NOT-02) e sessões revogáveis (RNF §2)', () => {
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

  it('desligar COMMS → emitir COMMS → não cria Notification', async () => {
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const parent = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'pai@demo.com' },
    });
    const key = `COMMS:pref-off-${Date.now()}`;
    try {
      const token = await login('demo', 'pai@demo.com', 'senha123');
      await request(app.getHttpServer())
        .post('/api/notifications/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences: [{ category: 'COMMS', inAppEnabled: false }] })
        .expect(201);
      await prisma.notification.deleteMany({
        where: { userId: parent.id, dedupeKey: key },
      });
      const notifications = app.get(NotificationsService);
      await notifications.emitToUsers({
        tenantId: demo.id,
        userIds: [parent.id],
        type: 'COMMS',
        title: 'teste pref',
        body: 'corpo',
        dedupeKey: key,
      });
      const n = await prisma.notification.count({
        where: { userId: parent.id, dedupeKey: key },
      });
      expect(n).toBe(0);
      await request(app.getHttpServer())
        .post('/api/notifications/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences: [{ category: 'COMMS', inAppEnabled: true }] })
        .expect(201);
    } finally {
      await deleteNotificationsByDedupeKeys(prisma, [key]);
    }
  });

  it('GET /notifications não expõe corpo livre de COMMS no item da lista (CA-03.02 / A5)', async () => {
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const parent = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'pai@demo.com' },
    });
    const secret = `E2E-SECRET-MEDICAL-${Date.now()}`;
    const key = `COMMS:a5-preview-${Date.now()}`;
    try {
      await prisma.notification.deleteMany({
        where: { userId: parent.id, dedupeKey: key },
      });
      const notifications = app.get(NotificationsService);
      await notifications.emitToUsers({
        tenantId: demo.id,
        userIds: [parent.id],
        type: 'COMMS',
        title: 'Título livre sensível',
        body: `Observação: ${secret}`,
        dedupeKey: key,
      });
      const token = await login('demo', 'pai@demo.com', 'senha123');
      const res = await request(app.getHttpServer())
        .get('/api/notifications?take=80')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const rows = res.body as {
        body: string;
        title: string;
        dedupeKey?: string | null;
      }[];
      const hit = rows.find((r) => r.dedupeKey === key);
      expect(hit).toBeDefined();
      expect(hit!.body).not.toContain(secret);
      expect(hit!.body).not.toContain('Observação');
      expect(hit!.title).toBe('Comunicados');
      expect(hit!.title).not.toContain('sensível');
    } finally {
      await deleteNotificationsByDedupeKeys(prisma, [key]);
    }
  });

  it('preferência CAL_CANCEL desligada → emit CAL_CANCEL ainda cria Notification (RN-1101)', async () => {
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const parent = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'pai@demo.com' },
    });
    const key = `CAL_CANCEL:rn1101-${Date.now()}`;
    try {
      await prisma.notificationPreference.upsert({
        where: {
          userId_category: { userId: parent.id, category: 'CAL_CANCEL' },
        },
        create: {
          tenantId: demo.id,
          userId: parent.id,
          category: 'CAL_CANCEL',
          inAppEnabled: false,
        },
        update: { inAppEnabled: false },
      });
      await prisma.notification.deleteMany({
        where: { userId: parent.id, dedupeKey: key },
      });
      const notifications = app.get(NotificationsService);
      await notifications.emitToUsers({
        tenantId: demo.id,
        userIds: [parent.id],
        type: 'CAL_CANCEL',
        title: 'cancel',
        body: 'cancel',
        dedupeKey: key,
      });
      const n = await prisma.notification.count({
        where: { userId: parent.id, dedupeKey: key },
      });
      expect(n).toBe(1);
    } finally {
      await deleteNotificationsByDedupeKeys(prisma, [key]);
      await prisma.notificationPreference.updateMany({
        where: { userId: parent.id, category: 'CAL_CANCEL' },
        data: { inAppEnabled: true },
      });
    }
  });

  it('após logout-all, token antigo retorna 401', async () => {
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const email = `e2e-revoke-${Date.now()}@demo.com`;
    const password = 'senha123';
    const revokeUser = await prisma.user.create({
      data: {
        tenantId: demo.id,
        email,
        passwordHash: await bcrypt.hash(password, 8),
        role: UserRole.ATLETA,
        fullName: 'E2E revoke sessões',
        active: true,
      },
    });
    try {
      const token = await login('demo', email, password);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    } finally {
      await prisma.user.delete({ where: { id: revokeUser.id } });
    }
  });
});
