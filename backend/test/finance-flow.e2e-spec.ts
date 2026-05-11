import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  deleteFinancialChargeWithAudits,
  deleteFinancialChargesByIds,
} from './e2e-db-cleanup';

describe('Financeiro — lote, reversão e permissões', () => {
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

  it('bulk gera N cobranças com vencimentos mensais corretos', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    let ids: string[] = [];
    try {
      const res = await request(app.getHttpServer())
        .post('/api/finance/charges/bulk')
        .set('Authorization', `Bearer ${admin}`)
        .send({
          studentId: 'seed_student_demo',
          amountCents: 5000,
          dueDayOfMonth: 15,
          months: 3,
          startMonth: '2027-03',
        })
        .expect(201);
      expect(res.body.count).toBe(3);
      ids = (res.body.charges as { id: string; dueDate: string }[]).map(
        (c) => c.id,
      );
      const rows = await prisma.financialCharge.findMany({
        where: { id: { in: ids } },
        orderBy: { dueDate: 'asc' },
      });
      expect(rows).toHaveLength(3);
      expect(rows[0].dueDate.toISOString().slice(0, 10)).toBe('2027-03-15');
      expect(rows[1].dueDate.toISOString().slice(0, 10)).toBe('2027-04-15');
      expect(rows[2].dueDate.toISOString().slice(0, 10)).toBe('2027-05-15');
    } finally {
      await deleteFinancialChargesByIds(prisma, ids);
    }
  });

  it('reverter cobrança grava audit; sem motivo → 400', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const ch = await prisma.financialCharge.create({
      data: {
        tenantId: (
          await prisma.tenant.findUniqueOrThrow({ where: { slug: 'demo' } })
        ).id,
        studentId: 'seed_student_demo',
        amountCents: 100,
        dueDate: new Date('2020-01-01'),
        status: 'PAGO',
        paidAt: new Date(),
        paymentMethod: 'PIX',
      },
    });
    try {
      await request(app.getHttpServer())
        .post(`/api/finance/charges/${ch.id}/revert`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ reason: '' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/finance/charges/${ch.id}/revert`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ reason: '   ' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/finance/charges/${ch.id}/revert`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ reason: 'Correção de lançamento duplicado.' })
        .expect(201);

      const audits = await prisma.financialChargeAudit.findMany({
        where: { chargeId: ch.id },
      });
      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].fromStatus).toBe('PAGO');
      expect(audits[0].reason).toContain('duplicado');

      const updated = await prisma.financialCharge.findFirst({
        where: { id: ch.id },
      });
      expect(updated?.status).toBe('ATRASADO');
      expect(updated?.paidAt).toBeNull();
    } finally {
      await deleteFinancialChargeWithAudits(prisma, ch.id);
    }
  });

  it('responsável não registra pagamento (403)', async () => {
    const parent = await login('demo', 'pai@demo.com', 'senha123');
    const charge = await prisma.financialCharge.findFirst({
      where: { studentId: 'seed_student_demo' },
    });
    if (!charge) throw new Error('seed charge missing');
    await request(app.getHttpServer())
      .post(`/api/finance/charges/${charge.id}/pay`)
      .set('Authorization', `Bearer ${parent}`)
      .send({ paymentMethod: 'PIX' })
      .expect(403);
  });
});
