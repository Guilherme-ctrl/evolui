import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Isolamento multi-tenant (CA-03.01, CA-02.01)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
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

  it('CA-03.01: admin de outro tenant não acessa aluno por id (404)', async () => {
    const token = await login('other', 'admin@other.com', 'senha123');
    await request(app.getHttpServer())
      .get('/api/students/seed_student_demo')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('CA-02.01: treinador de outro tenant não acessa turma do demo (404)', async () => {
    const token = await login('other', 'coach@other.com', 'senha123');
    await request(app.getHttpServer())
      .get('/api/turmas/seed_turma_demo')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('CA-02.02: conta-atleta não acessa aluno sem vínculo (403)', async () => {
    // pai@demo.com é dono apenas de Atleta Demo; o aluno
    // seed_student_no_guardian pertence a outra conta (sem vínculo).
    const token = await login('demo', 'pai@demo.com', 'senha123');
    await request(app.getHttpServer())
      .get('/api/students/seed_student_no_guardian')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
