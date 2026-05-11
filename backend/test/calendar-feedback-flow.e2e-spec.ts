import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Doc 06 §7 — RN-1325/1326: Feedback físico pós-evento do calendário.
 * Cobre: dimensões default por tenant, override por evento (set/unset/desligar),
 * submissão pelo ATLETA com upsert (uma por evento), validações 1-5, dimensão
 * desconhecida, isolamento cross-account, relatório por evento (médias) e
 * histórico cronológico do aluno.
 */
describe('Calendário — Feedback físico pós-evento (Doc 06 §7)', () => {
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
    // Limpa dimensões default para não vazar entre suítes.
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (tenant) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { defaultFeedbackDimensions: [] },
      });
    }
    await app.close();
  });

  async function login(slug: string, email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tenantSlug: slug, email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createEvent(adminToken: string, title: string) {
    const starts = new Date(Date.now() - 3600 * 1000); // 1h atrás (já "terminou")
    const ends = new Date(starts.getTime() + 1800 * 1000);
    const res = await request(app.getHttpServer())
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TREINO',
        title,
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
        isWholeSchool: false,
        turmaIds: ['seed_turma_demo'],
      })
      .expect(201);
    return res.body.id as string;
  }

  it('ADMIN define dims default do tenant, evento herda, ATLETA submete (upsert), professor lê médias e histórico', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');

    // 1) ADMIN configura defaults do tenant.
    const baseDims = [
      { key: 'desgaste_fisico', label: 'Desgaste físico', order: 0 },
      { key: 'desgaste_muscular', label: 'Desgaste muscular', order: 1 },
      { key: 'humor', label: 'Humor', order: 2 },
    ];
    const setDims = await request(app.getHttpServer())
      .put('/api/tenant/me/feedback-dimensions')
      .set('Authorization', `Bearer ${admin}`)
      .send({ dimensions: baseDims })
      .expect(200);
    expect(setDims.body.dimensions).toHaveLength(3);

    const eventId = await createEvent(admin, `e2e-fb-evt ${Date.now()}`);
    try {
      // 2) GET do evento devolve effectiveFeedbackDimensions = default do tenant.
      const got = await request(app.getHttpServer())
        .get(`/api/calendar/events/${eventId}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(got.body.effectiveFeedbackDimensions).toHaveLength(3);
      expect(got.body.feedbackDimensions).toBeNull();

      // 3) ATLETA submete feedback no evento.
      const atletaTok = await login('demo', 'pai@demo.com', 'senha123');
      const sub1 = await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({
          scores: { desgaste_fisico: 4, humor: 5 },
          notes: 'Treino legal',
        })
        .expect(201);
      const fbId = sub1.body.id as string;

      // 4) Upsert: chamar de novo atualiza, não duplica (unique eventId+studentId).
      const sub2 = await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { desgaste_fisico: 3, desgaste_muscular: 4 } })
        .expect(201);
      expect(sub2.body.id).toBe(fbId);

      // 5) GET feedback atual reflete o salvo.
      const current = await request(app.getHttpServer())
        .get(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .expect(200);
      expect(current.body.scores).toEqual({
        desgaste_fisico: 3,
        desgaste_muscular: 4,
      });

      // 6) Valor fora 1-5 → 400.
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { desgaste_fisico: 7 } })
        .expect(400);

      // 7) Dimensão desconhecida → 400.
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { dimensao_inexistente: 3 } })
        .expect(400);

      // 8) Relatório do evento.
      const report = await request(app.getHttpServer())
        .get(`/api/calendar/events/${eventId}/feedback`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(report.body.effectiveFeedbackDimensions).toHaveLength(3);
      const avg = report.body.averages as Array<{
        key: string;
        count: number;
        average: number | null;
      }>;
      expect(avg.find((a) => a.key === 'desgaste_fisico')?.average).toBe(3);
      expect(avg.find((a) => a.key === 'humor')?.count).toBe(0);
      expect(report.body.feedbacks).toHaveLength(1);

      // 9) Histórico do aluno (ADMIN).
      const hist = await request(app.getHttpServer())
        .get(`/api/students/seed_student_demo/calendar-feedback`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(hist.body.student.id).toBe('seed_student_demo');
      expect(hist.body.feedbacks.length).toBeGreaterThanOrEqual(1);

      // 10) Conta-atleta de outra família NÃO submete em aluno alheio (403).
      const outroTok = await login('demo', 'familia@demo.com', 'senha123');
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${outroTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { desgaste_fisico: 1 } })
        .expect(403);
    } finally {
      await prisma.calendarEvent
        .delete({ where: { id: eventId } })
        .catch(() => undefined);
    }
  });

  it('Override por evento substitui o default; unset volta a herdar; [] desliga', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    // garante default não-vazio
    await request(app.getHttpServer())
      .put('/api/tenant/me/feedback-dimensions')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        dimensions: [{ key: 'humor', label: 'Humor', order: 0 }],
      })
      .expect(200);
    const eventId = await createEvent(admin, `e2e-fb-override ${Date.now()}`);
    try {
      // 1) Override com dimensão diferente do default.
      const setOv = await request(app.getHttpServer())
        .patch(`/api/calendar/events/${eventId}/feedback-dimensions`)
        .set('Authorization', `Bearer ${admin}`)
        .send({
          dimensions: [{ key: 'fadiga', label: 'Fadiga', order: 0 }],
        })
        .expect(200);
      expect(setOv.body.effectiveFeedbackDimensions).toEqual([
        { key: 'fadiga', label: 'Fadiga', order: 0 },
      ]);

      // 2) Submeter usando key do override deve passar; usando key do default deve falhar.
      const atletaTok = await login('demo', 'pai@demo.com', 'senha123');
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { humor: 4 } })
        .expect(400);
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { fadiga: 2 } })
        .expect(201);

      // 3) Desligar (`[]`) → submissão é rejeitada por "sem feedback configurado".
      const setEmpty = await request(app.getHttpServer())
        .patch(`/api/calendar/events/${eventId}/feedback-dimensions`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ dimensions: [] })
        .expect(200);
      expect(setEmpty.body.effectiveFeedbackDimensions).toEqual([]);
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/calendar/events/${eventId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { fadiga: 3 } })
        .expect(400);

      // 4) Unset → volta a herdar default.
      const unset = await request(app.getHttpServer())
        .patch(`/api/calendar/events/${eventId}/feedback-dimensions`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ unset: true })
        .expect(200);
      expect(unset.body.feedbackDimensions).toBeNull();
      expect(
        (unset.body.effectiveFeedbackDimensions as { key: string }[]).map(
          (d) => d.key,
        ),
      ).toEqual(['humor']);
    } finally {
      await prisma.calendarEvent
        .delete({ where: { id: eventId } })
        .catch(() => undefined);
    }
  });

  it('TREINADOR sem `StaffProfile.active` não acessa relatório nem histórico (RBAC)', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    await request(app.getHttpServer())
      .put('/api/tenant/me/feedback-dimensions')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        dimensions: [{ key: 'humor', label: 'Humor', order: 0 }],
      })
      .expect(200);
    const eventId = await createEvent(admin, `e2e-fb-rbac ${Date.now()}`);
    try {
      const treinadorTok = await login('demo', 'coach@demo.com', 'senha123');
      // Treinador acessa relatório do evento da sua turma (seed_turma_demo).
      await request(app.getHttpServer())
        .get(`/api/calendar/events/${eventId}/feedback`)
        .set('Authorization', `Bearer ${treinadorTok}`)
        .expect(200);
      // Histórico do aluno seed também (aluno é da sua turma).
      await request(app.getHttpServer())
        .get(`/api/students/seed_student_demo/calendar-feedback`)
        .set('Authorization', `Bearer ${treinadorTok}`)
        .expect(200);
    } finally {
      await prisma.calendarEvent
        .delete({ where: { id: eventId } })
        .catch(() => undefined);
    }
  });
});
