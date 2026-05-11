import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * RN-1311 — ADMIN sem `StaffProfile` pode cadastrar/editar/arquivar exercícios
 * na biblioteca do tenant. `ownerStaffId` fica `null`, e `createdByUserId`
 * registra o autor real (User). A regra "autor ou ADMIN" continua valendo.
 */
describe('Biblioteca de exercícios — ADMIN como autor (RN-1311)', () => {
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

  it('ADMIN sem StaffProfile cria, edita e arquiva exercício', async () => {
    const demo = await prisma.tenant.findFirstOrThrow({
      where: { slug: 'demo' },
    });
    const adminUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'admin@demo.com' },
    });
    // pré-condição: admin do seed não tem StaffProfile
    const adminStaff = await prisma.staffProfile.findFirst({
      where: { tenantId: demo.id, userId: adminUser.id },
    });
    expect(adminStaff).toBeNull();

    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const uniqueName = `e2e-lib-admin ${Date.now()}`;
    let createdId = '';
    try {
      const created = await request(app.getHttpServer())
        .post('/api/exercise-library')
        .set('Authorization', `Bearer ${admin}`)
        .send({
          name: uniqueName,
          description: 'Cadastrado pelo admin sem StaffProfile',
          defaultSets: 3,
          defaultRepetitions: 12,
          defaultRestSeconds: 45,
        })
        .expect(201);
      createdId = created.body.id as string;
      expect(created.body.ownerStaff).toBeNull();
      expect(created.body.createdByUser?.id).toBe(adminUser.id);
      expect(created.body.createdByUser?.role).toBe('ADMIN');

      // Atualizar
      const updated = await request(app.getHttpServer())
        .patch(`/api/exercise-library/${createdId}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ description: 'Atualizado pelo admin' })
        .expect(200);
      expect(updated.body.description).toBe('Atualizado pelo admin');

      // Arquivar
      const archived = await request(app.getHttpServer())
        .post(`/api/exercise-library/${createdId}/archive`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);
      expect(archived.body.archived).toBe(true);

      // Restaurar
      const unarchived = await request(app.getHttpServer())
        .post(`/api/exercise-library/${createdId}/unarchive`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);
      expect(unarchived.body.archived).toBe(false);
    } finally {
      if (createdId) {
        await prisma.exerciseLibraryItem
          .delete({ where: { id: createdId } })
          .catch(() => undefined);
      }
    }
  });

  it('TREINADOR sem StaffProfile.active continua bloqueado (403)', async () => {
    const coach = await login('demo', 'coach@demo.com', 'senha123');
    await request(app.getHttpServer())
      .post('/api/exercise-library')
      .set('Authorization', `Bearer ${coach}`)
      .send({ name: `e2e-lib-coach-block ${Date.now()}` })
      .expect(403);
  });

  it('TREINADOR com StaffProfile.active edita só o seu; ADMIN edita qualquer', async () => {
    const prof = await login('demo', 'prof@demo.com', 'senha123');
    const admin = await login('demo', 'admin@demo.com', 'senha123');

    const profName = `e2e-lib-prof ${Date.now()}`;
    const profCreated = await request(app.getHttpServer())
      .post('/api/exercise-library')
      .set('Authorization', `Bearer ${prof}`)
      .send({ name: profName, defaultSets: 4 })
      .expect(201);
    const profItemId = profCreated.body.id as string;
    try {
      expect(profCreated.body.ownerStaff).toBeTruthy();

      const adminName = `e2e-lib-admin-2 ${Date.now()}`;
      const adminCreated = await request(app.getHttpServer())
        .post('/api/exercise-library')
        .set('Authorization', `Bearer ${admin}`)
        .send({ name: adminName })
        .expect(201);
      const adminItemId = adminCreated.body.id as string;
      try {
        // Professor NÃO pode editar item do admin (não é o autor; não é ADMIN)
        await request(app.getHttpServer())
          .patch(`/api/exercise-library/${adminItemId}`)
          .set('Authorization', `Bearer ${prof}`)
          .send({ description: 'tentativa indevida' })
          .expect(403);

        // Admin PODE editar item do professor (regra "autor ou ADMIN")
        await request(app.getHttpServer())
          .patch(`/api/exercise-library/${profItemId}`)
          .set('Authorization', `Bearer ${admin}`)
          .send({ description: 'override admin' })
          .expect(200);
      } finally {
        await prisma.exerciseLibraryItem
          .delete({ where: { id: adminItemId } })
          .catch(() => undefined);
      }
    } finally {
      await prisma.exerciseLibraryItem
        .delete({ where: { id: profItemId } })
        .catch(() => undefined);
    }
  });
});
