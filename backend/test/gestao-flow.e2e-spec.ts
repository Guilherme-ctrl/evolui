import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  buildStudentPayload,
  deleteDemoGuardian,
  deleteDemoStudent,
  deleteDemoTurma,
  deleteDemoUserCoach,
} from './e2e-db-cleanup';

describe('Gestão — RN-105 exclusão auditada e RN-204 aviso de categoria', () => {
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

  it('excluir aluno com cobrança aberta → 400 com mensagem clara', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    let studentId = '';
    try {
      const stRes = await request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${admin}`)
        .send(
          buildStudentPayload({
            fullName: `e2e-cobrança-bloqueio ${Date.now()}`,
            emailPrefix: 'e2e-cobranca',
          }),
        )
        .expect(201);
      studentId = stRes.body.id as string;
      const demo = await prisma.tenant.findUniqueOrThrow({
        where: { slug: 'demo' },
      });
      await prisma.financialCharge.create({
        data: {
          tenantId: demo.id,
          studentId,
          amountCents: 1000,
          dueDate: new Date('2030-06-01'),
          status: 'PENDENTE',
        },
      });
      const del = await request(app.getHttpServer())
        .delete(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ reason: 'Motivo de teste para exclusão' });
      expect(del.status).toBe(400);
      expect(String(del.text)).toMatch(/cobrança|cobranca/i);
    } finally {
      if (studentId) await deleteDemoStudent(prisma, studentId);
    }
  });

  it('excluir aluno sem pendência → 200, audit gravado, dados removidos', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const stRes = await request(app.getHttpServer())
      .post('/api/students')
      .set('Authorization', `Bearer ${admin}`)
      .send(
        buildStudentPayload({
          fullName: `e2e-excluir-audit ${Date.now()}`,
          emailPrefix: 'e2e-excluir-audit',
        }),
      )
      .expect(201);
    const studentId = stRes.body.id as string;
    const snapshotName = stRes.body.fullName as string;
    await request(app.getHttpServer())
      .delete(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ reason: 'Teste de auditoria RN-105' })
      .expect(200);
    const audit = await prisma.studentDeletionAudit.findFirst({
      where: { studentId, fullNameSnapshot: snapshotName },
    });
    expect(audit).toBeTruthy();
    expect(audit?.reason).toContain('RN-105');
    const gone = await prisma.student.findUnique({ where: { id: studentId } });
    expect(gone).toBeNull();
    await prisma.studentDeletionAudit.deleteMany({
      where: { studentId, fullNameSnapshot: snapshotName },
    });
  });

  it('matricular aluno Sub-7 em turma Sub-9 → 201 com warnings: categoria divergente', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    let turmaId = '';
    let guardianId = '';
    let studentId = '';
    try {
      const coachesRes = await request(app.getHttpServer())
        .get('/api/auth/coaches')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      const coachUserId = (coachesRes.body as { id: string }[])[0]?.id;
      expect(coachUserId).toBeTruthy();

      const turmaRes = await request(app.getHttpServer())
        .post('/api/turmas')
        .set('Authorization', `Bearer ${admin}`)
        .send({
          name: `e2e-RN204-${Date.now()}`,
          capacity: 30,
          coachUserId,
          categoryLabel: 'Sub-9',
        })
        .expect(201);
      turmaId = turmaRes.body.id as string;

      const gRes = await request(app.getHttpServer())
        .post('/api/guardians')
        .set('Authorization', `Bearer ${admin}`)
        .send({ fullName: `e2e-RN204-g ${Date.now()}` })
        .expect(201);
      guardianId = gRes.body.id as string;

      const stRes = await request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${admin}`)
        .send({
          ...buildStudentPayload({
            fullName: `e2e-RN204-atleta ${Date.now()}`,
            emailPrefix: 'e2e-rn204',
          }),
          categoryLabel: 'Sub-7',
        })
        .expect(201);
      studentId = stRes.body.id as string;

      await request(app.getHttpServer())
        .post(`/api/students/${studentId}/guardians`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ guardianId, isPrimaryForBilling: true })
        .expect(201);

      const enr = await request(app.getHttpServer())
        .post(`/api/turmas/${turmaId}/enrollments`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ studentId })
        .expect(201);
      expect(enr.body.warnings).toEqual(['categoria divergente']);
    } finally {
      if (studentId) await deleteDemoStudent(prisma, studentId);
      if (guardianId) await deleteDemoGuardian(prisma, guardianId);
      if (turmaId) await deleteDemoTurma(prisma, turmaId);
    }
  });

  it('cadastra treinador via POST /auth/coaches e lista em GET /auth/coaches', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const email = `treinador.e2e.${Date.now()}@test.local`;
    let coachUserId = '';
    try {
      const created = await request(app.getHttpServer())
        .post('/api/auth/coaches')
        .set('Authorization', `Bearer ${admin}`)
        .send({
          fullName: 'Treinador E2E',
          email,
          password: 'senha12345',
        })
        .expect(201);
      coachUserId = created.body.id as string;
      expect(created.body.email).toBe(email);
      const list = await request(app.getHttpServer())
        .get('/api/auth/coaches')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(
        (list.body as { email: string }[]).some((c) => c.email === email),
      ).toBe(true);
    } finally {
      if (coachUserId) await deleteDemoUserCoach(prisma, coachUserId);
    }
  });

  it('exclui turma vazia via POST /turmas/:id/delete', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const coachesRes = await request(app.getHttpServer())
      .get('/api/auth/coaches')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const coachUserId = (coachesRes.body as { id: string }[])[0]?.id;
    expect(coachUserId).toBeTruthy();
    const turmaRes = await request(app.getHttpServer())
      .post('/api/turmas')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        name: `e2e-turma-del-${Date.now()}`,
        capacity: 10,
        coachUserId,
      })
      .expect(201);
    const turmaId = turmaRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/turmas/${turmaId}/delete`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
    const gone = await prisma.turma.findUnique({ where: { id: turmaId } });
    expect(gone).toBeNull();
  });

  it('desvincula responsável via POST .../unlink (mantém DELETE legado)', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    let g1 = '';
    let g2 = '';
    let studentId = '';
    try {
      const r1 = await request(app.getHttpServer())
        .post('/api/guardians')
        .set('Authorization', `Bearer ${admin}`)
        .send({ fullName: `e2e-unlink-g1 ${Date.now()}` })
        .expect(201);
      g1 = r1.body.id as string;
      const r2 = await request(app.getHttpServer())
        .post('/api/guardians')
        .set('Authorization', `Bearer ${admin}`)
        .send({ fullName: `e2e-unlink-g2 ${Date.now()}` })
        .expect(201);
      g2 = r2.body.id as string;
      const st = await request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${admin}`)
        .send(
          buildStudentPayload({
            fullName: `e2e-unlink-aluno ${Date.now()}`,
            emailPrefix: 'e2e-unlink',
          }),
        )
        .expect(201);
      studentId = st.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/students/${studentId}/guardians`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ guardianId: g1, isPrimaryForBilling: true })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/students/${studentId}/guardians`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ guardianId: g2, isPrimaryForBilling: false })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/students/${studentId}/guardians/${g1}/unlink`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);
      const links = await prisma.studentGuardian.count({
        where: { studentId },
      });
      expect(links).toBe(1);
    } finally {
      if (studentId) await deleteDemoStudent(prisma, studentId);
      if (g1) await deleteDemoGuardian(prisma, g1);
      if (g2) await deleteDemoGuardian(prisma, g2);
    }
  });

  it('exclui responsável sem alunos vinculados via POST /guardians/:id/delete', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const g = await request(app.getHttpServer())
      .post('/api/guardians')
      .set('Authorization', `Bearer ${admin}`)
      .send({ fullName: `e2e-guardian-só ${Date.now()}` })
      .expect(201);
    const id = g.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/guardians/${id}/delete`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
    expect(await prisma.guardian.findUnique({ where: { id } })).toBeNull();
  });

  // RN-103 — relaxada: após a refator ATLETA, Guardian é apenas contato
  // (e-mail/cobrança/WhatsApp). Quem opera o app é Student.accountUser, que é
  // obrigatório no schema. Portanto não há mais bloqueio para remover o
  // "guardian único" — o vínculo de contato é apagado e o aluno permanece com
  // sua conta-atleta intacta.
  it('excluir responsável único do aluno (apenas contato) → 201 e vínculo removido', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    let guardianId = '';
    let studentId = '';
    try {
      const g = await request(app.getHttpServer())
        .post('/api/guardians')
        .set('Authorization', `Bearer ${admin}`)
        .send({ fullName: `e2e-único-g ${Date.now()}` })
        .expect(201);
      guardianId = g.body.id as string;
      const st = await request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${admin}`)
        .send(
          buildStudentPayload({
            fullName: `e2e-único-aluno ${Date.now()}`,
            emailPrefix: 'e2e-unico',
          }),
        )
        .expect(201);
      studentId = st.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/students/${studentId}/guardians`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ guardianId, isPrimaryForBilling: true })
        .expect(201);
      const del = await request(app.getHttpServer())
        .post(`/api/guardians/${guardianId}/delete`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);
      expect(del.body).toEqual({ ok: true });
      const links = await prisma.studentGuardian.count({
        where: { studentId, guardianId },
      });
      expect(links).toBe(0);
      const stillThere = await prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, accountUserId: true },
      });
      expect(stillThere?.accountUserId).toBeTruthy();
      guardianId = '';
    } finally {
      if (studentId) await deleteDemoStudent(prisma, studentId);
      if (guardianId) await deleteDemoGuardian(prisma, guardianId);
    }
  });
});
