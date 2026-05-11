# Monorepo vazio (NestJS + Prisma + Vite/React)

Monorepo **Evolui** (SaaS multi-tenant para escolinhas de futebol): API NestJS com Prisma e PostgreSQL (Docker), frontend Vite com React 19 e React Router. As **especificações de produto** estão em **[Docs/README.md](Docs/README.md)** (regras, rotinas e critérios de aceite).

## Pré-requisitos

- Node.js 20+
- Docker Desktop ou Docker Engine + Compose

## Uso rápido (um fluxo só na raiz)

Na pasta do repositório:

```bash
npm install          # instala o orquestrador (concurrently, kill-port) na raiz
npm run bootstrap    # instala backend+frontend, cria backend/.env, sobe Postgres, aplica migrações e seed
npm run dev          # libera a porta 3333 se estiver presa, sobe API e Vite em paralelo
```

Se aparecer `EADDRINUSE` na porta **3333**, feche outro `npm run dev` antigo ou rode `npx kill-port 3333` antes de subir de novo.

Abra `http://localhost:5173`. A API responde em `http://localhost:3333` e `GET http://localhost:3333/api/health`.

**Comandos úteis**

| Comando | O que faz |
|--------|-----------|
| `npm run db:up` / `npm run db:down` | Sobe ou derruba só o Postgres (Docker) |
| `npm run prisma:sync` | `generate` + `migrate deploy` + seed (com banco já no ar) |
| `npm run install:all` | Só `npm install` em `backend/` e `frontend/` |

O Postgres do Docker usa a porta **5433** no host. Ajuste `DATABASE_URL` em `backend/.env` se mudar o `docker-compose.yml`.

**Alterar o schema Prisma:** use `cd backend && npx prisma migrate dev` para gerar uma nova migração (o `bootstrap` / `prisma:sync` só **aplica** migrações existentes com `migrate deploy`).

## Testes (backend)

Com o Postgres ativo (`docker compose up -d`):

```bash
cd backend
npm test
npm run test:e2e
```

## Backup e recuperação (CA-16.02)

Em produção, definir **RPO/RTO** com o time de operações (ex.: backup diário do Postgres gerenciado, retenção 7–30 dias, teste de restore trimestral). O detalhamento fica fora do código; este repositório assume Postgres com `DATABASE_URL` configurável.

## Licença

Ajuste conforme o seu projeto.
