# Plano — Foco da aba "Início" por papel

> Status: **Fases 1, 2 e 3 concluídas**.
> Objetivo: ao entrar no produto, cada papel já sabe **o que precisa fazer hoje**.

## Princípios

- **Primeira dobra clara**: 1 ação primária + ≤4 KPIs por papel.
- **Mobile-first**: cartões verticais; CTAs grandes.
- **Reusar endpoints existentes**; só criar novo quando reduz chamadas/N+1 ou
  para respeitar privacidade.
- **CA-03.02**: previews de notificação sem dados sensíveis.
- **Vazios com CTA**: nunca uma seção "vazia muda"; sempre próximo passo.

---

## A) Aluno (ATLETA) — `HomeGuardian.tsx`

### O que precisa aparecer (em ordem)

1. **Banner do "agora"**
   - Em andamento (`start ≤ now < end`) das turmas do aluno ativo: card
     **"Treino agora: <título>"** + CTA `Avaliar / abrir`.
   - Senão, **próximo evento** com tempo restante (ex. "Em 2h30") + CTA
     `Ver no calendário`.
2. **Avaliações pendentes** (novo)
   - Eventos passados (últimos 14 dias) das turmas do aluno ativo com
     `effectiveFeedbackDimensions.length > 0` e `myFeedback === null`.
   - Até 5 itens; card por evento com CTA `Avaliar` (abre modal de feedback).
   - Vazio: "Tudo em dia — nenhuma avaliação pendente."
3. **Meus treinos para fazer** (Workouts)
   - Até 3 workouts atribuídos com CTA `Abrir`. Badge "Feedback de hoje
     enviado" se já houver.
4. **Notificações & Avisos** (compacto)
   - Contadores + 2 prévias seguras + links "Ver tudo".
5. **Financeiro**
   - Próximo vencimento em destaque (mantém o que já existe).

### Endpoints

- Existentes: `/calendar/events`, `/calendar/events/feedback-overview`,
  `/athlete/students/:sid/workouts`, `/communications/inbox`, `/notifications`,
  `/finance/students/:id/extrato`.
- Fase 2 (futuro): `GET /api/athlete/students/:sid/calendar/pending-feedback`
  para evitar carregar 25 eventos só para filtrar `myFeedback === null`.

---

## B) Professor (TREINADOR) — `HomeCoach.tsx`

### O que precisa aparecer

1. **Compromissos do dia** — TODOS os tipos de eventos das minhas turmas (não
   só TREINO). Para cada: hora, turma, tipo, **alunos esperados** (badge "N
   alunos"), CTA contextual (`Abrir presença` se TREINO, `Ver detalhes` para
   outros).
2. **Feedbacks do último treino** (novo) — último evento finalizado
   (`endsAt < now`) das minhas turmas com `feedbackCount > 0`: médias por
   dimensão + CTA `Ver respostas`.
3. **Próximos da semana** — como hoje.
4. **Planos sob meus cuidados** — como hoje.
5. **Atalhos** — Histórico de treinos, Comunicações.

### Endpoints

- Existentes: `/calendar/events`, `/calendar/events/feedback-overview` (já com
  RBAC por turma), `/individual-plans/recent`, `/turmas`.
- Fase 1 usa overview no front: filtra `feedbackCount > 0` e pega o mais
  recente. Sem novo endpoint.

---

## C) Admin (ADMIN) — `HomeAdmin.tsx`

### O que precisa aparecer

1. **KPIs do topo (4 cards)**
   - **Atrasados**: contagem + valor (R$) (de `/dashboard`).
   - **Eventos hoje**: total + breakdown `TREINO X · JOGO Y · OUTROS Z`.
   - **Avaliações do mês**: `% alunos avaliados / ativos` no mês civil
     corrente (KPI usa endpoint novo leve `/evaluations/admin-summary`).
   - **Feedback físico (semana)**: `eventos com pelo menos 1 resposta /
     eventos com dimensões efetivas` na semana atual.
2. **Eventos de hoje** — hora, turmas, tipo, status (lista ordenada por hora).
3. **Top 3 inadimplentes** — aluno, valor total acumulado, dias em atraso da
   cobrança mais antiga, link para extrato.
4. **Ações sugeridas** — Comunicado / Relatórios / Inadimplência / Dashboard
   completo.

### Endpoints

- Existentes: `/dashboard`, `/calendar/events`, `/calendar/events/feedback-overview`,
  `/finance/delinquency`.
- Novo Fase 1: `GET /api/evaluations/admin-summary` (ADMIN-only) —
  `{ periodFrom, periodTo, activeStudents, distinctStudentsEvaluated, percentage }`.

---

## Ordem de implementação

### Fase 1 — entrega rápida (em execução)

1. Endpoint `GET /api/evaluations/admin-summary` (ADMIN).
2. ATLETA: bloco "Banner do agora" + "Avaliações pendentes" + "Meus treinos
   pendentes" (via endpoints existentes).
3. TREINADOR: estender "Compromissos do dia" para todos os tipos; adicionar
   bloco "Feedbacks do último treino" (front filtra overview por `feedbackCount > 0`).
4. ADMIN: refactor KPIs (4 cartões); "Eventos de hoje" (filtro do dia);
   "Top 3 inadimplentes" via `/finance/delinquency`.

### Fase 2 — endpoints dedicados (✅ concluída)

5. ✅ `GET /api/athlete/students/:sid/calendar/pending-feedback?limit=&days=`
   (ATLETA + ADMIN/TREINADOR para fins administrativos) — exclui no servidor
   eventos que já receberam feedback do aluno; ordena por `startsAt desc`;
   filtra por dimensões efetivas > 0; respeita escopo de turmas matriculadas.
6. ✅ `GET /api/dashboard/home` (ADMIN) — agregador 1-request:
   - `students`, `professionalsActive`.
   - `finance: { delinquentCharges, delinquentAmountCents, topStudents[] }`
     (top 3 já agregado por aluno).
   - `todayEvents: { total, byType, items[] }`.
   - `physicalFeedbackWeek: { eligible, withFeedback, pct, windowFrom, windowTo }`
     (KPI calculado para a semana ISO até `now`).
   - `evaluations: { periodFrom, periodTo, activeStudents,
     distinctStudentsEvaluated, totalEvaluations, percentage }` (mês civil).
   - O HomeAdmin passou de **6 requests** para **1 request**.

### Fase 3 — polimento (✅ concluída)

7. ✅ Skeleton states nas Homes de ATLETA, TREINADOR e ADMIN (cards
   estruturados no lugar de texto solto de carregamento).
8. ✅ Deep-link do Home do ATLETA para `/treinos/historico?pending=1`.
9. ✅ `TreinosHistorico` aceita `pending=1`, ajusta a janela inicial para
   últimos 14 dias até hoje e mostra o filtro "Só avaliações pendentes" para
   ATLETA. Estado vazio orienta o usuário a desmarcar o filtro para revisar
   histórico antigo.

---

## Critérios de aceitação

| Papel | CA | Descrição |
|---|---|---|
| ATLETA | CA-Home.A-01 | Próximo treino visível com CTA contextual |
| ATLETA | CA-Home.A-02 | Avaliações pendentes (≤14d) listadas com link para avaliar |
| ATLETA | CA-Home.A-03 | Até 3 workouts pendentes com CTA abrir |
| ATLETA | CA-Home.A-04 | Cobrança próxima destacada |
| ATLETA | CA-Home.A-05 | Prévia segura de notificações (CA-03.02) |
| TREINADOR | CA-Home.T-01 | Compromissos do dia (todos os tipos) com badge "N alunos" |
| TREINADOR | CA-Home.T-02 | Último treino com feedback exibe médias + link respostas |
| TREINADOR | CA-Home.T-03 | Planos sob meus cuidados (até 3) |
| ADMIN | CA-Home.M-01 | 4 KPIs prioritárias na primeira dobra |
| ADMIN | CA-Home.M-02 | Eventos de hoje (lista ordenada por hora) |
| ADMIN | CA-Home.M-03 | Top 3 inadimplentes com link de extrato |

---

## Riscos / decisões

- **Ciclo de avaliação pedagógica**: definido como **mês civil corrente**
  (decisão do PO em 11/05/2026).
- **Performance no front (Fase 1)**: ATLETA dispara ~4 requests no Home.
  Aceitável agora; Fase 2 colapsa.
- **RBAC**: `feedback-overview` já respeita escopo (testado em E2E).
- **Privacidade (CA-03.02)**: previews seguras (cumprido pelo backend de
  notificações).
