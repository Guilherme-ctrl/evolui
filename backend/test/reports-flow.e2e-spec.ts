import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { deleteReportById } from './e2e-db-cleanup';

const QA_BANNED = /melhor da turma|\bpior\b|ranking|\bposição\b/i;

describe('Relatórios — agregação, publicação e portal (ROT-REL, CA-09)', () => {
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

  it('gera rascunho com texto limpo, publica e responsável lê; outro aluno 403', async () => {
    const adminToken = await login('demo', 'admin@demo.com', 'senha123');
    const title = `e2e-relatório-agregado ${Date.now()}`;
    let reportId = '';
    try {
      const aggRes = await request(app.getHttpServer())
        .post('/api/reports/aggregate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: 'seed_student_demo',
          periodStart: '2024-01-01',
          periodEnd: '2030-12-31',
          title,
        })
        .expect(201);
      reportId = aggRes.body.id as string;
      const summaryText = aggRes.body.summaryText as string;
      const dataJson = JSON.stringify(aggRes.body.dataJson ?? {});
      expect(summaryText).toBeTruthy();
      expect(summaryText + dataJson).not.toMatch(QA_BANNED);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const parentToken = await login('demo', 'pai@demo.com', 'senha123');
      const listRes = await request(app.getHttpServer())
        .get('/api/reports/students/seed_student_demo')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);
      const ids = (listRes.body as { id: string }[]).map((r) => r.id);
      expect(ids).toContain(reportId);

      await request(app.getHttpServer())
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/reports/students/seed_student_no_guardian')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(403);
    } finally {
      if (reportId) await deleteReportById(prisma, reportId);
    }
  });
});
