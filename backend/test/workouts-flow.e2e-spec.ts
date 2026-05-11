import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Doc 25 — RN-1320/1321: Workouts.
 * Cobre criação por ADMIN sem StaffProfile e por PROFESSOR (Staff), associação
 * de exercícios da biblioteca com snapshot, atribuição a turma e a aluno,
 * visibilidade da conta-atleta (via switcher) e bloqueio do tipo `TREINO` em
 * IndividualPlan (deslocado para o módulo Workouts).
 */
describe('Treinos (Workouts) — Doc 25 RN-1320/1321', () => {
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

  async function pickLibraryItem(adminTok: string) {
    const res = await request(app.getHttpServer())
      .get('/api/exercise-library')
      .set('Authorization', `Bearer ${adminTok}`)
      .expect(200);
    const items = res.body as { id: string; name: string }[];
    expect(items.length).toBeGreaterThan(0);
    return items[0];
  }

  async function ensureExerciseLibraryItem(adminTok: string, name: string) {
    const search = await request(app.getHttpServer())
      .get(`/api/exercise-library?search=${encodeURIComponent(name)}`)
      .set('Authorization', `Bearer ${adminTok}`)
      .expect(200);
    const found = (search.body as { id: string }[])[0];
    if (found) return found.id;
    const created = await request(app.getHttpServer())
      .post('/api/exercise-library')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name, description: 'criado p/ teste workout' })
      .expect(201);
    return created.body.id as string;
  }

  it('ADMIN cria treino, anexa exercícios da biblioteca, atribui à turma e aluno', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const lib1 = await pickLibraryItem(admin);
    const lib2id = await ensureExerciseLibraryItem(
      admin,
      `e2e-wk-extra ${Date.now()}`,
    );

    const wkName = `e2e-treino-admin ${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/api/workouts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: wkName, description: 'Treino base por admin' })
      .expect(201);
    const workoutId = created.body.id as string;
    expect(created.body.ownerStaff).toBeNull();
    expect(created.body.createdByUser.role).toBe('ADMIN');

    try {
      // adiciona dois exercícios (snapshot dos nomes)
      const ex1 = await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/exercises`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ libraryItemId: lib1.id, sets: 4, repetitions: 12 })
        .expect(201);
      expect(ex1.body.nameSnapshot).toBe(lib1.name);
      expect(ex1.body.order).toBe(0);
      expect(ex1.body.sets).toBe(4);

      const ex2 = await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/exercises`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ libraryItemId: lib2id, durationSeconds: 30 })
        .expect(201);
      expect(ex2.body.order).toBe(1);

      // reordena: lib2 vem primeiro
      const reordered = await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/exercises/reorder`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ exerciseIds: [ex2.body.id, ex1.body.id] })
        .expect(201);
      const orders = (reordered.body as { id: string; order: number }[]).reduce(
        (acc, r) => ((acc[r.id] = r.order), acc),
        {} as Record<string, number>,
      );
      expect(orders[ex2.body.id]).toBe(0);
      expect(orders[ex1.body.id]).toBe(1);

      // atribui à turma do seed (seed_turma_demo)
      const turmaAssign = await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/assignments`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ scope: 'TURMA', turmaId: 'seed_turma_demo' })
        .expect(201);
      expect(turmaAssign.body.turmaId).toBe('seed_turma_demo');

      // duplicar atribuição mesma turma → 409
      await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/assignments`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ scope: 'TURMA', turmaId: 'seed_turma_demo' })
        .expect(409);

      // atribui a aluno (Atleta Demo)
      const stAssign = await request(app.getHttpServer())
        .post(`/api/workouts/${workoutId}/assignments`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ scope: 'STUDENT', studentId: 'seed_student_demo' })
        .expect(201);
      expect(stAssign.body.studentId).toBe('seed_student_demo');
    } finally {
      await prisma.workout.delete({ where: { id: workoutId } }).catch(() => undefined);
    }
  });

  it('PROFESSOR (Staff) cria treino e troca de owner via ADMIN é permitida', async () => {
    const prof = await login('demo', 'prof@demo.com', 'senha123');
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const lib = await pickLibraryItem(prof);
    const wk = await request(app.getHttpServer())
      .post('/api/workouts')
      .set('Authorization', `Bearer ${prof}`)
      .send({ name: `e2e-treino-prof ${Date.now()}` })
      .expect(201);
    const id = wk.body.id as string;
    try {
      expect(wk.body.ownerStaff).toBeTruthy();
      expect(wk.body.createdByUser.role).toBe('TREINADOR');

      await request(app.getHttpServer())
        .post(`/api/workouts/${id}/exercises`)
        .set('Authorization', `Bearer ${prof}`)
        .send({ libraryItemId: lib.id })
        .expect(201);

      // ADMIN edita treino de outro autor (regra "autor ou ADMIN")
      const upd = await request(app.getHttpServer())
        .patch(`/api/workouts/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ description: 'editado por admin' })
        .expect(200);
      expect(upd.body.description).toBe('editado por admin');
    } finally {
      await prisma.workout.delete({ where: { id } }).catch(() => undefined);
    }
  });

  it('ATLETA vê treinos atribuídos (direto + via turma) com switcher RN-200', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const lib = await pickLibraryItem(admin);

    // Treino A — atribuído à turma do aluno (Atleta Demo está em seed_turma_demo)
    const wkA = await request(app.getHttpServer())
      .post('/api/workouts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: `e2e-vis-turma ${Date.now()}` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/workouts/${wkA.body.id}/exercises`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ libraryItemId: lib.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/workouts/${wkA.body.id}/assignments`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ scope: 'TURMA', turmaId: 'seed_turma_demo' })
      .expect(201);

    // Treino B — atribuído diretamente ao aluno
    const wkB = await request(app.getHttpServer())
      .post('/api/workouts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: `e2e-vis-aluno ${Date.now()}` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/workouts/${wkB.body.id}/exercises`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ libraryItemId: lib.id, sets: 3, repetitions: 8 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/workouts/${wkB.body.id}/assignments`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ scope: 'STUDENT', studentId: 'seed_student_demo' })
      .expect(201);

    try {
      const atletaTok = await login('demo', 'pai@demo.com', 'senha123');
      const res = await request(app.getHttpServer())
        .get('/api/athlete/students/seed_student_demo/workouts')
        .set('Authorization', `Bearer ${atletaTok}`)
        .set('X-Active-Student-Id', 'seed_student_demo')
        .expect(200);
      const list = res.body as {
        workout: { id: string; exercises: { videoUrlSnapshot: string | null }[] };
      }[];
      const ids = list.map((a) => a.workout.id);
      expect(ids).toContain(wkA.body.id);
      expect(ids).toContain(wkB.body.id);
      // detalhe do exercício carregando objetivo/vídeo snapshot
      const detailA = list.find((a) => a.workout.id === wkA.body.id);
      expect(detailA?.workout.exercises.length).toBeGreaterThan(0);
    } finally {
      await prisma.workout.delete({ where: { id: wkA.body.id } }).catch(() => undefined);
      await prisma.workout.delete({ where: { id: wkB.body.id } }).catch(() => undefined);
    }
  });

  it('ATLETA fora da conta não vê treino do aluno (403 ou lista vazia)', async () => {
    const tok = await login('demo', 'familia@demo.com', 'senha123');
    await request(app.getHttpServer())
      .get('/api/athlete/students/seed_student_demo/workouts')
      .set('Authorization', `Bearer ${tok}`)
      .set('X-Active-Student-Id', 'seed_student_demo')
      .expect(403);
  });

  it('IndividualPlan tipo TREINO foi bloqueado (RN-1320)', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const staffRes = await request(app.getHttpServer())
      .get('/api/staff')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const staffId = (staffRes.body as { id: string }[])[0]?.id;
    const denied = await request(app.getHttpServer())
      .post('/api/students/seed_student_demo/individual-plans')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        type: 'TREINO',
        title: 'Tentativa de treino',
        goal: 'Objetivo',
        startDate: '2026-05-01',
        assignedProfessionalId: staffId,
      });
    expect(denied.status).toBe(400);
    expect(String(denied.text)).toMatch(/workouts|Doc 25/i);
  });
});
