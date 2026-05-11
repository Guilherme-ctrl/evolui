import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** PNG 1×1 transparent */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Mídia — multi-upload, thumbnail, exclusão e escopo responsável', () => {
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

  it('upload-multi grava N assets com thumbnail; DELETE remove registro', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const coach = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'coach@demo.com' },
    });
    const turma = await prisma.turma.create({
      data: {
        tenantId: demo.id,
        name: `Midia E2E ${Date.now()}`,
        capacity: 20,
        coachUserId: coach.id,
      },
    });
    try {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'midia-e2e-'));
      const p1 = path.join(dir, 'a.png');
      const p2 = path.join(dir, 'b.png');
      fs.writeFileSync(p1, TINY_PNG);
      fs.writeFileSync(p2, TINY_PNG);
      try {
        const res = await request(app.getHttpServer())
          .post(`/api/media/upload-multi?turmaId=${turma.id}`)
          .set('Authorization', `Bearer ${admin}`)
          .attach('files', p1)
          .attach('files', p2)
          .expect(201);
        const body = res.body as { id: string }[];
        expect(body.length).toBe(2);
        const rows = await prisma.mediaAsset.findMany({
          where: { id: { in: body.map((b) => b.id) } },
        });
        expect(rows.some((r) => r.thumbnailKey)).toBe(true);
        const id0 = body[0].id;
        await request(app.getHttpServer())
          .delete(`/api/media/${id0}`)
          .set('Authorization', `Bearer ${admin}`)
          .expect(200);
        const row = await prisma.mediaAsset.findUnique({ where: { id: id0 } });
        expect(row).toBeNull();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      await prisma.mediaAsset.deleteMany({ where: { turmaId: turma.id } });
      await prisma.turma.delete({ where: { id: turma.id } });
    }
  });

  it('responsável não lista mídia só de turma sem vínculo do filho', async () => {
    const admin = await login('demo', 'admin@demo.com', 'senha123');
    const parentTok = await login('demo', 'pai@demo.com', 'senha123');
    const demo = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'demo' },
    });
    const coach = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'coach@demo.com' },
    });
    const turmaIso = await prisma.turma.create({
      data: {
        tenantId: demo.id,
        name: `Midia isolada ${Date.now()}`,
        capacity: 10,
        coachUserId: coach.id,
      },
    });
    try {
      const up = await request(app.getHttpServer())
        .post(`/api/media/upload-multi?turmaId=${turmaIso.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .attach('files', TINY_PNG, 'x.png')
        .expect(201);
      const assetId = (up.body as { id: string }[])[0].id;
      const list = await request(app.getHttpServer())
        .get('/api/media')
        .set('Authorization', `Bearer ${parentTok}`)
        .expect(200);
      const ids = (list.body as { id: string }[]).map((x) => x.id);
      expect(ids).not.toContain(assetId);
    } finally {
      await prisma.mediaAsset.deleteMany({ where: { turmaId: turmaIso.id } });
      await prisma.turma.delete({ where: { id: turmaIso.id } });
    }
  });
});
