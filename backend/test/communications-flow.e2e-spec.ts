import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  deleteCommunicationMessagesByIds,
  deleteDemoTurma,
  deleteDemoUserCoach,
} from './e2e-db-cleanup';

describe('Comunicações — envio, permissões e histórico (ROT-COM, CA-10)', () => {
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
  ): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tenantSlug, email, password })
      .expect(200);
    return {
      token: res.body.accessToken as string,
      userId: res.body.user.id as string,
    };
  }

  it('treinador envia para turma própria (201); turma de outro tenant (404); turma alheia mesmo tenant (403)', async () => {
    const coachDemo = await login('demo', 'coach@demo.com', 'senha123');
    const msgIds: string[] = [];
    let otherCoachTurmaId = '';
    let otherCoachId = '';
    try {
      const m0 = await request(app.getHttpServer())
        .post('/api/communications/messages')
        .set('Authorization', `Bearer ${coachDemo.token}`)
        .send({
          scope: 'TURMA',
          turmaId: 'seed_turma_demo',
          title: `e2e-comms-aviso ${Date.now()}`,
          body: 'Tragam água.',
        })
        .expect(201);
      msgIds.push(m0.body.id as string);

      const coachOther = await login('other', 'coach@other.com', 'senha123');
      await request(app.getHttpServer())
        .post('/api/communications/messages')
        .set('Authorization', `Bearer ${coachOther.token}`)
        .send({
          scope: 'TURMA',
          turmaId: 'seed_turma_demo',
          title: 'Outro tenant',
          body: 'Não deve existir turma.',
        })
        .expect(404);

      const admin = await login('demo', 'admin@demo.com', 'senha123');
      const demoTenant = await prisma.tenant.findUniqueOrThrow({
        where: { slug: 'demo' },
      });
      const otherCoach = await prisma.user.create({
        data: {
          tenantId: demoTenant.id,
          email: `coach_e2e_${Date.now()}@test.local`,
          passwordHash: 'unused',
          role: UserRole.TREINADOR,
          fullName: 'Treinador E2E B',
          active: true,
        },
      });
      otherCoachId = otherCoach.id;
      const turmaRes = await request(app.getHttpServer())
        .post('/api/turmas')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          name: `e2e-comms-turma ${Date.now()}`,
          capacity: 12,
          coachUserId: otherCoach.id,
        })
        .expect(201);
      otherCoachTurmaId = turmaRes.body.id as string;

      await request(app.getHttpServer())
        .post('/api/communications/messages')
        .set('Authorization', `Bearer ${coachDemo.token}`)
        .send({
          scope: 'TURMA',
          turmaId: otherCoachTurmaId,
          title: 'Ilegítimo',
          body: 'Não deve passar.',
        })
        .expect(403);
    } finally {
      await deleteCommunicationMessagesByIds(prisma, msgIds);
      if (otherCoachTurmaId) await deleteDemoTurma(prisma, otherCoachTurmaId);
      if (otherCoachId) await deleteDemoUserCoach(prisma, otherCoachId);
    }
  });

  it('admin GLOBAL cria destinatários e notificações COMMS; histórico do treinador só o próprio', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const demoTenantId = (
      await prisma.tenant.findUniqueOrThrow({ where: { slug: 'demo' } })
    ).id;
    const parent = await prisma.user.findFirstOrThrow({
      where: {
        tenantId: demoTenantId,
        email: 'pai@demo.com',
      },
    });
    const ts = Date.now();
    const titleGlobal = `e2e-comms-global ${ts}`;
    const titleCoach = `e2e-comms-só-coach ${ts}`;
    const msgIds: string[] = [];
    try {
      const globalRes = await request(app.getHttpServer())
        .post('/api/communications/messages')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          scope: 'GLOBAL',
          title: titleGlobal,
          body: 'Olá famílias.',
        })
        .expect(201);
      const msgId = globalRes.body.id as string;
      msgIds.push(msgId);

      const rcpt = await prisma.communicationRecipient.count({
        where: { messageId: msgId },
      });
      expect(rcpt).toBeGreaterThanOrEqual(1);

      const notif = await prisma.notification.count({
        where: { userId: parent.id, type: 'COMMS' },
      });
      expect(notif).toBeGreaterThanOrEqual(1);

      const coachDemo = await login('demo', 'coach@demo.com', 'senha123');
      const coachMsg = await request(app.getHttpServer())
        .post('/api/communications/messages')
        .set('Authorization', `Bearer ${coachDemo.token}`)
        .send({
          scope: 'TURMA',
          turmaId: 'seed_turma_demo',
          title: titleCoach,
          body: 'Mensagem do técnico.',
        })
        .expect(201);
      msgIds.push(coachMsg.body.id as string);

      const coachHist = await request(app.getHttpServer())
        .get('/api/communications/messages/authored')
        .set('Authorization', `Bearer ${coachDemo.token}`)
        .expect(200);
      const coachTitles = (coachHist.body as { title: string }[]).map(
        (m) => m.title,
      );
      expect(coachTitles.some((t) => t === titleGlobal)).toBe(false);
      expect(coachTitles.some((t) => t === titleCoach)).toBe(true);
    } finally {
      await prisma.notification.deleteMany({
        where: {
          tenantId: demoTenantId,
          type: 'COMMS',
          title: { in: [titleGlobal, titleCoach] },
        },
      });
      await deleteCommunicationMessagesByIds(prisma, msgIds);
    }
  });

  it('GET /users/atletas só para ADMIN', async () => {
    const coach = await login('demo', 'coach@demo.com', 'senha123');
    await request(app.getHttpServer())
      .get('/api/users/atletas')
      .set('Authorization', `Bearer ${coach.token}`)
      .expect(403);
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const res = await request(app.getHttpServer())
      .get('/api/users/atletas')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(
      (res.body as { email: string }[]).some((u) => u.email === 'pai@demo.com'),
    ).toBe(true);
  });
});
