# Prompt SDD — Implementação Fase 1 do Módulo "Planos Individuais"

Documento autocontido para colar em agente Cursor (ou outro), épico ou briefing técnico. Implementa a Fase 1 do plano em [plano-implementacao-planos-individuais.md](plano-implementacao-planos-individuais.md).

---

## 1. Papel e missão

Você é **engenheiro(a) de software sênior** atuando em monorepo **NestJS + Prisma + PostgreSQL** (backend) e **React + Vite** (frontend), produto **SaaS multi-tenant para escolinhas de futebol**.

**Missão:** entregar a **Fase 1** do módulo **Planos Individuais** descrito em [plano-implementacao-planos-individuais.md](plano-implementacao-planos-individuais.md) e na nova spec **`Docs/24-modulo-planos-individuais.md`** (que **você** criará neste trabalho), permitindo que profissionais (professor / fisioterapeuta / preparador físico) prescrevam planos a alunos vinculados, com publicação, notificação ao responsável e visualização no portal — sem alterar a rotina do treinador de campo.

---

## 2. Regras não negociáveis

- **RN-000** ([00-visao-e-objetivos.md](../00-visao-e-objetivos.md)): o sistema **não pode aumentar o trabalho operacional do treinador de campo**. CTAs de "Novo plano" e UI de plano só aparecem para usuários com `StaffProfile.active = true`. Treinador comum não vê fluxo novo.
- **CA-03.01 / CA-17.01** ([03-multi-tenant-e-lgpd.md](../03-multi-tenant-e-lgpd.md), [17-arquitetura-e-stack-sugerida.md](../17-arquitetura-e-stack-sugerida.md)): toda query carrega `tenantId` derivado do JWT; **nunca** aceitar `tenantId` arbitrário do cliente. Teste E2E cross-tenant é obrigatório.
- **CA-03.02 + RN-1304** (novo): notificações ligadas a plano `TRATAMENTO` **não** podem expor `goal`/sessões em preview; apenas título genérico + nome do filho.
- **RN-602** ([09-modulo-relatorios-pais.md](../09-modulo-relatorios-pais.md)): tom positivo no portal do responsável; nunca comparar com outros alunos; nenhuma listagem coletiva de planos entre crianças.
- **RN-103 + RN-1306**: inativar aluno (`students.service`) deve disparar pausa automática (`PUBLISHED → PAUSED`, motivo `STUDENT_INACTIVATED`) auditada; isto também é **CA-24.06**.
- **Design**: seguir tokens e padrões em [19-design-system-brand-guide.md](../19-design-system-brand-guide.md); badges semânticos para status do plano (DRAFT/PUBLISHED/PAUSED/COMPLETED/CANCELLED).
- **Estado do código** ([20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md)): reusar `JwtAuthGuard`, `RolesGuard`, `NotificationsService`, padrões de auditoria já existentes (ex.: `CalendarEventAudit`, `FinancialChargeAudit`, `StudentDeletionAudit`). **Não duplicar** infra.

---

## 3. Fontes de verdade (leitura obrigatória)

| Tema | Documento |
|------|-----------|
| Plano completo da Fase 1 | [plano-implementacao-planos-individuais.md](plano-implementacao-planos-individuais.md) |
| Spec a criar | `Docs/24-modulo-planos-individuais.md` (texto íntegro embebido em §2.1 do plano) |
| Visão / RN-000 | [00-visao-e-objetivos.md](../00-visao-e-objetivos.md) |
| Permissões | [02-papeis-e-permissoes.md](../02-papeis-e-permissoes.md) |
| Tenant + LGPD | [03-multi-tenant-e-lgpd.md](../03-multi-tenant-e-lgpd.md) |
| Alunos / responsáveis | [04-modulo-alunos-e-responsaveis.md](../04-modulo-alunos-e-responsaveis.md) |
| Notificações | [14-modulo-notificacoes.md](../14-modulo-notificacoes.md) |
| Índice ROT/CA | [18-indice-rotinas-e-aceite.md](../18-indice-rotinas-e-aceite.md) |
| Design / a11y | [19-design-system-brand-guide.md](../19-design-system-brand-guide.md) |
| Estado do código | [20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md) |

Antes de codar **leia o plano e a spec** e confirme em comentário do PR que entendeu o escopo da Fase 1 (publicação + notificação; **sem** progresso/check-in, **sem** execução guiada do aluno).

---

## 4. Escopo da Fase 1 por IDs

Implementar pela ordem dos PRs sugerida na §7 do plano.

### PI-1 — Specs

**Criar:**

- `Docs/24-modulo-planos-individuais.md` com o texto de §2.1 do plano (copiar fielmente).

**Atualizar:**

- `Docs/01-glossario-e-entidades.md` — termos `Profissional (Staff)`, `Plano individual`, `Sessão de plano`; entidades `StaffProfile` e `IndividualPlan`.
- `Docs/02-papeis-e-permissoes.md` — bullet em §2.2 + 2 linhas na matriz §3 + ROT-PERM-03.
- `Docs/04-modulo-alunos-e-responsaveis.md` — nota em ROT-ALU-03 sobre RN-1306.
- `Docs/14-modulo-notificacoes.md` — 5 eventos novos em §2 + linha em §5; reforço em §6.
- `Docs/18-indice-rotinas-e-aceite.md` — bloco "Planos individuais" (§1), CA-24.01–08 (§2), RN-1300–1308 (§3), item "10. Planos individuais" (§4).
- `Docs/exec/plano-execucao-mvp.md` — adicionar **Fase 11**.

**Critério de pronto:** specs lintam (markdown coerente), links funcionam, PR de specs vai sozinho ou junto ao PI-2.

### PI-2 — Schema + Staff + auth

- Adicionar enums e models em `backend/prisma/schema.prisma` exatamente como §3.1/§3.2 do plano.
- Gerar migration `<timestamp>_individual_plans` via `npx prisma migrate dev` (ou `migrate diff` em ambiente sem dev DB).
- Atualizar relações inversas em `Tenant`, `User`, `Student`.
- Estender seed (`backend/prisma/seed.ts`): criar **1 profissional demo** (`PROFESSOR`) vinculado ao tenant demo já existente.
- Implementar `staff/` module com endpoints em §4.2 do plano (`POST/GET/PATCH /staff`).
- Permissões: somente ADMIN; `tokenVersion` respeitado.

**Critério de pronto:** `npm test` no `backend/` verde; teste unitário criando StaffProfile e validando 403 para TREINADOR sem permissão.

### PI-3 — CRUD plano em DRAFT

- Criar `individual-plans/` module + sub-controllers de sessões e exercícios.
- Implementar `IndividualPlanScopeGuard`: requester é ADMIN do tenant **ou** `assignedProfessionalId` corresponde ao `StaffProfile` do requester. Vínculo aceito: aluno em turma do profissional **ou** plano explicitamente atribuído ao profissional.
- DTOs com `class-validator`. Tamanhos máximos conforme schema (ex.: `title VarChar(140)`, `goal VarChar(500)`, `notes VarChar(280)`).
- Status inicial sempre `DRAFT`; alteração de status só pelos endpoints específicos da PI-4.

**Critério de pronto:** ADMIN e profissional-autor conseguem criar/editar plano e suas sessões; outro treinador recebe 403 (CA-24.01); outro tenant recebe 404 (CA-24.08).

### PI-4 — Publicação, notificação e auditoria

- Endpoints `publish/pause/resume/complete/cancel/reassign` com transações.
- Cada transição grava `IndividualPlanAudit` (`previousJson`, `nextJson`, `reason?`).
- Integração com `NotificationsService`:
  - Novo helper `notifyIndividualPlanEvent({ planId, type, isClinical })`.
  - `dedupeKey`:
    - publicar: `ind-plan-publish:{planId}` (CA-24.03)
    - atualizar (após publicado): `ind-plan-update:{planId}:{yyyy-mm-dd}` (CA-24.05)
    - pause/resume/complete/cancel: `ind-plan-{action}:{planId}`
  - Templates de título/body por tipo. **Para `TRATAMENTO`**: body genérico, sem `goal` nem nomes de sessão (CA-24.04).
  - Categoria de preferência: `individual_plan` (default in-app on; **publicar** para `TRATAMENTO` ignora silenciamento — política mínima).
- Hook em `students.service.ts`: ao inativar aluno, chamar `individualPlansService.pauseAllPublishedFor(studentId, 'STUDENT_INACTIVATED')` (RN-1306, CA-24.06).

**Critério de pronto:** E2E em `backend/test/individual-plans-flow.e2e-spec.ts` cobre cenários §4.5 do plano.

### PI-5 — Frontend ADMIN/TREINADOR

- Novas rotas em `frontend/src/App.tsx` (§5.1 do plano).
- Páginas `Profissionais.tsx`, `ProfissionalDetail.tsx`, `PlanosAluno.tsx`, `PlanoEditor.tsx`.
- Componente `PlanStatusBadge.tsx` reutilizável.
- Aba/seção **"Planos individuais"** em `pages/StudentDetail.tsx`.
- Bloco **"Planos sob meus cuidados"** em `pages/home/HomeCoach.tsx` (somente se `staffProfile.active`).
- KPI "Profissionais ativos" em `pages/home/HomeAdmin.tsx`.
- Estados: loading (skeleton), erro com retry, empty state com CTA conforme convenções existentes.

**Critério de pronto:** ADMIN cria profissional, profissional cria/publica plano, badge de status visível, fluxo coberto por teste manual roteirizado.

### PI-6 — Frontend RESPONSAVEL

- Páginas `FilhoPlanos.tsx` e `FilhoPlanoDetail.tsx` no portal do responsável.
- Bloco **"Acompanhamentos"** em `pages/home/HomeGuardian.tsx` apenas se houver `PUBLISHED`.
- Categoria `individual_plan` em `pages/Preferencias.tsx`.
- Centro de notificações (`pages/Notificacoes.tsx`): garantir que os novos `type` exibam o preview seguro vindo do backend (não montar body cliente-side a partir de payload sensível).
- Microcopy de §5.4 do plano aplicada exatamente.

**Critério de pronto:** responsável vê apenas planos `PUBLISHED/PAUSED/COMPLETED/CANCELLED` dos filhos vinculados; nenhum `DRAFT` aparece; `CA-02.02` reverificado.

### PI-7 — Hardening + QA

- Cobrir CA-24.01 a CA-24.08 com testes (E2E + unit onde aplicável).
- Adicionar instrumentação mínima: emitir log estruturado `event=individual_plan.published` (e demais transições) sem incluir `goal`, sessão ou texto livre.
- Atualizar `Docs/20-estado-implementacao-mvp.md` declarando módulo Fase 1 entregue.
- `npm run lint` no `frontend/` verde; `npm test` no `backend/` verde; checklist do `Docs/exec/plano-producao.md` reavaliado quando aplicável.

---

## 5. Definição de pronto (global da Fase 1)

1. Specs §2 do plano aplicadas; novo Doc 24 publicado.
2. Migration aplicada limpa; seed cria 1 profissional demo.
3. Endpoints da §4.2 do plano cobertos por E2E.
4. Frontend renderiza criação, publicação e visualização (admin/coach/responsável).
5. Notificação respeita `dedupeKey` + preview seguro (validado manualmente em `TRATAMENTO`).
6. Inativação de aluno pausa planos publicados automaticamente.
7. `Docs/20-estado-implementacao-mvp.md` atualizado.
8. Sem regressão: `backend/test/*` e `frontend lint` continuam verdes.

---

## 6. Riscos e mitigação (lembretes ao codar)

| Risco | Mitigação |
|-------|-----------|
| Vazar dado clínico em preview de notificação | Templates centralizados; teste com `type=TRATAMENTO`. |
| Profissional editar fora do escopo | `IndividualPlanScopeGuard` com testes explícitos 403/404. |
| Inflar centro de notificações | `dedupeKey` por dia para `UPDATED`; uma só por publicar/pausar/concluir. |
| RN-000 violado | UI de criação **não** aparece para treinador comum sem `StaffProfile`. |
| Aumentar carga cognitiva no perfil do aluno | Aba "Planos individuais" colapsada por padrão se vazia. |

---

## 7. Antiescopo da Fase 1 (não fazer)

- **Não** implementar `IndividualPlanProgress` / check-in.
- **Não** implementar execução guiada (timer/stepper) para o aluno.
- **Não** implementar feedback estruturado do aluno/responsável.
- **Não** integrar com timeline do filho ainda (Fase 2 do roadmap em §10 do plano).
- **Não** introduzir IA (Doc 17 §4 — opt-in futuro).
- **Não** criar nova role no enum `UserRole`. Usar `TREINADOR` + `StaffProfile.professionalType`.

---

## 8. Entregáveis

- Código em `backend/` e `frontend/` seguindo padrões do repositório.
- PRs **pequenos e revisáveis** por ID (PI-1 a PI-7), nessa ordem.
- Atualização sincronizada de `Docs/20-estado-implementacao-mvp.md` no PI-7.
- Lista de eventos de instrumentação em comentário do PI-7.

---

## 9. Início imediato

1. Ler `plano-implementacao-planos-individuais.md` por completo.
2. Abrir PR **PI-1 (specs)** criando o Doc 24 e atualizando 01/02/04/14/18/20 + `exec/plano-execucao-mvp.md`.
3. Em paralelo, planejar a migration do PI-2 e validar nomes de relação inversa em `User` / `Tenant` / `Student` para evitar conflito com colunas existentes.
4. Não expandir escopo além da Fase 1 sem decisão explícita de produto.

---

*Prompt SDD alinhado ao plano `plano-implementacao-planos-individuais.md`; criado para orientar a entrega da Fase 1 do módulo Planos Individuais.*
