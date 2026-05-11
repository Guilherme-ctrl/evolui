# Plano de implementação — Módulo "Planos Individuais" (Fase 1)

Plano técnico e de produto para introduzir, no SaaS de escolinhas, o conceito de **plano individual** prescrito por um profissional (treinador / professor / fisioterapeuta) a um aluno específico, com notificação ao responsável e visualização no portal da família.

> **Origem da ideia:** ressignificação dos modelos `Protocol / TrainingSession / TrainingExercise` do projeto irmão `personal-futebol-mvp` (futPro). **Não é um produto separado** — entra como módulo dentro do SaaS atual, respeitando [00-visao-e-objetivos.md](../00-visao-e-objetivos.md) (RN-000), [02-papeis-e-permissoes.md](../02-papeis-e-permissoes.md), [03-multi-tenant-e-lgpd.md](../03-multi-tenant-e-lgpd.md) (CA-03.01, CA-03.02) e [21-opinioes-melhoria-ux-po.md](../21-opinioes-melhoria-ux-po.md).

**Status:** plano novo; não substitui [22-plano-implementacao-doc21.md](../22-plano-implementacao-doc21.md). Pode rodar em paralelo às fases A/B desse plano, observando capacidade do time.

---

## 1. Resumo executivo

| Item | Decisão |
|------|---------|
| Nome do módulo | **Planos Individuais** (`/alunos/:id/planos`, `/filhos/:studentId/planos`) |
| Tipos suportados | `TREINO`, `REFORCO_TECNICO`, `TRATAMENTO`, `RECUPERACAO`, `OUTRO` |
| Quem prescreve | Usuário com `role = TREINADOR` e `StaffProfile.professionalType ∈ {PROFESSOR, FISIOTERAPEUTA, PREPARADOR_FISICO, OUTRO}` |
| Quem vê | Profissional autor + ADMIN do tenant + responsáveis vinculados ao aluno (após `PUBLISHED`) |
| Quem cadastra profissional | **ADMIN** |
| Notificação | In-app no `PUBLISHED` e em alterações relevantes; respeita [14-modulo-notificacoes.md](../14-modulo-notificacoes.md), `CA-03.02` e `RN-1101` |
| Aluno preenche feedback? | **Não na Fase 1** (mantém o aluno mediado pelo responsável) |
| Opt-in por tenant? | **Não** — módulo padrão; profissionais inativos = lista vazia (sem placeholder confuso) |
| Fase 1 entrega | Cadastro de profissional + criação/edição/publicação de plano + visualização pelo responsável + notificação |

**Filtro RN-000:** o ato de prescrever é responsabilidade do profissional especialista (professor/fisio), **não** do treinador de campo durante a sessão. A operação rotineira do treinador (presença, avaliação rápida) **não é alterada**.

---

## 2. Atualizações e criações de specs

### 2.1 **Criar** `Docs/24-modulo-planos-individuais.md`

Conteúdo completo — copiar como está:

````markdown
# 24 — Módulo: Planos individuais

## 1. Objetivo

Permitir que um profissional vinculado à escolinha (professor, fisioterapeuta, preparador físico) **prescreva um plano específico** para um aluno — treino personalizado, reforço técnico, tratamento, recuperação — e que o **responsável** acompanhe a evolução pelo portal, recebendo notificação ao publicar ou alterar o plano.

Respeita o objetivo principal do produto ([00-visao-e-objetivos.md](00-visao-e-objetivos.md)): aumentar a percepção de profissionalismo da escolinha e a sensação dos pais de que **há acompanhamento individual** — sem virar ERP nem sobrecarregar o treinador de campo (RN-000).

## 2. Conceitos

| Termo | Definição |
|-------|-----------|
| **Plano individual** | Conjunto ordenado de sessões prescritas por um profissional a **um único aluno**, com objetivo, período, tipo e visibilidade controlada. |
| **Profissional** | Usuário com `role = TREINADOR` e `StaffProfile.professionalType` definido (professor, fisio, preparador). Permite distinguir, sem criar nova role, quem opera turma vs. quem prescreve plano individual. |
| **Sessão de plano** | Item ordenado dentro do plano (ex.: "Sessão A — Mobilidade tornozelo"). |
| **Exercício de plano** | Item dentro da sessão com instruções (séries/reps/tempo/notas/vídeo). |
| **Status do plano** | `DRAFT`, `PUBLISHED`, `PAUSED`, `COMPLETED`, `CANCELLED`. |

## 3. Regras de negócio

| ID | Regra |
|----|-------|
| RN-1300 | Profissional só pode criar plano para aluno **vinculado** a si (via turma atribuída ou vínculo direto plano-a-plano). |
| RN-1301 | Plano em `DRAFT` é privado ao autor + ADMIN; **não notifica** o responsável. |
| RN-1302 | Publicação (`PUBLISHED`) torna o plano visível ao responsável vinculado e dispara notificação in-app. |
| RN-1303 | Alteração relevante em plano publicado (título, objetivo, período, sessões, status) gera nova notificação **agrupada por dia** (idempotência por (planId, alunoId, dia)). |
| RN-1304 | Plano do tipo `TRATAMENTO` **nunca** expõe detalhes clínicos no preview de notificação (`CA-03.02`); título in-app é genérico (ex.: "Novo plano de acompanhamento"). |
| RN-1305 | Apenas o autor do plano e o ADMIN podem editar; troca de profissional responsável requer ADMIN e fica auditada. |
| RN-1306 | Inativar aluno (RN-104) **pausa automaticamente** planos `PUBLISHED` desse aluno (status → `PAUSED` com motivo "aluno inativado"); reativação não retoma sozinha. |
| RN-1307 | Exclusão de plano publicado é **soft** (status `CANCELLED` + auditoria); histórico é mantido para o responsável até a política de retenção do tenant decidir o contrário. |
| RN-1308 | Linguagem do plano e dos feedbacks segue RN-602 (foco em evolução individual; sem comparação com outros alunos). |

## 4. Visibilidade

| Papel | O que vê |
|-------|----------|
| ADMIN | Todos os planos do tenant; pode reatribuir, pausar, cancelar. |
| TREINADOR (autor) | Seus próprios planos + planos dos alunos das suas turmas (somente leitura para os de outros profissionais). |
| TREINADOR (não autor) | Lista resumida (existência do plano + tipo + status) sem detalhe clínico se for `TRATAMENTO`. |
| RESPONSAVEL | Planos `PUBLISHED` (e `PAUSED/COMPLETED/CANCELLED` históricos) dos filhos vinculados. **Nunca** planos em `DRAFT`. |

## 5. Rotinas

### ROT-PLI-01 — Cadastrar profissional (ADMIN)

**Pré-condição:** ADMIN autenticado.
**Passos:** criar `User` com `role=TREINADOR`; preencher `StaffProfile` com `professionalType` e (opcional) `registry` (ex.: CREF/CREFITO).
**Pós-condição:** profissional disponível para vinculação a turmas / planos.

### ROT-PLI-02 — Criar plano individual

**Ator:** TREINADOR (profissional) com vínculo ao aluno; ou ADMIN.
**Passos:** selecionar aluno → preencher metadados (`type`, `title`, `goal`, `startDate`, `endDate?`, `weeklyFrequency?`); status inicial `DRAFT`.
**Pós-condição:** plano salvo; nenhuma notificação enviada.

### ROT-PLI-03 — Editar sessões e exercícios

**Ator:** autor ou ADMIN.
**Passos:** CRUD ordenado de `IndividualPlanSession` e, dentro dela, `IndividualPlanExercise`.
**Pós-condição:** ordem preservada; auditoria de mudanças se plano já estava `PUBLISHED`.

### ROT-PLI-04 — Publicar plano

**Ator:** autor ou ADMIN.
**Pré-condição:** plano em `DRAFT` ou `PAUSED`; aluno ativo; pelo menos uma sessão ou descrição mínima do `goal`.
**Passos:** status → `PUBLISHED`; emitir notificação ao(s) responsável(eis) com título seguro (RN-1304).
**Pós-condição:** plano visível no portal do responsável.

### ROT-PLI-05 — Pausar / retomar plano

**Ator:** autor ou ADMIN.
**Passos:** alternar `PUBLISHED ↔ PAUSED` com motivo opcional.
**Pós-condição:** notificação opcional ao responsável (template positivo).

### ROT-PLI-06 — Concluir plano

**Ator:** autor ou ADMIN.
**Passos:** status → `COMPLETED`; opcionalmente registrar nota final curta (≤ 280 caracteres, sem dado clínico explícito conforme `CA-03.02`).
**Pós-condição:** plano fica em histórico do aluno; responsável recebe notificação de conclusão.

### ROT-PLI-07 — Cancelar plano

**Ator:** autor ou ADMIN.
**Passos:** status → `CANCELLED` + motivo obrigatório; auditoria.
**Pós-condição:** plano sai da listagem ativa; histórico mantido.

### ROT-PLI-08 — Visualizar planos (responsável)

**Ator:** RESPONSAVEL.
**Pré-condição:** vínculo `studentGuardian` ativo (`ROT-PERM-02`).
**Passos:** lista cronológica por filho; detalhe de plano `PUBLISHED/PAUSED/COMPLETED/CANCELLED`.
**Pós-condição:** marcação de leitura no recibo (`CA-24.04`).

## 6. Critérios de aceite

- **CA-24.01:** profissional não pode criar plano para aluno fora do escopo (turmas atribuídas ou vínculo plano-a-plano explícito).
- **CA-24.02:** plano em `DRAFT` nunca aparece no portal do responsável e não gera notificação.
- **CA-24.03:** publicação dispara exatamente uma notificação por responsável (idempotência por `dedupeKey = "ind-plan-publish:{planId}"`).
- **CA-24.04:** notificação de plano `TRATAMENTO` tem título e body **genéricos** (sem trecho de `goal`/sessões); detalhe só aparece dentro do app autenticado.
- **CA-24.05:** alteração relevante em plano publicado gera notificação agregada por dia (`dedupeKey = "ind-plan-update:{planId}:{yyyy-mm-dd}"`).
- **CA-24.06:** inativar aluno pausa automaticamente seus planos `PUBLISHED` (RN-1306); listar evento na auditoria.
- **CA-24.07:** treinador não autor não consegue editar (403); ADMIN pode reatribuir com auditoria.
- **CA-24.08:** isolamento de tenant validado por teste E2E (`CA-03.01` aplicado a planos individuais).

## 7. Anti-objetivos (Fase 1)

- **Não** implementar fluxo de "execução guiada" pelo aluno (timer/stepper).
- **Não** implementar feedback estruturado do aluno (dificuldade/dor) — atleta criança permanece mediado pelo responsável.
- **Não** medir scout / contagem técnica (RN-500).
- **Não** gerar comparação ou ranking entre alunos (RN-602).

## 8. Notificações (gatilhos no [14-modulo-notificacoes.md](14-modulo-notificacoes.md))

| Tipo | Gatilho | Audiência | Preview seguro? |
|------|---------|-----------|------------------|
| `INDIVIDUAL_PLAN_PUBLISHED` | ROT-PLI-04 | responsáveis vinculados | sim (RN-1304) |
| `INDIVIDUAL_PLAN_UPDATED` | alteração em `PUBLISHED` | responsáveis vinculados | sim |
| `INDIVIDUAL_PLAN_PAUSED` | ROT-PLI-05 | responsáveis vinculados | sim |
| `INDIVIDUAL_PLAN_COMPLETED` | ROT-PLI-06 | responsáveis vinculados | sim |
| `INDIVIDUAL_PLAN_CANCELLED` | ROT-PLI-07 | responsáveis vinculados | sim |

## 9. Roadmap (fora da Fase 1)

- **Fase 2:** acompanhamento de progresso (`IndividualPlanProgress`) registrado pelo profissional, histórico de check-ins, possibilidade de o responsável marcar "feito em casa" para sessões opcionais; integração com timeline do filho.
- **Fase 3:** template de plano (biblioteca por profissional para reaproveitar entre alunos), opt-in de IA (Doc 17 §4) para gerar resumo positivo a partir das sessões.
- **Fase 4:** "modo campo" read-only no celular para o profissional executar a sessão com o aluno.
````

### 2.2 **Atualizar** `Docs/01-glossario-e-entidades.md`

- Adicionar termos: **Profissional (Staff)**, **Plano individual**, **Sessão de plano**.
- Adicionar entidade conceitual `StaffProfile` em §2 (relacionada a `User`).
- Adicionar entidade `IndividualPlan` (com `studentId`, `assignedProfessionalId`, `type`, `status`).

### 2.3 **Atualizar** `Docs/02-papeis-e-permissoes.md`

- Em §2.2 (Treinador), adicionar bullet:
  > Quando possui `StaffProfile` (professor / fisioterapeuta / preparador físico), pode prescrever **planos individuais** para alunos vinculados — ver [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md).
- Em §3 (matriz), adicionar linha **"Plano individual (criar/editar)"**: ADMIN ✓ · TREINADOR ✓\* (apenas alunos vinculados) · RESPONSAVEL ✗.
- Em §3, adicionar linha **"Plano individual (visualizar publicado)"**: ADMIN ✓ · TREINADOR ✓\* (suas turmas) · RESPONSAVEL ✓ (filhos vinculados).
- Adicionar **ROT-PERM-03 — Verificar autoria de plano individual** apontando para Doc 24.

### 2.4 **Atualizar** `Docs/04-modulo-alunos-e-responsaveis.md`

- Em §3, adicionar nota em ROT-ALU-03 (inativar aluno):
  > Inativação dispara `RN-1306`: planos individuais `PUBLISHED` do aluno são pausados automaticamente.

### 2.5 **Atualizar** `Docs/14-modulo-notificacoes.md`

- Em §2 (eventos que geram notificação), adicionar 5 novos itens (publicação / atualização / pausa / conclusão / cancelamento de plano individual).
- Em §5 (integração com módulos), adicionar linha **"Planos individuais — gatilhos ROT-PLI-04 a ROT-PLI-07"**.
- Em §6, reforçar que `CA-14.03` (tom seguro) e `CA-03.02` (preview seguro) aplicam-se a planos do tipo `TRATAMENTO` (RN-1304).

### 2.6 **Atualizar** `Docs/18-indice-rotinas-e-aceite.md`

- Em §1, adicionar bloco "Planos individuais" com `ROT-PLI-01` a `ROT-PLI-08` apontando para Doc 24.
- Em §2, adicionar `CA-24.01` a `CA-24.08`.
- Em §3, adicionar `RN-1300` a `RN-1308` na amostra global.
- Em §4, encaixar item **10. Planos individuais** após "Financeiro básico + dashboard".

### 2.7 **Atualizar** `Docs/20-estado-implementacao-mvp.md`

- Em §2 (módulos de negócio), adicionar linha **"24 Planos individuais — Fase 1 entregue / Fase 2 em backlog"** quando o PR fechar.
- Em §5 (lacunas conscientes), adicionar bullet sobre Fase 2/3 do módulo.

### 2.8 **Atualizar** `Docs/exec/plano-execucao-mvp.md`

- Adicionar **Fase 11 — Planos individuais (Doc 24)** após "Fase 10".

---

## 3. Modelagem de dados (Prisma)

### 3.1 Novos enums

```prisma
enum ProfessionalType {
  PROFESSOR
  FISIOTERAPEUTA
  PREPARADOR_FISICO
  OUTRO
}

enum IndividualPlanType {
  TREINO
  REFORCO_TECNICO
  TRATAMENTO
  RECUPERACAO
  OUTRO
}

enum IndividualPlanStatus {
  DRAFT
  PUBLISHED
  PAUSED
  COMPLETED
  CANCELLED
}
```

### 3.2 Novos models

```prisma
model StaffProfile {
  id               String           @id @default(cuid())
  tenantId         String
  tenant           Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId           String           @unique
  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  professionalType ProfessionalType
  registry         String?          // ex.: CREF / CREFITO
  bio              String?          @db.VarChar(280)
  active           Boolean          @default(true)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  individualPlans  IndividualPlan[] @relation("IndividualPlanProfessional")

  @@index([tenantId])
  @@index([tenantId, professionalType])
}

model IndividualPlan {
  id                       String                @id @default(cuid())
  tenantId                 String
  tenant                   Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  studentId                String
  student                  Student               @relation(fields: [studentId], references: [id], onDelete: Cascade)
  assignedProfessionalId   String
  assignedProfessional     StaffProfile          @relation("IndividualPlanProfessional", fields: [assignedProfessionalId], references: [id], onDelete: Restrict)
  type                     IndividualPlanType
  title                    String                @db.VarChar(140)
  goal                     String?               @db.VarChar(500)
  startDate                DateTime              @db.Date
  endDate                  DateTime?             @db.Date
  weeklyFrequency          Int?
  status                   IndividualPlanStatus  @default(DRAFT)
  publishedAt              DateTime?
  pausedAt                 DateTime?
  completedAt              DateTime?
  cancelledAt              DateTime?
  cancelReason             String?
  createdById              String
  createdBy                User                  @relation("IndividualPlanCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt                DateTime              @default(now())
  updatedAt                DateTime              @updatedAt

  sessions                 IndividualPlanSession[]
  audits                   IndividualPlanAudit[]

  @@index([tenantId, studentId])
  @@index([tenantId, assignedProfessionalId])
  @@index([tenantId, status])
}

model IndividualPlanSession {
  id           String                       @id @default(cuid())
  planId       String
  plan         IndividualPlan               @relation(fields: [planId], references: [id], onDelete: Cascade)
  order        Int
  title        String                       @db.VarChar(140)
  instructions String?                      @db.VarChar(1000)
  estimatedDurationMinutes Int?

  exercises    IndividualPlanExercise[]

  @@unique([planId, order])
}

model IndividualPlanExercise {
  id              String                  @id @default(cuid())
  sessionId       String
  session         IndividualPlanSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  order           Int
  name            String                  @db.VarChar(140)
  description     String?                 @db.VarChar(500)
  videoUrl        String?
  sets            Int?
  repetitions     Int?
  durationSeconds Int?
  restSeconds     Int?
  notes           String?                 @db.VarChar(280)

  @@unique([sessionId, order])
}

model IndividualPlanAudit {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  planId       String
  plan         IndividualPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  action       String   // PUBLISH | UPDATE | PAUSE | RESUME | COMPLETE | CANCEL | REASSIGN
  previousJson Json?
  nextJson     Json?
  reason       String?
  createdById  String
  createdBy    User     @relation("IndividualPlanAuditActor", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt    DateTime @default(now())

  @@index([tenantId, planId])
}
```

**Atualizações em models existentes:**

- `Tenant`: adicionar relações inversas `staffProfiles`, `individualPlans`, `individualPlanAudits`.
- `User`: adicionar relação inversa `staffProfile StaffProfile?` e `individualPlansCreated IndividualPlan[] @relation("IndividualPlanCreatedBy")` e `individualPlanAudits IndividualPlanAudit[] @relation("IndividualPlanAuditActor")`.
- `Student`: adicionar relação inversa `individualPlans IndividualPlan[]`.

### 3.3 Migration

Nome sugerido: `20260510120000_individual_plans` (ajustar para a data do PR; manter o padrão das migrations existentes em `backend/prisma/migrations/`).

---

## 4. Backend — escopo da Fase 1

### 4.1 Novos módulos NestJS

```
backend/src/staff/
  staff.module.ts
  staff.controller.ts          // CRUD profissional (ADMIN)
  staff.service.ts
  dto/{create-staff.dto.ts,update-staff.dto.ts}

backend/src/individual-plans/
  individual-plans.module.ts
  individual-plans.controller.ts        // ADMIN + TREINADOR autor
  individual-plans.service.ts
  individual-plan-sessions.controller.ts
  individual-plan-exercises.controller.ts
  scope.guard.ts                         // CA-24.01
  dto/
    create-plan.dto.ts
    update-plan.dto.ts
    create-session.dto.ts
    update-session.dto.ts
    create-exercise.dto.ts
    update-exercise.dto.ts
    publish-plan.dto.ts
    pause-plan.dto.ts
    cancel-plan.dto.ts

backend/src/guardian-portal/
  individual-plans.controller.ts        // GET-only, RESPONSAVEL
```

### 4.2 Endpoints

| Método | Rota | Papel | Notas |
|--------|------|-------|-------|
| `POST`   | `/staff`                                   | ADMIN | cria `User` (role TREINADOR) + `StaffProfile`. |
| `GET`    | `/staff`                                   | ADMIN | lista profissionais do tenant. |
| `PATCH`  | `/staff/:id`                               | ADMIN | atualizar `professionalType`, `registry`, `active`. |
| `GET`    | `/students/:studentId/individual-plans`    | ADMIN, TREINADOR vinculado | lista planos do aluno. |
| `POST`   | `/students/:studentId/individual-plans`    | ADMIN, TREINADOR vinculado | cria plano (`status=DRAFT`). |
| `GET`    | `/individual-plans/:id`                    | ADMIN, autor, TREINADOR da turma | detalhe completo (mascarar detalhe se TRATAMENTO + não-autor). |
| `PATCH`  | `/individual-plans/:id`                    | ADMIN, autor | metadados. |
| `POST`   | `/individual-plans/:id/sessions`           | ADMIN, autor | cria sessão. |
| `PATCH`  | `/individual-plans/:id/sessions/:sessionId`| ADMIN, autor | atualiza sessão. |
| `DELETE` | `/individual-plans/:id/sessions/:sessionId`| ADMIN, autor | remove sessão. |
| `POST`   | `/individual-plan-sessions/:id/exercises`  | ADMIN, autor | cria exercício. |
| `PATCH`  | `/individual-plan-sessions/:id/exercises/:exerciseId` | ADMIN, autor | atualiza. |
| `DELETE` | `/individual-plan-sessions/:id/exercises/:exerciseId` | ADMIN, autor | remove. |
| `POST`   | `/individual-plans/:id/publish`            | ADMIN, autor | dispara `INDIVIDUAL_PLAN_PUBLISHED`. |
| `POST`   | `/individual-plans/:id/pause`              | ADMIN, autor | dispara `INDIVIDUAL_PLAN_PAUSED`. |
| `POST`   | `/individual-plans/:id/resume`             | ADMIN, autor | volta a `PUBLISHED` + notificação. |
| `POST`   | `/individual-plans/:id/complete`           | ADMIN, autor | dispara `INDIVIDUAL_PLAN_COMPLETED`. |
| `POST`   | `/individual-plans/:id/cancel`             | ADMIN, autor | requer `reason`; dispara `INDIVIDUAL_PLAN_CANCELLED`. |
| `POST`   | `/individual-plans/:id/reassign`           | ADMIN | troca `assignedProfessionalId`; auditoria. |
| `GET`    | `/guardian/children/:studentId/individual-plans` | RESPONSAVEL | lista planos `PUBLISHED/PAUSED/COMPLETED/CANCELLED` do filho. |
| `GET`    | `/guardian/individual-plans/:id`           | RESPONSAVEL | detalhe (sem `DRAFT`). |

Todos: filtro por `tenantId` derivado do JWT (`CA-17.01`); guards reutilizando padrões existentes (`JwtAuthGuard`, `RolesGuard`).

### 4.3 Integração com `NotificationsService`

- Novos `category` em `NotificationPreference`: `individual_plan` (default `inAppEnabled = true`; **não-silenciável** para `TRATAMENTO`-publish — política mínima alinhada a `RN-1101`).
- Em `notifications.service`, novo helper `notifyIndividualPlanEvent({ planId, type, recipients, isClinical })` que:
  - calcula `dedupeKey` conforme `CA-24.03/05`;
  - usa templates seguros (`title` e `body` genéricos quando `isClinical = true`);
  - escreve `Notification` por responsável vinculado.

### 4.4 Hooks de domínio

- Em `students.service.ts`, ao inativar aluno: chamar `individualPlansService.pauseAllPublishedFor(studentId, reason='STUDENT_INACTIVATED')` (RN-1306, CA-24.06).
- Em `individualPlansService.publish/pause/complete/cancel/reassign`: gravar `IndividualPlanAudit` em transação.

### 4.5 Testes E2E mínimos

Criar `backend/test/individual-plans-flow.e2e-spec.ts`:

1. ADMIN cadastra `StaffProfile`.
2. ADMIN cria plano em DRAFT → responsável **não** vê (CA-24.02).
3. ADMIN publica → responsável vê + recebe notificação com preview seguro (CA-24.03 + CA-24.04 quando `TRATAMENTO`).
4. Outro tenant tenta acessar → 404 (CA-03.01 / CA-24.08).
5. TREINADOR sem vínculo tenta criar → 403 (CA-24.01).
6. ADMIN inativa aluno com plano publicado → status vira `PAUSED` (CA-24.06).
7. Edição relevante em PUBLISHED gera 1 notificação por dia, mesmo com 3 alterações (CA-24.05).

---

## 5. Frontend — escopo da Fase 1

### 5.1 Novas rotas (`frontend/src/App.tsx`)

```tsx
<Route path="/gestao/profissionais" element={<Profissionais />} />
<Route path="/gestao/profissionais/:id" element={<ProfissionalDetail />} />
<Route path="/alunos/:id/planos" element={<PlanosAluno />} />
<Route path="/alunos/:id/planos/:planId" element={<PlanoEditor />} />
<Route path="/filhos/:studentId/planos" element={<FilhoPlanos />} />
<Route path="/filhos/:studentId/planos/:planId" element={<FilhoPlanoDetail />} />
```

### 5.2 Páginas e componentes novos

- `pages/Profissionais.tsx` — lista + criar (ADMIN).
- `pages/ProfissionalDetail.tsx` — editar `professionalType`, `registry`, `active`.
- `pages/PlanosAluno.tsx` — aba dentro do perfil do aluno; lista ativa + histórico; CTA "Novo plano".
- `pages/PlanoEditor.tsx` — formulário de metadados + **CRUD completo de sessões e exercícios** (séries, reps, tempo, descanso, vídeo, notas) via modais reutilizando `Modal.tsx` e `ConfirmDialog.tsx`; ações `Publicar`, `Pausar`, `Retomar`, `Concluir`, `Cancelar` conforme status. **Critério `CA-24.09` obrigatório.**
- `pages/FilhoPlanos.tsx` — lista no portal do responsável (sem `DRAFT`).
- `pages/FilhoPlanoDetail.tsx` — detalhe do plano com tom positivo, sem comparação.
- `components/PlanStatusBadge.tsx` — badge semântico (DRAFT cinza, PUBLISHED verde, PAUSED âmbar, COMPLETED neutro, CANCELLED vermelho suave) seguindo tokens do [Doc 19](../19-design-system-brand-guide.md).

### 5.3 Pontos de entrada existentes a tocar

- `pages/StudentDetail.tsx`: adicionar aba/seção **"Planos individuais"** com link para `/alunos/:id/planos`.
- `pages/Filho.tsx`: adicionar bloco **"Planos individuais"** com últimos 3 + link "Ver tudo" → `/filhos/:studentId/planos`.
- `pages/home/HomeCoach.tsx`: bloco **"Planos sob meus cuidados"** com 3 mais recentes (status + nome do aluno) — só se o usuário tiver `StaffProfile`.
- `pages/home/HomeGuardian.tsx`: bloco **"Acompanhamentos"** se houver plano `PUBLISHED` para algum filho.
- `pages/home/HomeAdmin.tsx`: bloco **"Profissionais ativos"** com contagem; KPI auxiliar.
- `pages/Notificacoes.tsx` / centro de notificações: garantir templates dos novos `type` exibirem somente preview seguro.
- `pages/Preferencias.tsx`: adicionar categoria `individual_plan` na UI de preferências (in-app), respeitando `RN-1101`.

### 5.4 Microcopy obrigatório

- Notificação `INDIVIDUAL_PLAN_PUBLISHED` (TRATAMENTO): título "Novo plano de acompanhamento para {nome do filho}"; body "Abra o portal para ver os detalhes." (sem `goal`/sessões).
- Notificação `INDIVIDUAL_PLAN_PUBLISHED` (TREINO/REFORCO/RECUPERACAO/OUTRO): título "Novo plano para {nome do filho}"; body "{tipo} prescrito por {primeiro nome do profissional}.".
- Empty state no portal do responsável: "Quando houver um acompanhamento individual para {nome do filho}, ele aparece aqui."

---

## 6. ROT/CA novos (síntese para `Docs/18`)

| ID | Resumo | Fonte |
|----|--------|-------|
| ROT-PLI-01 | Cadastrar profissional | Doc 24 §5 |
| ROT-PLI-02 | Criar plano individual | Doc 24 §5 |
| ROT-PLI-03 | Editar sessões/exercícios | Doc 24 §5 |
| ROT-PLI-04 | Publicar plano | Doc 24 §5 |
| ROT-PLI-05 | Pausar / retomar | Doc 24 §5 |
| ROT-PLI-06 | Concluir | Doc 24 §5 |
| ROT-PLI-07 | Cancelar | Doc 24 §5 |
| ROT-PLI-08 | Visualizar (responsável) | Doc 24 §5 |
| CA-24.01 | Escopo: profissional só prescreve para vinculado | Doc 24 §6 |
| CA-24.02 | DRAFT invisível ao responsável | Doc 24 §6 |
| CA-24.03 | Publicação dispara 1 notificação por responsável (idempotência) | Doc 24 §6 |
| CA-24.04 | Preview seguro para TRATAMENTO | Doc 24 §6 + CA-03.02 |
| CA-24.05 | Atualização agregada por dia | Doc 24 §6 |
| CA-24.06 | Inativar aluno pausa planos publicados | Doc 24 §6 |
| CA-24.07 | Não-autor não edita; reatribuição auditada | Doc 24 §6 |
| CA-24.08 | Isolamento entre tenants verificado | Doc 24 §6 + CA-03.01 |
| CA-24.09 | UI completa de sessão e exercício no `PlanoEditor` | Doc 24 §6 |
| CA-24.10 | Biblioteca de exercícios (compartilhada por tenant) reutilizável em sessões com snapshot | Doc 24 §6 |
| CA-24.11 | Edição/arquivamento de item da biblioteca restritos ao autor ou ADMIN | Doc 24 §6 |
| ROT-PLI-09 | Manter biblioteca de exercícios | Doc 24 §5 |
| ROT-PLI-10 | Adicionar exercício da biblioteca à sessão | Doc 24 §5 |
| RN-1309 | Visibilidade compartilhada e regra de autoria da biblioteca | Doc 24 §3 |
| RN-1310 | Snapshot ao copiar template para `IndividualPlanExercise` | Doc 24 §3 |

---

## 7. Ordem sugerida de PRs (Fase 1)

| # | PR | Conteúdo | Dependências |
|---|----|----------|--------------|
| 1 | **PI-1 — Specs** | criar Doc 24 + atualizar Docs 01, 02, 04, 14, 18, 20, 24 e `exec/plano-execucao-mvp.md` | nenhuma |
| 2 | **PI-2 — Schema + auth** | migration Prisma + seed mínimo (1 profissional demo) + `staff` module/CRUD + permissões | PI-1 |
| 3 | **PI-3 — CRUD plano (DRAFT)** | `individual-plans` module: criar/editar plano, sessões e exercícios, todos em DRAFT; testes unit+e2e | PI-2 |
| 4 | **PI-4 — Publicação + notificação** | endpoints `publish/pause/resume/complete/cancel/reassign` + integração com `NotificationsService` (templates seguros) + auditoria + hook de inativação de aluno (RN-1306) | PI-3 |
| 5 | **PI-5 — Frontend ADMIN/TREINADOR** | `Profissionais`, `PlanosAluno`, `PlanoEditor`, badge de status, atalhos no `StudentDetail` e `HomeCoach`/`HomeAdmin` | PI-4 |
| 5.1 | **PI-5.1 — UI completa de sessão e exercício** | refator de `PlanoEditor.tsx`: tipos completos para `Session.exercises`; modais (`Modal.tsx`) para criar/editar sessão e exercício (com séries, reps, tempo, descanso, vídeo, notas); confirmação de remoção (`ConfirmDialog.tsx`). Substitui `window.prompt` na criação de sessão. **CA-24.09**. | PI-5 |
| 5.2 | **PI-5.2 — Biblioteca de exercícios** | novo `ExerciseLibraryItem` (Prisma + migration); módulo backend `exercise-library` (CRUD + arquivar/restaurar); endpoint `POST /individual-plan-sessions/:id/exercises/from-library` com **snapshot** (RN-1310); `frontend/src/pages/BibliotecaExercicios.tsx` em rota `/biblioteca/exercicios`; atalho de menu para ADMIN e TREINADOR com `staffProfile.active`; integração no modal de exercício do `PlanoEditor` ("Adicionar da biblioteca" + overrides). **CA-24.10 e CA-24.11**. ⚠ Após mergear: rodar `npm --prefix backend run prisma:migrate` (faz `migrate dev` + `generate`) e reiniciar o backend para o cliente Prisma carregar `exerciseLibraryItem`; senão `GET /api/exercise-library` devolve 500 com `Cannot read properties of undefined (reading 'findMany')`. | PI-5.1 |
| 6 | **PI-6 — Frontend RESPONSAVEL** | `FilhoPlanos`, `FilhoPlanoDetail`, bloco "Acompanhamentos" no `HomeGuardian`, categoria de preferência | PI-4 |
| 7 | **PI-7 — Hardening + QA** | testes E2E completos (CA-24.01–11), instrumentação mínima de uso (eventos `individual_plan.published`, etc.), atualização de `Doc 20` declarando módulo entregue | PI-3..PI-6 |

Cada PR mantém **regressão verde** (`npm test` no `backend/` + `npm run lint` no `frontend/`).

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Vazar dado clínico em preview de notificação (CA-03.02) | Templates centralizados no `NotificationsService`; teste unitário com `type=TRATAMENTO` garantindo body genérico. |
| Profissional editar plano de aluno fora de seu escopo | `IndividualPlanScopeGuard` checa: (a) `assignedProfessionalId == requesterStaffProfileId`, **ou** (b) requester é ADMIN do tenant. Teste E2E para 403. |
| Notificações em massa ao publicar grandes alterações | Dedupe por `(planId, dia)` no `dedupeKey`; uma só notificação `INDIVIDUAL_PLAN_UPDATED` por dia por responsável. |
| Inflar lista do responsável com planos cancelados antigos | Default lista responsável: `status ∈ {PUBLISHED, PAUSED, COMPLETED}` últimos 12 meses; histórico completo via filtro explícito. |
| Aumento de carga cognitiva do treinador (RN-000) | Profissional **não é treinador-de-campo** por default. Treinador comum sem `StaffProfile` **não vê** UI de criar plano. CTA "Novo plano" só aparece se `staffProfile.active = true`. |
| Confusão de papel (treinador vs profissional) | `StaffProfile.professionalType` exibido como tag visível ao lado do nome em telas de plano. |

---

## 9. Definição de pronto (Fase 1)

1. Specs atualizadas conforme §2; PR de specs revisado e aprovado.
2. Migration aplicada em dev (`npx prisma migrate dev`) sem erro.
3. Endpoints da §4.2 cobertos por testes E2E (cobertura mínima das CA-24.01–08).
4. Frontend renderiza criação, publicação e visualização (admin/coach/responsável) usando `apiFetch` existente.
5. Notificações respeitam `dedupeKey` + preview seguro (validação manual com tipo `TRATAMENTO`).
6. Inativação de aluno em `students.service` aciona pausa automática (auditada).
7. `Docs/20-estado-implementacao-mvp.md` atualizado: linha "24 Planos individuais — Fase 1 entregue".
8. README ou `Docs/exec/plano-producao.md` mencionam a categoria nova de notificação.

---

## 10. Fases seguintes (somente referência, fora do escopo)

- **Fase 2:** `IndividualPlanProgress` (check-in do profissional/responsável) + integração com timeline do filho.
- **Fase 3:** template de plano (biblioteca) + opt-in de IA para gerar resumo positivo (Doc 17 §4).
- **Fase 4:** "modo campo" mobile-first read-only para o profissional executar a sessão (inspirado em `TrainingExecution.tsx` do projeto irmão `personal-futebol-mvp`, sem feedback estruturado do aluno).

---

## Documentação relacionada

- Spec do módulo (a criar): `Docs/24-modulo-planos-individuais.md`
- Prompt de execução para Cursor: [prompt-sdd-planos-individuais.md](prompt-sdd-planos-individuais.md)
- Visão e RN-000: [00-visao-e-objetivos.md](../00-visao-e-objetivos.md)
- Permissões: [02-papeis-e-permissoes.md](../02-papeis-e-permissoes.md)
- Multi-tenant e LGPD: [03-multi-tenant-e-lgpd.md](../03-multi-tenant-e-lgpd.md)
- Notificações: [14-modulo-notificacoes.md](../14-modulo-notificacoes.md)
- Índice ROT/CA: [18-indice-rotinas-e-aceite.md](../18-indice-rotinas-e-aceite.md)
- Estado da implementação: [20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md)
- UX/PO: [21-opinioes-melhoria-ux-po.md](../21-opinioes-melhoria-ux-po.md)
- Design system: [19-design-system-brand-guide.md](../19-design-system-brand-guide.md)
