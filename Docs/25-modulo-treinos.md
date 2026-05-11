# 25. Módulo Treinos (workouts)

> Histórico: substitui o tipo `TREINO` do Doc 24 (Planos individuais). A partir
> deste documento, `IndividualPlan` é restrito a **TRATAMENTO clínico** e os
> treinos genéricos (turma ou aluno) vivem em `Workout`.

## 1. Por que um módulo separado de Treino

O fluxo de "treino" do Doc 24 nasceu como caso particular de `IndividualPlan`
mas escalou mal: planos individuais carregam sessões, dedupe clínico, preview
LGPD, autoria profissional obrigatória — coisas que ajudam num tratamento de
fisioterapia, mas atrapalham para "treino do sub-13". O usuário precisava de
um caminho simples:

1. ADMIN/PROFESSOR cria **exercícios** na biblioteca (Doc 24 §9 / RN-1311).
2. Monta **treinos** (conjuntos de exercícios com séries/reps/duração).
3. Atribui o treino a uma **turma inteira** ou a **alunos específicos**.
4. O aluno (`ATLETA`) acessa o treino e abre o detalhe do exercício
   (objetivo + vídeo).

`IndividualPlan` continua existindo, mas blinda-se para `TRATAMENTO` (RN-1320).

## 2. Critérios de aceite

| ID       | Critério |
|----------|---------|
| CA-25.01 | ADMIN cria treino sem `StaffProfile`; `ownerStaff = null` e `createdByUser` é o ADMIN. Edição/arquivamento permitido para o autor ou qualquer ADMIN do tenant. |
| CA-25.02 | TREINADOR cria treino apenas com `StaffProfile.active`; `ownerStaff` é preenchido com o staff e fica como autoria profissional para relatórios. |
| CA-25.03 | Exercícios do treino são sempre referenciados da biblioteca; o serviço grava **snapshot** de `name/description/videoUrl` para que o treino não quebre se a biblioteca mudar (RN-1310 estendido). |
| CA-25.04 | Atribuição é XOR: `scope=TURMA` exige `turmaId` (TREINADOR só atribui à sua turma) e `scope=STUDENT` exige `studentId` do tenant. Constraint **unique** por `(workoutId, turmaId)` e `(workoutId, studentId)` impede duplicidade. |
| CA-25.05 | `GET /athlete/students/:id/workouts` retorna **atribuições diretas + da(s) turma(s) do aluno**, com `workout.archived=false`. Dedup por workoutId; quando há atribuição direta e da turma, prevalece a direta. ATLETA fora da própria conta recebe `403`. |
| CA-25.06 | UI ATLETA mostra a lista (com switcher RN-200), o detalhe e um modal por exercício com `descriptionSnapshot` e `videoUrlSnapshot`. Sem mostrar nada além de `name/description/video/sets/reps/duration/rest/notes` (sem dados clínicos). |

## 3. Regras de negócio

- **RN-1320 — IndividualPlan restrito a tratamento clínico.** `POST /students/:id/individual-plans` agora rejeita `type` ≠ `TRATAMENTO` com `400` apontando para `/workouts`. Treinos antigos (se houver) seguem visíveis em listagens existentes, mas nenhum novo é criado por essa via.
- **RN-1321 — Visibilidade combinada turma+aluno.** Um aluno em `Turma T` cuja `Turma T` recebeu o `Workout W` enxerga `W`. Se o mesmo aluno também tem `W` atribuído diretamente, a vista do front mostra `W` uma única vez (precedência STUDENT).
- **RN-1322 — Autor ou ADMIN edita.** Mesma regra da biblioteca (RN-1311): qualquer ADMIN do tenant pode editar/arquivar treinos de outros; TREINADOR só edita os próprios.
- **RN-1310 (reaplicado) — Snapshot do exercício.** Edição ou arquivamento do `ExerciseLibraryItem` não altera as fichas de treinos já existentes — eles continuam mostrando o que viu o aluno no momento da prescrição.

## 4. Modelo de dados (resumo)

```
Workout(id, tenantId, name, description, notes, archived,
        createdByUserId, ownerStaffId?, createdAt, updatedAt)
WorkoutExercise(id, workoutId, libraryItemId,
                nameSnapshot, descriptionSnapshot, videoUrlSnapshot,
                order, sets?, repetitions?, durationSeconds?, restSeconds?, notes?)
WorkoutAssignment(id, tenantId, workoutId,
                  scope ∈ {TURMA, STUDENT},
                  turmaId?, studentId?,  // XOR conforme scope (CHECK na migration)
                  assignedByUserId, notes?, createdAt)
```

Índices: `Workout(tenantId, archived)`, `Workout(tenantId, name)`,
`WorkoutExercise(workoutId)` + unique `(workoutId, order)`,
`WorkoutAssignment(tenantId, turmaId)` + `(tenantId, studentId)` + unique
por alvo.

## 5. Endpoints

| Papel | Método | Rota | Descrição |
|-------|--------|------|-----------|
| ADMIN/TREINADOR (Staff.active) | `GET` | `/workouts` | Lista treinos do tenant (filtros `search`, `includeArchived`). |
| ADMIN/TREINADOR | `POST` | `/workouts` | Cria treino. |
| ADMIN/TREINADOR | `GET` | `/workouts/:id` | Detalhe (com `exercises` e `assignments`). |
| autor/ADMIN | `PATCH` | `/workouts/:id` | Atualiza metadados. |
| autor/ADMIN | `POST` | `/workouts/:id/archive` \| `/unarchive` | Arquiva/restaura. |
| autor/ADMIN | `POST` | `/workouts/:id/exercises` | Adiciona da biblioteca (snapshot). |
| autor/ADMIN | `PATCH` | `/workouts/:id/exercises/:exerciseId` | Edita parâmetros (sets/reps/duração/etc). |
| autor/ADMIN | `DELETE` | `/workouts/:id/exercises/:exerciseId` | Remove + compacta `order`. |
| autor/ADMIN | `POST` | `/workouts/:id/exercises/reorder` | Reordena via lista completa de IDs. |
| autor/ADMIN | `POST` | `/workouts/:id/assignments` | Atribui a turma ou aluno (XOR). |
| autor/ADMIN | `DELETE` | `/workouts/:id/assignments/:assignmentId` | Remove atribuição. |
| ATLETA | `GET` | `/athlete/students/:studentId/workouts` | Lista treinos visíveis para o aluno ativo (switcher RN-200). |

## 6. UX

- **Página `/treinos` (ADMIN/PROFESSOR)**: lista com busca, filtro arquivados, criação rápida e edição.
- **Editor `/treinos/:id`**: três blocos — cabeçalho (nome/descrição/notas), lista de exercícios (com botões ↑/↓ e remover, modal "Adicionar da biblioteca" com defaults pré-preenchidos), atribuições (modal com tabs `Turma | Aluno`, lista com remover).
- **Página `/meus-treinos` (ATLETA)**: cartões por atribuição com nome, autor, descrição e lista numerada de exercícios; clique no exercício abre um modal com objetivo + vídeo.

## 7. Feedback físico pós-treino (Workout)

> Camada **complementar** ao [Doc 06 §7 — feedback de evento do calendário](06-modulo-calendario.md). Os dois caminhos coexistem por design: o de calendário coleta percepção por **sessão real** (qualquer evento, inclusive jogos e amistosos), o de Workout coleta percepção pela **execução de um plano de exercícios** (independente de haver evento). Relatórios e modelos são separados (`WorkoutFeedback` vs `CalendarEventFeedback`) para não atrelar uma coisa à outra. UX no front também é separada — `MeusTreinos` para Workout, `Calendar` para evento.

Camada em cima do mesmo módulo Workout. O treino vira opcionalmente
"instrumentado": o autor define 1–5 **dimensões** (ex.: desgaste físico,
desgaste muscular, humor) e o aluno responde em escala 1–5 ao final de cada
execução do treino. O professor olha agregado por treino e histórico por aluno.

### 7.1. Critérios de aceite (novos)

| ID | Critério |
|----|---------|
| CA-25.07 | Autor/ADMIN configura `feedbackDimensions` (até 5) via `PATCH /workouts/:id/feedback-dimensions`. Chave (`key`) precisa ser slug `[a-z][a-z0-9_]{1,30}`; duplicidade retorna `400`. Renomear `label` não invalida histórico; remover uma `key` deixa as respostas antigas visíveis mas ela não conta nas médias correntes. |
| CA-25.08 | ATLETA (na sua conta, sobre seu aluno ativo) submete `POST /athlete/students/:studentId/workouts/:workoutId/feedback` apenas se o treino lhe está atribuído (direto ou via turma) e tem dimensões configuradas. Cadência **uma submissão por dia**: chamada subsequente no mesmo dia faz upsert; valores válidos são inteiros 1–5; dimensões desconhecidas retornam `400`. |
| CA-25.09 | ADMIN/TREINADOR (com `StaffProfile.active`) consulta `GET /workouts/:id/feedback` (médias por dimensão correntes + lista detalhada de submissões) e `GET /students/:id/workout-feedback` (histórico cronológico do aluno em todos os treinos do tenant). |

### 7.2. Regras de negócio

- **RN-1323 — Dimensões pertencem ao treino.** `feedbackDimensions` vive em
  `Workout` (não no tenant): cada treino pode ter um conjunto próprio. Decisão
  consciente — diferentes treinos pedem diferentes leituras (um aeróbico
  pergunta cardio, um técnico pergunta concentração). Limite 5 por treino para
  manter o modal de resposta curto no celular.
- **RN-1324 — Cadência diária com upsert.** A unique `(workoutId, studentId,
  submittedDate)` garante idempotência: o aluno pode reabrir e ajustar
  livremente no mesmo dia; o histórico só cresce ao virar a data. Não há
  "deletar feedback" pela UI — corrige-se sobrescrevendo no dia ou aguardando
  o próximo treino.

### 7.3. Modelo de dados (acréscimo)

```
Workout.feedbackDimensions  Json  // [{ key, label, order }]; default []
WorkoutFeedback(id, tenantId, workoutId, studentId,
                submittedByUserId, submittedDate @db.Date,
                scores Json, notes?, createdAt, updatedAt)
@@unique([workoutId, studentId, submittedDate])
```

`scores` é um objeto `{ [dimensionKey]: 1..5 }`. Chaves não presentes são
"não respondi"; chaves desconhecidas (não na config atual) são rejeitadas no
write e ignoradas nas médias na leitura.

### 7.4. Endpoints (acréscimo)

| Papel | Método | Rota | Descrição |
|-------|--------|------|-----------|
| autor/ADMIN | `PATCH` | `/workouts/:id/feedback-dimensions` | Define/atualiza dimensões. Body `{ dimensions: [{ key, label, order }] }`. |
| ADMIN/TREINADOR | `GET` | `/workouts/:id/feedback` | `{ workoutId, dimensions, averages[], feedbacks[] }`. |
| ADMIN/TREINADOR | `GET` | `/students/:id/workout-feedback` | Histórico cronológico do aluno. |
| ATLETA | `GET` | `/athlete/students/:sid/workouts/:wid/feedback/today` | Pré-preenche o modal com o que já foi salvo hoje (ou `null`). |
| ATLETA | `POST` | `/athlete/students/:sid/workouts/:wid/feedback` | Submete `{ scores, notes? }`. Idempotente por dia. |

### 7.5. UX

- **Editor `/treinos/:id`** ganha uma seção "Feedback físico pós-treino": chips com as dimensões correntes + modal de edição (label/key/ordem, até 5). Logo abaixo, painel "Respostas recebidas" com cards de média (1 por dimensão) e tabela de submissões (data, aluno, valores, notas).
- **`/meus-treinos` (ATLETA)** ganha botão **"Finalizar e dar feedback"** por treino com dimensões configuradas; se já respondeu hoje, o botão vira **"Editar feedback de hoje"** e exibe "Respondido hoje · você pode editar". O modal de resposta usa botões 1–5 grandes (mobile-first) e um textarea opcional.
- **`/alunos/:id` (ADMIN/PROFESSOR)** ganha seção "Feedback físico pós-treino" com histórico cronológico: card por submissão (nome do treino, data, badges com cada dimensão e o número 1–5, nota livre).

### 7.6. Cobertura de testes (acréscimo)

`backend/test/workouts-feedback-flow.e2e-spec.ts` (3 cenários):

1. ADMIN configura 3 dimensões; rejeita key duplicada; ATLETA submete (parcial), reabre e atualiza (upsert no mesmo dia → mesmo `id`); valores fora de 1–5 e dimensão desconhecida retornam `400`; `GET today` reflete o salvo; relatório do treino calcula `count` e `average` por dimensão (incluindo dimensão sem respostas como `count=0, average=null`); histórico do aluno lista a submissão; ATLETA fora da conta recebe `403`.
2. Submeter feedback em treino sem dimensões configuradas retorna `400` com mensagem sobre "feedback configurado".
3. Submissões em dias diferentes geram entradas distintas no histórico e a média combina os dias.

## 8. Cobertura de testes (módulo Treinos)

`backend/test/workouts-flow.e2e-spec.ts` (5 cenários):

1. ADMIN cria treino, anexa dois exercícios da biblioteca, reordena, atribui à turma e a aluno, e duplicidade de turma retorna `409`.
2. PROFESSOR (Staff) cria treino e ADMIN consegue editar (regra autor-ou-admin).
3. ATLETA da família vê os treinos do aluno ativo (combina atribuição via turma + via aluno).
4. ATLETA de outra conta recebe `403` ao tentar listar treinos de aluno alheio.
5. `IndividualPlan` com `type='TREINO'` é rejeitado com mensagem apontando para `/workouts`.
