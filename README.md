# Monorepo vazio (NestJS + Prisma + Vite/React)

Mesma stack do projeto de referência: API NestJS com Prisma e PostgreSQL (Docker), frontend Vite com React 19 e React Router. Sem domínio de negócio — apenas esqueleto para começar um produto novo.

## Pré-requisitos

- Node.js 20+
- Docker Desktop ou Docker Engine + Compose

## Uso rápido

1. Banco:

```bash
docker compose up -d
```

2. Backend:

```bash
cp .env.example backend/.env
cd backend
npm install
npx prisma generate
npm run start:dev
```

Com modelos no `schema.prisma`, use `npx prisma migrate dev` para criar migrações. Sem tabelas, `npx prisma generate` basta para o client.

A API responde em `http://localhost:3333` (raiz) e `GET http://localhost:3333/api/health`.

O Postgres do Docker usa a porta **5433** no host (para não colidir com outro Postgres na 5432). Ajuste `DATABASE_URL` se mudar o mapeamento em `docker-compose.yml`.

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173`. Em desenvolvimento, `/api` é encaminhado para o backend.

## Testes (backend)

Com o Postgres ativo (`docker compose up -d`):

```bash
cd backend
npm test
npm run test:e2e
```

## Licença

Ajuste conforme o seu projeto.
