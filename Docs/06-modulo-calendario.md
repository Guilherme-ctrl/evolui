# 06 — Módulo: Calendário

## 1. Objetivo

Centralizar a agenda da escolinha com eventos tipados e regras de alteração, cancelamento e visibilidade por papel.

## 2. Tipos de evento

Treino, jogo, amistoso, evento (genérico), campeonato, avaliação, reunião.

## 3. Regras de negócio

| ID | Regra |
|----|--------|
| RN-301 | Alterações de evento (data, hora, local) geram **notificações automáticas** aos responsáveis afetados. |
| RN-302 | Cancelamentos devem ser **registrados** (motivo opcional, timestamp, autor). |
| RN-303 | Pais/responsáveis devem receber **alertas** de alteração e cancelamento. |
| RN-304 | Treinadores visualizam apenas eventos relacionados às **suas turmas** (e eventos institucionais se política permitir). |
| RN-305 | ADMIN visualiza calendário completo do tenant. |

## 4. Rotinas

### ROT-CAL-01 — Criar evento

**Ator:** ADMIN (treinador: apenas se produto permitir “proposta” — default ADMIN).  
**Passos:** tipo, título, início/fim, local, turma(s) ou “toda escolinha”, recorrência opcional.  
**Pós-condição:** evento publicado; participantes elegíveis notificados se configurado.

### ROT-CAL-02 — Alterar evento

**Ator:** ADMIN.  
**Passos:** editar campos; confirmar envio de notificação.  
**Pós-condição:** histórico de versão mínimo (antes/depois) + RN-301.

### ROT-CAL-03 — Cancelar evento

**Ator:** ADMIN.  
**Passos:** cancelar com motivo; opcional mensagem aos pais.  
**Pós-condição:** status cancelado; RN-302 e RN-303.

### ROT-CAL-04 — Visualizar calendário (treinador)

**Filtro:** apenas turmas do treinador + eventos globais do tenant (se houver).

### ROT-CAL-05 — Visualizar calendário (responsável)

**Filtro:** turmas dos filhos vinculados.

## 5. Critérios de aceite

- **CA-06.01:** toda alteração relevante gera notificação configurável (push/e-mail/in-app).  
- **CA-06.02:** cancelamento não apaga o registro — marca cancelado.  
- **CA-06.03:** treinador não acessa evento de turma alheia.

## 6. Integração com presença

Sessões de presença devem referenciar evento de treino (ou sessão gerada automaticamente a partir do treino recorrente) — ver [07-modulo-presenca.md](07-modulo-presenca.md).

## 7. Feedback físico pós-evento

Camada nova (mai/2026) que pluga uma resposta opcional 1–5 do aluno em
**qualquer evento do calendário** (RN-1325/1326). Para o módulo Workouts (Doc
25 §7) existe um caminho análogo, deliberadamente separado: lá o feedback é
por execução de um plano de exercícios; aqui é por sessão real no calendário.

### 7.1. Critérios de aceite

| ID       | Critério |
|----------|---------|
| CA-06.04 | ADMIN configura `defaultFeedbackDimensions` do tenant via `PUT /tenant/me/feedback-dimensions` (até 5, `key` slug `[a-z][a-z0-9_]{1,30}`, sem duplicados). Aplica-se a todos os eventos por padrão. |
| CA-06.05 | ADMIN sobrescreve por evento via `PATCH /calendar/events/:id/feedback-dimensions`. Três estados: array preenchido (custom), `[]` (desliga só nesse evento), `unset:true` / `dimensions:null` (volta a herdar do tenant). `GET /calendar/events/:id` devolve `feedbackDimensions` (override) **e** `effectiveFeedbackDimensions` (já resolvido). |
| CA-06.06 | ATLETA (na conta-aluno) submete `POST /athlete/students/:sid/calendar/events/:eid/feedback` se: (a) o aluno está em uma turma do evento (ou o evento é `isWholeSchool`); (b) há dimensões efetivas; (c) o evento não está `CANCELLED`. Unique `(eventId, studentId)` → reabrir e enviar atualiza, não duplica. Valores fora de 1..5 ou keys desconhecidas retornam `400`. |
| CA-06.07 | ADMIN/TREINADOR consulta `GET /calendar/events/:id/feedback` (médias + lista detalhada) e `GET /students/:id/calendar-feedback` (histórico cronológico). TREINADOR só vê alunos das suas turmas — validação no service. |

### 7.2. Regras de negócio (acréscimo)

- **RN-1325 — Herança tenant→evento.** Dimensões de feedback têm um único default por tenant (config global) e cada evento pode sobrescrever **com três intenções**: substituir, desligar (`[]`) ou voltar a herdar (`null`). O cálculo de "dimensões efetivas" considera o override como verdade quando presente, mesmo sendo `[]`.
- **RN-1326 — Cadência por evento.** Diferente do Workout (1 resposta por dia), aqui o evento já é uma instância temporal — `@@unique(eventId, studentId)` garante uma única resposta por par, sempre editável. O histórico não duplica por dia.

### 7.3. Modelo de dados (acréscimo)

```
Tenant.defaultFeedbackDimensions  Json  // [{ key, label, order }]; default []
CalendarEvent.feedbackDimensions  Json? // null = herda; [] = desligado; [...] = override
CalendarEventFeedback(id, tenantId, eventId, studentId,
                      submittedByUserId, scores Json, notes?,
                      createdAt, updatedAt)
@@unique([eventId, studentId])
```

`scores` é um objeto `{ [dimensionKey]: 1..5 }`. Chaves desconhecidas em
relação às dims efetivas no momento do POST são rejeitadas; nas leituras
posteriores, chaves antigas (removidas do override ou do tenant) ficam
visíveis no histórico mas não entram nas médias.

### 7.4. Endpoints (acréscimo)

| Papel | Método | Rota | Descrição |
|-------|--------|------|-----------|
| ADMIN | `GET`/`PUT` | `/tenant/me/feedback-dimensions` | Dimensões padrão (TREINADOR pode `GET` para visualizar). |
| ADMIN | `PATCH` | `/calendar/events/:id/feedback-dimensions` | Override por evento. Body aceita `{ dimensions: [...] }`, `{ dimensions: [] }`, `{ dimensions: null }` ou `{ unset: true }`. |
| ADMIN/TREINADOR | `GET` | `/calendar/events/:id/feedback` | Relatório `{ effectiveFeedbackDimensions, averages[], feedbacks[] }`. |
| ATLETA | `GET` | `/athlete/students/:sid/calendar/events/:eid/feedback` | Resposta atual (ou `null`). |
| ATLETA | `POST` | `/athlete/students/:sid/calendar/events/:eid/feedback` | Submete/atualiza `{ scores, notes? }`. |
| ADMIN/TREINADOR | `GET` | `/students/:id/calendar-feedback` | Histórico cronológico de todos os eventos respondidos. |

### 7.5. UX

- **Preferências (ADMIN)**: nova seção "Feedback físico padrão" usa o componente compartilhado `FeedbackDimensionsEditor`. Configurar uma lista vazia desliga o pedido em todos os eventos por padrão.
- **Calendário**: ao selecionar um evento, surge o cartão `EventFeedbackPanel` abaixo da lista do dia (todos os papéis): badges das dims efetivas, e ações conforme papel — ADMIN tem "Configurar" (modal com `FeedbackDimensionsEditor` + botões "Herdar do tenant" e "Desligar neste evento"); ADMIN/TREINADOR têm "Ver respostas" (modal com cards de média + tabela); ATLETA tem "Dar feedback" / "Editar minha resposta" (modal com botões 1–5 e textarea).
- **Aluno (`/alunos/:id`, ADMIN/PROFESSOR)**: ganha a seção "Feedback físico — eventos do calendário" com histórico cronológico (cards por evento, badges das dims com valor 1–5, nota livre). A seção de Workout fica logo abaixo, claramente separada.

### 7.6. Cobertura de testes

`backend/test/calendar-feedback-flow.e2e-spec.ts` (3 cenários):

1. ADMIN define defaults do tenant → evento herda; ATLETA submete (upsert); valores fora 1–5 e key desconhecida retornam `400`; `GET` do feedback do aluno reflete o salvo; relatório do evento calcula `count`/`average`; histórico do aluno aparece; ATLETA de outra conta recebe `403`.
2. Override por evento substitui o default; `dimensions: []` desliga (POST retorna `400` "sem feedback configurado"); `unset: true` volta a herdar (`feedbackDimensions` vira `null`).
3. TREINADOR ativo da turma do evento acessa relatório e histórico do aluno daquela turma (RBAC).
