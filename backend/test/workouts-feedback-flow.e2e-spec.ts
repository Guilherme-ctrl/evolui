import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Doc 25 §3 — RN-1323/1324: Feedback físico pós-treino.
 * Cobre: configurar dimensões (autor/admin), submissão pelo ATLETA com upsert
 * por dia, validações (1-5, dimensão existente), relatório por treino (médias
 * + lista) e histórico do aluno.
 */
describe('Treinos — Feedback físico pós-treino (Doc 25 §3)', () => {
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

  async function login(slug: string, email: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tenantSlug: slug, email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function pickLibraryItemId(token: string) {
    const r = await request(app.getHttpServer())
      .get('/api/exercise-library')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (r.body as { id: string }[])[0].id;
  }

  it('ADMIN configura dimensões, ATLETA submete (upsert por dia), professor vê médias e histórico', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const libId = await pickLibraryItemId(admin);

    // 1) cria workout + 1 exercício + atribui ao aluno do seed
    const wk = await request(app.getHttpServer())
      .post('/api/workouts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: `e2e-fb ${Date.now()}` })
      .expect(201);
    const workoutId = wk.body.id as string;
    try {
      await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/exercises`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ libraryItemId: libId })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/assignments`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ scope: 'STUDENT', studentId: 'seed_student_demo' })
        .expect(201);

      // 2) Configura dimensões (RN-1323): desgaste físico + muscular + humor.
      const dims = [
        { key: 'desgaste_fisico', label: 'Desgaste físico', order: 0 },
        { key: 'desgaste_muscular', label: 'Desgaste muscular', order: 1 },
        { key: 'humor', label: 'Humor', order: 2 },
      ];
      const dimRes = await request(app.getHttpServer())
        .patch(`/api/workouts/${workoutId}/feedback-dimensions`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ dimensions: dims })
        .expect(200);
      expect(dimRes.body.feedbackDimensions).toHaveLength(3);

      // 3) Rejeita key duplicada.
      await request(app.getHttpServer())
        .patch(`/api/workouts/${workoutId}/feedback-dimensions`)
        .set('Authorization', `Bearer ${admin}`)
        .send({
          dimensions: [
            { key: 'humor', label: 'A', order: 0 },
            { key: 'humor', label: 'B', order: 1 },
          ],
        })
        .expect(400);

      // 4) ATLETA submete feedback parcial.
      const atletaTok = await login('demo', 'pai@demo.com', 'senha123');
      const sub1 = await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({
          scores: { desgaste_fisico: 4, humor: 5 },
          notes: 'Treino pesado mas legal',
        })
        .expect(201);
      const fbId = sub1.body.id as string;

      // 5) Upsert por dia — segunda submissão atualiza, não duplica.
      const sub2 = await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { desgaste_fisico: 3, desgaste_muscular: 4 } })
        .expect(201);
      expect(sub2.body.id).toBe(fbId);
      expect(sub2.body.scores).toEqual({
        desgaste_fisico: 3,
        desgaste_muscular: 4,
      });

      // 6) Valor inválido → 400.
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { desgaste_fisico: 7 } })
        .expect(400);

      // 7) Dimensão desconhecida → 400.
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { dimensao_inexistente: 3 } })
        .expect(400);

      // 8) GET today devolve o que está salvo.
      const today = await request(app.getHttpServer())
        .get(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback/today`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .expect(200);
      expect(today.body.scores).toEqual({
        desgaste_fisico: 3,
        desgaste_muscular: 4,
      });

      // 9) Relatório do treino: médias + lista.
      const report = await request(app.getHttpServer())
        .get(`/api/workouts/${workoutId}/feedback`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(report.body.dimensions).toHaveLength(3);
      const avg = report.body.averages as Array<{
        key: string;
        count: number;
        average: number | null;
      }>;
      const dfisico = avg.find((a) => a.key === 'desgaste_fisico');
      expect(dfisico?.count).toBe(1);
      expect(dfisico?.average).toBe(3);
      const humor = avg.find((a) => a.key === 'humor');
      expect(humor?.count).toBe(0); // foi removido na 2ª submissão
      expect(report.body.feedbacks).toHaveLength(1);

      // 10) Histórico do aluno.
      const hist = await request(app.getHttpServer())
        .get(`/api/students/seed_student_demo/workout-feedback`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(hist.body.student.id).toBe('seed_student_demo');
      expect(hist.body.feedbacks.length).toBeGreaterThanOrEqual(1);

      // 11) ATLETA de outra conta NÃO vê (403).
      const outroTok = await login('demo', 'familia@demo.com', 'senha123');
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback`,
        )
        .set('Authorization', `Bearer ${outroTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { desgaste_fisico: 1 } })
        .expect(403);
    } finally {
      await prisma.workout
        .delete({ where: { id: workoutId } })
        .catch(() => undefined);
    }
  });

  it('Submeter sem dimensões configuradas é bloqueado', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const libId = await pickLibraryItemId(admin);
    const wk = await request(app.getHttpServer())
      .post('/api/workouts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: `e2e-fb-empty ${Date.now()}` })
      .expect(201);
    const workoutId = wk.body.id as string;
    try {
      await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/exercises`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ libraryItemId: libId })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/assignments`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ scope: 'STUDENT', studentId: 'seed_student_demo' })
        .expect(201);

      const atletaTok = await login('demo', 'pai@demo.com', 'senha123');
      const res = await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { qualquer: 3 } })
        .expect(400);
      expect(String(res.text)).toMatch(/feedback configurado|dimens/i);
    } finally {
      await prisma.workout
        .delete({ where: { id: workoutId } })
        .catch(() => undefined);
    }
  });

  it('Submissão de dia diferente cria nova entrada (histórico)', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const libId = await pickLibraryItemId(admin);
    const wk = await request(app.getHttpServer())
      .post('/api/workouts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: `e2e-fb-multi ${Date.now()}` })
      .expect(201);
    const workoutId = wk.body.id as string;
    try {
      await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/exercises`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ libraryItemId: libId })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/assignments`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ scope: 'STUDENT', studentId: 'seed_student_demo' })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/workouts/${workoutId}/feedback-dimensions`)
        .set('Authorization', `Bearer ${admin}`)
        .send({
          dimensions: [{ key: 'fadiga', label: 'Fadiga', order: 0 }],
        })
        .expect(200);

      const atletaTok = await login('demo', 'pai@demo.com', 'senha123');
      await request(app.getHttpServer())
        .post(
          `/api/athlete/students/seed_student_demo/workouts/${workoutId}/feedback`,
        )
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .send({ scores: { fadiga: 2 } })
        .expect(201);

      // Insere manualmente uma 2ª entrada "de ontem" para validar histórico.
      const yesterday = new Date();
      yesterday.setUTCHours(0, 0, 0, 0);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await prisma.workoutFeedback.create({
        data: {
          tenantId: (
            await prisma.tenant.findUniqueOrThrow({ where: { slug: 'demo' } })
          ).id,
          workoutId,
          studentId: 'seed_student_demo',
          submittedByUserId: (
            await prisma.user.findFirstOrThrow({
              where: { email: 'pai@demo.com' },
            })
          ).id,
          submittedDate: yesterday,
          scores: { fadiga: 5 },
        },
      });

      const report = await request(app.getHttpServer())
        .get(`/api/workouts/${workoutId}/feedback`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(report.body.feedbacks).toHaveLength(2);
      const fadiga = (report.body.averages as Array<{
        key: string;
        average: number;
      }>).find((d) => d.key === 'fadiga');
      // média de (2 + 5) / 2 = 3.5
      expect(fadiga?.average).toBe(3.5);
    } finally {
      await prisma.workout
        .delete({ where: { id: workoutId } })
        .catch(() => undefined);
    }
  });
});
