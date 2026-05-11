# 20 — Estado da implementação (repositório atual)

Este documento alinha as especificações em `Docs/00–19` e **`24-modulo-planos-individuais.md`** (regras de produto), e os documentos de acompanhamento `21–22`, com o que está implementado no monorepo **personal-futebol-mvp-empty** (NestJS + Prisma + PostgreSQL + React/Vite). Atualizar quando módulos ou integrações mudarem.

> **Refator ATLETA (2026-05) — estado atual no código.**
> - `UserRole.RESPONSAVEL` → `UserRole.ATLETA`.
> - `Student.accountUserId` obrigatório (FK para `User role=ATLETA`); 1 conta pode servir N alunos (switcher — RN-200).
> - `Guardian.userId` removido; `Guardian` é entidade de contato (sem login).
> - `Student.selfManagedPortal` / `portalUserId` removidos (feature **superada**); o backend não expõe mais `PATCH /students/:id/portal-autonomy`. A troca da conta-atleta vinculada usa `PATCH /students/:id/account-user`.
> - `User.termsAcceptedAt` + `User.termsKinship` adicionados; endpoint `POST /auth/accept-terms` aplica o aceite no 1º login (RN-201).
> - Header HTTP `X-Active-Student-Id` lido pelo `CurrentUser` decorator; helpers em `backend/src/common/permissions/athlete-scope.ts` (substituiu `guardian-scope.ts`).
> - Frontend: `AuthProvider` mantém `activeStudentId` em `localStorage`, `apiFetch` anexa o header automaticamente, `AppLayout` exibe `<select>` switcher quando `user.students.length > 1`, `<TermsAcceptModal>` força o aceite.
> - E2E: novo `backend/test/account-switcher.e2e-spec.ts`; e2e antigo `portal-autonomo-aluno.e2e-spec.ts` removido. Suíte atual: **56/56 passando** (inclui `workouts-flow` 5/5, `workouts-feedback-flow` 3/3 e `calendar-feedback-flow` 3/3).

## 1. Stack e infraestrutura

| Decisão (Doc 17) | No código |
|------------------|-----------|
| Backend NestJS | Sim — módulos por domínio em `backend/src/*` |
| Prisma + PostgreSQL | Sim — `schema.prisma`, migrações versionadas |
| Frontend React (Vite, não Next) | Sim — SPA em `frontend/` |
| Auth | JWT próprio (`@nestjs/jwt`, Passport); claims com `tenantId`, `role`; `tokenVersion` para revogação em massa |
| Storage de mídia | Armazenamento local via API + `sharp` para thumbnails (não S3/Supabase em produção neste MVP) |
| Push FCM / e-mail transacional | Não — notificações in-app e preferências por categoria |
| IA | Não (per Doc 17 §4) |

**Observações:** `@nestjs/throttler` global + limite mais restrito em `POST /auth/login`. Frontend opcional: `@sentry/react` quando `VITE_SENTRY_DSN` está definido.

## 2. Módulos de negócio (visão rápida)

| Doc | Cobertura no repo |
|-----|-------------------|
| 03 Multi-tenant / LGPD | Guards + `tenantId` do usuário; testes de isolamento |
| 04 Alunos / responsáveis (contato) | CRUD aluno + `Guardian` (contato, sem login). Cada aluno tem `accountUserId` obrigatório (`User role=ATLETA`); a conta pode ser compartilhada por irmãos (RN-200). Troca da conta vinculada: `PATCH /students/:id/account-user`. Escopo da conta-atleta em `backend/src/common/permissions/athlete-scope.ts`. E2E: `gestao-flow.e2e-spec.ts`, `account-switcher.e2e-spec.ts`. (Plano legado `exec/plano-implementacao-aluno-portal-autonomo.md` — **superado**.) |
| 05 Turmas | Turmas, matrícula, troca de treinador, escopo treinador |
| 06 Calendário | Eventos, alteração, cancelamento, auditoria de evento (migrações hardening). **Feedback físico pós-evento (mai/2026, CA-06.04–07 / RN-1325–1326)**: `Tenant.defaultFeedbackDimensions` (Json) + `CalendarEvent.feedbackDimensions` (Json nullable override) + model `CalendarEventFeedback` com `@@unique(eventId, studentId)` (migração `20260511203834_calendar_feedback`). Módulo novo `tenant-settings` expõe `GET/PUT /tenant/me/feedback-dimensions` (ADMIN); calendar estende com `PATCH /calendar/events/:id/feedback-dimensions` (custom / `[]` / `unset`) e `GET /calendar/events/:id/feedback`. Novo controller `AthleteEventFeedbackController` para submeter/ler resposta do aluno (`/athlete/students/:sid/calendar/events/:eid/feedback`) e `StudentEventFeedbackController` para histórico cronológico (`/students/:id/calendar-feedback`). `list`/`get` do calendário agora decoram cada evento com `effectiveFeedbackDimensions`. UI: nova seção em Preferências (ADMIN), componente reutilizável `EventFeedbackPanel` no Calendar (Configurar/Ver respostas/Dar feedback conforme papel), nova seção "Feedback físico — eventos" em `StudentDetail`. E2E `calendar-feedback-flow.e2e-spec.ts` (3/3). |
| 07 Presença | Sessão, modos presente/ausente, reabertura com auditoria |
| 08 Avaliações | Config, lote, auto-feedback, portal responsável |
| 09 Relatórios | Agregação, publicação, leitura no portal |
| 10 Comunicação | Envio por escopo, inbox, leitura; integração com mudanças de calendário |
| 11 Mídia | Upload, galeria, moderação; URLs servidas com auth |
| 12 Financeiro | Cobranças, pagamento, reversão com auditoria |
| 13 Dashboard | KPIs admin no período |
| 14 Notificações | In-app, dedupe, preferências; sem FCM |
| 15 Gamificação | Fora do escopo do MVP (especificação mantida para futuro) |
| 24 Planos individuais | **Fase 1 entregue** — `StaffProfile`, CRUD/publicação/pausa/conclusão/cancelamento, portal da conta-atleta (`/athlete/students/:id/individual-plans`), notificações com preview seguro (`individual_plan`, RN-1304), pausa ao inativar aluno (RN-1306); E2E `test/individual-plans-flow.e2e-spec.ts`. **PI-5.1 (mai/2026):** `frontend/src/pages/PlanoEditor.tsx` ganhou UI completa de sessão e exercício (séries/reps/tempo/descanso/vídeo/notas) via modais (CA-24.09). **PI-5.2 (mai/2026):** nova biblioteca compartilhada `ExerciseLibraryItem` (módulo backend `exercise-library` + página `/biblioteca/exercicios`); endpoint `from-library` cria snapshot na sessão (RN-1309/1310 + CA-24.10/11). **Doc 25 (mai/2026):** o `type='TREINO'` foi deslocado para o módulo **Workouts** (RN-1320). `IndividualPlan` agora aceita apenas `TRATAMENTO` no `POST` (front mostra só "Tratamento clínico"). Demais sub-fases (progresso/check-in, templates de sessão/plano, modo campo) seguem em backlog (Doc 24 §9). |
| 25 Treinos (workouts) | **Entregue (mai/2026).** Modelo `Workout / WorkoutExercise / WorkoutAssignment` com snapshot (RN-1310 estendido), migração `20260511194628_workouts_and_assignments` (CHECK XOR `turmaId/studentId` + uniques por alvo). Service/Controller `/workouts` (CRUD + add/edit/remove/reorder de exercícios + atribuir/desatribuir) com regra "autor ou ADMIN" (RN-1322) e TREINADOR só atribuindo à própria turma (RN-1321). Controller `/athlete/students/:id/workouts` combina direto+turma e dedup por workout. Frontend: páginas `/treinos`, `/treinos/:id`, `/meus-treinos` + entradas no `AppLayout`. E2E `test/workouts-flow.e2e-spec.ts` (5/5). **Feedback físico pós-treino (RN-1323/1324, CA-25.07–09)**: novo campo `Workout.feedbackDimensions` (Json) + model `WorkoutFeedback` (migração `20260511202253_workout_feedback`) com `@@unique(workoutId, studentId, submittedDate)`. Endpoints: `PATCH /workouts/:id/feedback-dimensions`, `POST /athlete/students/:sid/workouts/:wid/feedback` (upsert por dia), `GET /workouts/:id/feedback/today`, `GET /workouts/:id/feedback` (médias + lista), `GET /students/:id/workout-feedback` (histórico). UI: editor de dimensões no `TreinoEditor`, painel "Respostas recebidas" no mesmo, botão "Finalizar e dar feedback" em `MeusTreinos`, seção no `StudentDetail`. E2E `test/workouts-feedback-flow.e2e-spec.ts` (3/3). |
| Higiene de testes e2e | **Entregue (mai/2026).** `backend/test/global-setup.ts` registra timestamp do início da suíte e `backend/test/global-teardown.ts` apaga: (a) tudo cujo autor/aluno casa com padrão `e2e-*` ou `*@demo.test` via `purge-e2e-artifacts.ts`; (b) Notification/Communication/FinancialCharge/Report/Evaluation/IndividualPlan/Workout/ExerciseLibraryItem/CalendarEvent criados *após* o marker (cobre notificações geradas para `pai@demo.com` por testes que mexem em `seed_student_demo`). `prisma/seed-exercise-library.ts` agora usa IDs determinísticos `seed_lib_<NNN>`. Dois runs consecutivos deixam o banco no mesmo estado. |

## 3. Rotas principais do frontend

Autenticadas via layout: gestão, alunos, turmas, calendário, presença, financeiro, dashboard, filhos/relatórios (conta-atleta), avaliações, comunicações, mídia, avisos (inbox), notificações, preferências. Ver `frontend/src/App.tsx`.

**Home (`/`):** não é mais apenas lista de atalhos — `frontend/src/pages/Home.tsx` compõe **`HomeAdmin`**, **`HomeCoach`** e **`HomeGuardian`** (`frontend/src/pages/home/`), com dados de `/dashboard`, `/calendar/events`, inbox, notificações e extrato por aluno ativo conforme o papel. Para `ATLETA`, o aluno em foco é o `X-Active-Student-Id` (switcher do header — RN-200). Evoluções de UX pós-MVP seguem [22-plano-implementacao-doc21.md](22-plano-implementacao-doc21.md).

## 4. Plano de execução histórico

O arquivo `Docs/exec/plano-execucao-mvp.md` descreve a ordem de fases por ROT/CA para o MVP. Um plano antigo com fases nomeadas A–J e prompts copiáveis foi **absorvido pelo código** e **removido** do repositório para evitar drift em relação à implementação.

## 5. Lacunas conscientes (pós-MVP)

- Object storage gerenciado e URLs assinadas de longa duração (produção).
- Push e e-mail conforme Doc 14.
- Testes E2E de frontend.
- Gamificação (Doc 15).
- **Planos individuais (Doc 24):** Fase 2 (progresso/check-in, timeline); Fase 3 (templates, IA); Fase 4 (modo campo) — ver §9 do Doc 24 (fora da Fase 1 já implementada).
- **Qualidade front:** manter `npm run lint` verde no `frontend/` em CI; histórico de correções em [exec/plano-limpeza-padronizacao-codigo.md](exec/plano-limpeza-padronizacao-codigo.md).

## 6. Manutenção da documentação

- Regras de produto e ROT/CA: `Docs/00–19`, [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md) e [18-indice-rotinas-e-aceite.md](18-indice-rotinas-e-aceite.md).
- Diretriz de experiência e plano associado: [21-opinioes-melhoria-ux-po.md](21-opinioes-melhoria-ux-po.md), [22-plano-implementacao-doc21.md](22-plano-implementacao-doc21.md).
- Dívida técnica e padronização: [exec/plano-limpeza-padronizacao-codigo.md](exec/plano-limpeza-padronizacao-codigo.md).
- Prompt para agentes (melhorias Doc 22): [exec/prompt-sdd-doc22.md](exec/prompt-sdd-doc22.md).
