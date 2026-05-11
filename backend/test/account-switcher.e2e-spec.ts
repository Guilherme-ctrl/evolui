import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * RN-200 — Switcher de aluno no header da conta-atleta.
 *
 * Cenário de seed (ver prisma/seed.ts):
 *   - familia@demo.com (User role=ATLETA) é conta-titular de DOIS alunos:
 *       • seed_student_familia_a (Filho A)
 *       • seed_student_familia_b (Filho B)
 *   - pai@demo.com (User role=ATLETA) é conta-titular de UM aluno:
 *       • seed_student_demo (Atleta Demo)
 *
 * Os testes validam:
 *   1) `/auth/me` devolve `students[]` para o role ATLETA;
 *   2) `GET /students/:id` respeita o `X-Active-Student-Id` header — a conta
 *      só pode "olhar" alunos que estão na lista; aluno fora da conta → 403;
 *   3) Listagem `GET /students` para ATLETA limita ao escopo
 *      `accountUserId = user.sub` (não vaza outros alunos do tenant).
 */
describe('Switcher de aluno (RN-200) — conta-atleta com múltiplos alunos', () => {
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

  it('login da família devolve dois alunos em students[]', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        tenantSlug: 'demo',
        email: 'familia@demo.com',
        password: 'senha123',
      })
      .expect(200);
    const body = res.body as {
      user: { role: string; students: { id: string; fullName: string }[] };
    };
    expect(body.user.role).toBe('ATLETA');
    const ids = body.user.students.map((s) => s.id).sort();
    expect(ids).toEqual(
      ['seed_student_familia_a', 'seed_student_familia_b'].sort(),
    );
  });

  it('/auth/me devolve students[] coerente com seed', async () => {
    const tok = await login('demo', 'familia@demo.com', 'senha123');
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tok}`)
      .expect(200);
    const body = res.body as {
      role: string;
      students: { id: string }[];
    };
    expect(body.role).toBe('ATLETA');
    expect(body.students.length).toBe(2);
  });

  it('ATLETA com 1 aluno só vê o próprio (lista filtra por accountUserId)', async () => {
    const tok = await login('demo', 'pai@demo.com', 'senha123');
    const res = await request(app.getHttpServer())
      .get('/api/students')
      .set('Authorization', `Bearer ${tok}`)
      .expect(200);
    const ids = (res.body as { id: string }[]).map((s) => s.id);
    expect(ids).toContain('seed_student_demo');
    // Não pode vazar alunos de outra família/conta.
    expect(ids).not.toContain('seed_student_familia_a');
    expect(ids).not.toContain('seed_student_familia_b');
    expect(ids).not.toContain('seed_student_no_guardian');
  });

  it('ATLETA com 2 alunos vê os dois irmãos (e nada mais)', async () => {
    const tok = await login('demo', 'familia@demo.com', 'senha123');
    const res = await request(app.getHttpServer())
      .get('/api/students')
      .set('Authorization', `Bearer ${tok}`)
      .expect(200);
    const ids = (res.body as { id: string }[]).map((s) => s.id).sort();
    expect(ids).toEqual(
      ['seed_student_familia_a', 'seed_student_familia_b'].sort(),
    );
  });

  it('GET /students/:id de aluno fora da conta → 403 (mesmo com header de switcher)', async () => {
    const tok = await login('demo', 'pai@demo.com', 'senha123');
    await request(app.getHttpServer())
      .get('/api/students/seed_student_familia_a')
      .set('Authorization', `Bearer ${tok}`)
      .set('X-Active-Student-Id', 'seed_student_familia_a')
      .expect(403);
  });

  it('GET /students/:id de aluno da própria conta → 200 (com header de switcher)', async () => {
    const tok = await login('demo', 'familia@demo.com', 'senha123');
    const res = await request(app.getHttpServer())
      .get('/api/students/seed_student_familia_b')
      .set('Authorization', `Bearer ${tok}`)
      .set('X-Active-Student-Id', 'seed_student_familia_b')
      .expect(200);
    expect(res.body.id).toBe('seed_student_familia_b');
  });

  it('integridade do seed: accountUserId existe e bate com o user da família', async () => {
    const demo = await prisma.tenant.findFirstOrThrow({
      where: { slug: 'demo' },
    });
    const familia = await prisma.user.findFirstOrThrow({
      where: { tenantId: demo.id, email: 'familia@demo.com' },
    });
    const alunos = await prisma.student.findMany({
      where: { tenantId: demo.id, accountUserId: familia.id },
      select: { id: true },
    });
    const ids = alunos.map((s) => s.id).sort();
    expect(ids).toEqual(
      ['seed_student_familia_a', 'seed_student_familia_b'].sort(),
    );
  });
});
