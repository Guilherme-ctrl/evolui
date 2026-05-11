import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { IndividualPlanStatus } from '@prisma/client';
import { buildStudentPayload } from './e2e-db-cleanup';

describe('Planos individuais (CA-24.*)', () => {
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

  it('CA-24.02: rascunho não aparece ao responsável', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const staffRes = await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const staffId = (staffRes.body as { id: string }[])[0]?.id;
    expect(staffId).toBeTruthy();

    // Limpa quaisquer planos residuais do seed_student_demo (testes anteriores)
    // para garantir que o assert "length === 0" reflita só o rascunho criado aqui.
    await prisma.individualPlan.deleteMany({
      where: { studentId: 'seed_student_demo' },
    });

    const createRes = await request(app.getHttpServer())
      .post('/api/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        type: 'TRATAMENTO',
        title: 'Tratamento sigiloso',
        goal: 'Detalhe clínico não deve vazar',
        startDate: '2026-05-01',
        assignedProfessionalId: staffId,
      })
      .expect(201);
    const planId = createRes.body.id as string;

    const parent = await login('demo', 'pai@demo.com', 'senha123');
    const gList = await request(app.getHttpServer())
      .get('/api/athlete/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${parent}`)
      .expect(200);
    expect((gList.body as unknown[]).length).toBe(0);

    await prisma.individualPlan
      .delete({ where: { id: planId } })
      .catch(() => undefined);
  });

  it('CA-24.03/04: publicar TRATAMENTO notifica com preview seguro', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const staffRes = await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const staffId = (staffRes.body as { id: string }[])[0]?.id;

    const createRes = await request(app.getHttpServer())
      .post('/api/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        type: 'TRATAMENTO',
        title: 'Título clínico',
        goal: 'Objetivo ultra secreto',
        startDate: '2026-05-01',
        assignedProfessionalId: staffId,
      })
      .expect(201);
    const planId = createRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/individual-plans/${planId}/publish`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);

    const demoTenant = await prisma.tenant.findFirstOrThrow({ where: { slug: 'demo' } });
    const parentUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: demoTenant.id, email: 'pai@demo.com' },
    });
    const notif = await prisma.notification.findFirst({
      where: {
        userId: parentUser.id,
        dedupeKey: `ind-plan-publish:${planId}`,
      },
    });
    expect(notif).toBeTruthy();
    expect(notif?.title).toMatch(/acompanhamento/i);
    expect(notif?.body).not.toMatch(/ultra secreto|clínico/i);

    const parentTok = await login('demo', 'pai@demo.com', 'senha123');
    const gList = await request(app.getHttpServer())
      .get('/api/athlete/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${parentTok}`)
      .expect(200);
    expect((gList.body as unknown[]).length).toBeGreaterThanOrEqual(1);

    await prisma.individualPlan.delete({ where: { id: planId } });
  });

  it('CA-24.08: outro tenant não acessa plano (404)', async () => {
    const adminDemo = await login('demo', 'admin@demo.com', 'senha123');
    const staffRes = await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${adminDemo}`)
      .expect(200);
    const staffId = (staffRes.body as { id: string }[])[0]?.id;
    const createRes = await request(app.getHttpServer())
      .post('/api/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${adminDemo}`)
      .send({
        type: 'TRATAMENTO',
        title: 'Treino cross',
        goal: 'Objetivo',
        startDate: '2026-05-01',
        assignedProfessionalId: staffId,
      })
      .expect(201);
    const planId = createRes.body.id as string;

    const adminOther = await login('other', 'admin@other.com', 'senha123');
    await request(app.getHttpServer())
      .get(`/api/individual-plans/${planId}`)
      .set('Authorization', `Bearer ${adminOther}`)
      .expect(404);

    await prisma.individualPlan.delete({ where: { id: planId } });
  });

  it('CA-24.01: treinador sem Staff não cria plano (403)', async () => {
    const coachTok = await login('demo', 'coach@demo.com', 'senha123');
    await request(app.getHttpServer())
      .post('/api/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${coachTok}`)
      .send({
        type: 'TRATAMENTO',
        title: 'X',
        goal: 'Y',
        startDate: '2026-05-01',
      })
      .expect(403);
  });

  it('CA-24.06: inativar aluno pausa plano publicado', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const stRes = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${admin}`)
      .send(
        buildStudentPayload({
          fullName: `e2e-indplan-pause ${Date.now()}`,
          active: true,
          emailPrefix: 'e2e-indplan-pause',
        }),
      )
      .expect(201);
    const studentId = stRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/students/${studentId}/guardians`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ guardianId: 'seed_guardian_demo', isPrimaryForBilling: true })
      .expect(201);

    const staffRes = await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const staffId = (staffRes.body as { id: string }[])[0]?.id;
    const profUser = await prisma.staffProfile.findFirstOrThrow({
      where: { id: staffId },
      select: { userId: true },
    });
    const st = await prisma.student.findFirstOrThrow({ where: { id: studentId } });
    const turma = await prisma.turma.create({
      data: {
        tenantId: st.tenantId,
        name: `Turma e2e ${studentId.slice(0, 8)}`,
        capacity: 10,
        coachUserId: profUser.userId,
      },
    });
    await prisma.enrollment.create({
      data: {
        tenantId: turma.tenantId,
        studentId,
        turmaId: turma.id,
      },
    });

    const planRes = await request(app.getHttpServer())
      .post(`/api/students/${studentId}/individual-plans`)
      .set('Authorization', `Bearer ${admin}`)
      .send({
        type: 'TRATAMENTO',
        title: 'P',
        goal: 'G',
        startDate: '2026-05-01',
        assignedProfessionalId: staffId,
      })
      .expect(201);
    const planId = planRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/individual-plans/${planId}/publish`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/students/${studentId}/active`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ active: false })
      .expect(200);

    const plan = await prisma.individualPlan.findFirstOrThrow({
      where: { id: planId },
    });
    expect(plan.status).toBe(IndividualPlanStatus.PAUSED);

    await prisma.student.delete({ where: { id: studentId } });
    await prisma.turma.delete({ where: { id: turma.id } });
  });

  it('CA-24.05: várias edições no mesmo dia geram uma notificação UPDATED (dedupe)', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const staffRes = await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const staffId = (staffRes.body as { id: string }[])[0]?.id;

    const createRes = await request(app.getHttpServer())
      .post('/api/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        type: 'TRATAMENTO',
        title: 'Dedupe',
        goal: 'G1',
        startDate: '2026-05-01',
        assignedProfessionalId: staffId,
      })
      .expect(201);
    const planId = createRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/individual-plans/${planId}/publish`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);

    const parentUser = await prisma.user.findFirstOrThrow({
      where: { email: 'pai@demo.com' },
    });
    await prisma.notification.deleteMany({
      where: {
        userId: parentUser.id,
        type: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: { startsWith: `ind-plan-update:${planId}:` },
      },
    });

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .patch(`/api/individual-plans/${planId}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ title: `Dedupe ${i}` })
        .expect(200);
    }

    const count = await prisma.notification.count({
      where: {
        userId: parentUser.id,
        type: 'INDIVIDUAL_PLAN_UPDATED',
        dedupeKey: { startsWith: `ind-plan-update:${planId}:` },
      },
    });
    expect(count).toBe(1);

    await prisma.individualPlan.delete({ where: { id: planId } });
  });
});
