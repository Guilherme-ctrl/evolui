# 24 — Módulo: Planos individuais

> **Atualização mai/2026 (Doc 25):** o tipo `TREINO` foi extraído deste módulo
> para o novo [Doc 25 — Treinos (workouts)](25-modulo-treinos.md) — RN-1320.
> `IndividualPlan` passa a aceitar apenas `TRATAMENTO` clínico no `POST` (UI do
> `PlanoEditor` mostra somente "Tratamento clínico"). Treinos genéricos (turma
> ou aluno) são criados em `/treinos` e atribuídos via `WorkoutAssignment`.

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
| **Biblioteca de exercícios** | Catálogo compartilhado por tenant de **templates** de exercício reutilizáveis (`ExerciseLibraryItem`). Adicionar um template a uma sessão produz um **snapshot** independente — editar a biblioteca depois NÃO altera exercícios já inseridos em planos. |
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
| RN-1309 | Biblioteca de exercícios é **compartilhada por tenant**: qualquer `StaffProfile.active` consegue listar/usar todos os itens; somente o autor (`ownerStaffId`) ou ADMIN do tenant pode editar/arquivar. ADMIN sem `StaffProfile.active` não pode **criar** itens (precisa de perfil profissional próprio). |
| RN-1310 | Adicionar exercício de biblioteca à sessão produz **snapshot**: o `IndividualPlanExercise` resultante é independente do `ExerciseLibraryItem`. Edições posteriores no template não alteram exercícios já inseridos em planos. |

## 4. Visibilidade

| Papel | O que vê |
|-------|----------|
| ADMIN | Todos os planos do tenant; pode reatribuir, pausar, cancelar. |
| TREINADOR (autor) | Seus próprios planos + planos dos alunos das suas turmas (somente leitura para os de outros profissionais). |
| TREINADOR (não autor) | Lista resumida (existência do plano + tipo + status) sem detalhe clínico se for `TRATAMENTO`. |
| RESPONSAVEL | Planos `PUBLISHED` (e `PAUSED/COMPLETED/CANCELLED` históricos) dos filhos vinculados **ou** do aluno para o qual o usuário é titular autônomo (`selfManagedPortal` + `portalUserId`, equivalente a responsável vinculado — **RN-1402**, Doc 04). **Nunca** planos em `DRAFT`. |

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

**Detalhe operacional (UI):** o editor do plano deve permitir, em uma única tela: (a) criar / editar / remover sessão (campos `title`, `instructions?`, `estimatedDurationMinutes?`); (b) dentro de cada sessão, criar / editar / remover exercício com **todos** os campos do schema (`name`, `description?`, `videoUrl?`, `sets?`, `repetitions?`, `durationSeconds?`, `restSeconds?`, `notes?`); (c) leitura escaneável dos exercícios já cadastrados (séries × reps · tempo · descanso). A escrita usa os endpoints REST descritos em [exec/plano-implementacao-planos-individuais.md §4.2](exec/plano-implementacao-planos-individuais.md). Diálogos de confirmação obrigatórios em remoção (`ConfirmDialog`).

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

### ROT-PLI-09 — Manter biblioteca de exercícios

**Ator:** TREINADOR com `StaffProfile.active` ou ADMIN com `StaffProfile.active`.
**Pré-condição:** acesso à rota `/biblioteca/exercicios`.
**Passos:**
1. Listar / buscar (por nome, case-insensitive) / alternar visibilidade de arquivados.
2. Criar item (nome obrigatório; descrição, vídeo, defaults `sets`, `repetitions`, `durationSeconds`, `restSeconds`, `notes` opcionais) — `ownerStaffId` = staff do criador.
3. Editar item (somente autor ou ADMIN — RN-1309).
4. Arquivar / restaurar item (não há exclusão hard — itens arquivados deixam de aparecer em `from-library`, mas mantêm histórico).

**Pós-condição:** itens disponíveis para uso em qualquer sessão de plano via fluxo "Adicionar da biblioteca".

### ROT-PLI-10 — Adicionar exercício à sessão a partir da biblioteca

**Ator:** autor do plano ou ADMIN.
**Pré-condição:** plano em estado mutável (`DRAFT`/`PUBLISHED`/`PAUSED`); existe item de biblioteca não arquivado.
**Passos:** no `PlanoEditor`, ao adicionar exercício a uma sessão: buscar item da biblioteca → selecionar → o formulário pré-preenche `name`, `description`, `videoUrl`, `notes` e os defaults numéricos; o profissional pode aplicar **overrides** apenas em `sets`, `repetitions`, `durationSeconds`, `restSeconds`, `notes` antes de salvar.
**Pós-condição:** novo `IndividualPlanExercise` criado como **snapshot** (RN-1310); para planos `PUBLISHED`, vale a mesma trilha de auditoria/notificação de qualquer alteração relevante.

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
- **CA-24.09:** o editor do plano (frontend) expõe **CRUD completo de sessão e de exercício** (nome, descrição, vídeo, séries, repetições, tempo, descanso, notas) com modais acessíveis e confirmação em remoção; a tela é considerada incompleta se algum desses campos não puder ser editado pela UI quando o plano permite alteração de conteúdo (`status ∈ {DRAFT, PUBLISHED, PAUSED}`).
- **CA-24.10:** existe **biblioteca de exercícios** compartilhada por tenant (`/biblioteca/exercicios`) com CRUD + arquivamento; o autor de um plano consegue, ao montar uma sessão, **adicionar um exercício da biblioteca em ≤ 2 cliques** (selecionar item + Salvar) e o exercício resultante é independente do template (snapshot — RN-1310).
- **CA-24.11:** somente o autor (`ownerStaff.userId`) ou ADMIN do tenant pode editar/arquivar um item da biblioteca (403 caso contrário); itens arquivados não aparecem em `from-library`.

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

- **Fase 2:** acompanhamento de progresso (`IndividualPlanProgress`) registrado pelo profissional, histórico de check-ins, possibilidade de o responsável marcar "feito em casa" para sessões opcionais; integração com timeline do filho. **Já entregue como sub-fase: PI-5.2 — biblioteca de exercícios** (`ExerciseLibraryItem`, snapshot) como evolução natural do MVP, sem aguardar progresso/timeline.
- **Fase 3:** template de **sessão** e de **plano inteiro** (acima do nível de exercício) por profissional/tenant; opt-in de IA (Doc 17 §4) para gerar resumo positivo a partir das sessões.
- **Fase 4:** "modo campo" read-only no celular para o profissional executar a sessão com o aluno.
