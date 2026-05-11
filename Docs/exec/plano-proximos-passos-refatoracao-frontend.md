# Plano de próximos passos: separação de responsabilidades no frontend

## Contexto

Após a primeira rodada de refatoração, o frontend passou a ter uma base inicial para separar **transporte HTTP**, **regras puras**, **hooks de orquestração** e **componentes apresentacionais**.

Já foram criados:

- `frontend/src/domain/feedback-dimensions.ts`
- `frontend/src/domain/rbac.ts`
- `frontend/src/services/*`
- `frontend/src/hooks/useEventFeedbackPanel.ts`
- `frontend/src/components/feedback/*`

Também foram migradas telas importantes para remover `apiFetch` direto:

- `Calendar.tsx`
- `TreinosHistorico.tsx`
- `HomeGuardian.tsx`
- `MeusTreinos.tsx`
- `Preferencias.tsx`
- `EventFeedbackPanel.tsx`

O próximo objetivo é continuar a redução de lógica de negócio dentro de páginas React grandes, priorizando arquivos com muitas responsabilidades e maior risco de manutenção.

## Princípios

- `pages/` deve compor hooks e componentes, não montar URLs de API nem concentrar regras de domínio.
- `components/` deve ser preferencialmente apresentacional: props entram, JSX sai.
- `services/` deve conter os contratos HTTP por domínio.
- `hooks/` deve concentrar loading, erro, reload, mutações e coordenação de estado.
- `domain/` deve guardar funções puras, testáveis sem React e sem `fetch`.
- Refatorar incrementalmente, sem alterar comportamento funcional.

## Fase 1 — Financeiro

### Objetivo

Reduzir a complexidade de `frontend/src/pages/Finance.tsx`, que mistura consulta de dados, mutações financeiras, geração de recibo, impressão, estado de modais e apresentação.

### Escopo

- Completar `frontend/src/services/finance.ts` com:
  - listagem de inadimplência;
  - criação de cobrança;
  - criação em lote;
  - baixa de cobrança;
  - baixa em lote;
  - reversão;
  - sincronização de vencidos;
  - exportação/download quando aplicável.
- Criar `frontend/src/domain/finance-receipts.ts`:
  - `renderReceiptHtml(payload)`;
  - `renderBulkReceiptHtml(payload)`;
  - formatação de valores e datas específicas de recibo.
- Criar `frontend/src/lib/print-html.ts`:
  - `printHtml(html, title)`;
  - isolamento do iframe oculto e limpeza.
- Extrair componentes apresentacionais:
  - `components/finance/ChargeHistory.tsx`;
  - `components/finance/PayChargeDialog.tsx`;
  - `components/finance/BulkChargeDialog.tsx`;
  - `components/finance/RevertChargeDialog.tsx`;
  - `components/finance/DelinquencySummary.tsx`.
- Criar hook:
  - `hooks/useFinancePage.ts` ou hooks menores por subárea.

### Critérios de aceite

- `Finance.tsx` não importa `apiFetch` nem `getToken`.
- A lógica de impressão sai da página.
- `tsc --noEmit` passa.
- Nenhum comportamento financeiro muda.
- Recibos continuam imprimindo individual e em lote.

## Fase 2 — Gestão

### Objetivo

Quebrar `frontend/src/pages/Gestao.tsx`, hoje o maior arquivo do frontend, separando comandos de negócio e componentes de UI.

### Escopo

- Completar services:
  - `services/students.ts`;
  - `services/guardians.ts`;
  - `services/turmas.ts`;
  - `services/auth.ts` para criação de professores/coaches, se fizer sentido.
- Criar hook:
  - `hooks/useGestaoCommands.ts`.
- Manter ou evoluir `pages/gestao/useGestaoDirectoryData.ts`.
- Extrair componentes:
  - `components/gestao/StudentDirectory.tsx`;
  - `components/gestao/StudentForm.tsx`;
  - `components/gestao/GuardianDirectory.tsx`;
  - `components/gestao/GuardianForm.tsx`;
  - `components/gestao/TurmaDirectory.tsx`;
  - `components/gestao/TurmaForm.tsx`;
  - `components/gestao/EnrollmentDialog.tsx`;
  - `components/gestao/DeleteDialogs.tsx`.
- Mover regras puras:
  - necessidade de responsável de contato;
  - normalização de data de nascimento;
  - montagem de payloads.

### Critérios de aceite

- `Gestao.tsx` fica responsável principalmente por abas, composição e navegação.
- Chamadas de API de gestão ficam em `services/*`.
- Mutações ficam em `useGestaoCommands`.
- Componentes extraídos são reutilizáveis e recebem callbacks por props.
- `tsc --noEmit` passa.

## Fase 3 — PlanoEditor e TreinoEditor

### Objetivo

Separar editores complexos de planos e treinos em hooks e componentes específicos, reduzindo duplicação de handlers `apiFetch + setState`.

### Escopo: `PlanoEditor.tsx`

- Completar `services/individual-plans.ts` com:
  - create;
  - update header;
  - publish/archive/cancel;
  - sessions;
  - exercises;
  - import from library.
- Criar hook:
  - `hooks/useIndividualPlanEditor.ts`.
- Extrair componentes:
  - `components/plans/PlanHeaderForm.tsx`;
  - `components/plans/SessionForm.tsx`;
  - `components/plans/ExerciseForm.tsx`;
  - `components/plans/LibraryExercisePicker.tsx`;
  - `components/plans/PlanSessionList.tsx`.

### Escopo: `TreinoEditor.tsx`

- Criar ou completar `services/workouts.ts` com endpoints de staff:
  - get/update workout;
  - add/remove exercise;
  - assign/unassign;
  - feedback dimensions;
  - feedback report.
- Criar hook:
  - `hooks/useWorkoutEditor.ts`.
- Extrair componentes:
  - `components/workouts/WorkoutHeaderForm.tsx`;
  - `components/workouts/WorkoutExerciseList.tsx`;
  - `components/workouts/AddWorkoutExerciseDialog.tsx`;
  - `components/workouts/WorkoutAssignmentsDialog.tsx`;
  - `components/workouts/WorkoutFeedbackReport.tsx`.

### Critérios de aceite

- `PlanoEditor.tsx` e `TreinoEditor.tsx` não importam `apiFetch`.
- Cada modal vira componente testável com props.
- Regras de payload e normalização saem do JSX.
- `tsc --noEmit` passa.

## Fase 4 — Calendário: subviews apresentacionais

### Objetivo

Reduzir `Calendar.tsx` extraindo visualizações e estado de formulário, mantendo o comportamento atual de mês/semana/dia.

### Escopo

- Criar `hooks/useCalendarEvents.ts`:
  - cálculo de range;
  - carregamento;
  - reload;
  - agrupamento por dia.
- Criar `hooks/useCalendarEventForm.ts`:
  - draft de criação/edição;
  - validação de horários;
  - seleção de turmas;
  - submit/cancel.
- Extrair componentes:
  - `components/calendar/MonthView.tsx`;
  - `components/calendar/WeekView.tsx`;
  - `components/calendar/DayView.tsx`;
  - `components/calendar/TimeGrid.tsx`;
  - `components/calendar/EventListSidebar.tsx`;
  - `components/calendar/EventFormPanel.tsx`.

### Critérios de aceite

- `Calendar.tsx` vira uma tela de composição.
- Subviews recebem apenas dados e callbacks.
- Nenhuma chamada HTTP dentro das subviews.
- `tsc --noEmit` passa.

## Fase 5 — Dívida de lint e padrão de effects

### Objetivo

Resolver erros já existentes de lint relacionados a `react-hooks/set-state-in-effect` e `react-hooks/purity`, para que o lint volte a ser um sinal confiável.

### Escopo

- Corrigir efeitos que chamam `setState` síncrono diretamente quando possível.
- Padronizar uso de:
  - `runDeferredEffect`;
  - hooks de fetching;
  - estado inicial derivado;
  - funções puras fora do render.
- Corrigir `Date.now()` dentro de render/useMemo em `TreinosHistorico.tsx`.
- Revisar casos conhecidos:
  - `StudentDetail.tsx`;
  - `TreinoEditor.tsx`;
  - `MeusTreinos.tsx`;
  - `TreinosHistorico.tsx`.

### Critérios de aceite

- `npm run lint` passa sem erros.
- Novas refatorações podem usar lint como gate real.
- Nenhuma mudança funcional perceptível para o usuário.

## Fase 6 — Cobertura de services restante

### Objetivo

Eliminar gradualmente `apiFetch` direto em `pages/` e `components/`.

### Candidatos restantes

- `TreinoEditor.tsx`
- `Treinos.tsx`
- `BibliotecaExercicios.tsx`
- `Gestao.tsx`
- `Finance.tsx`
- `Profissionais.tsx`
- `Attendance.tsx`
- `Midia.tsx`
- `RelatorioDetail.tsx`
- `Comunicacoes.tsx`
- `AvaliacoesConfig.tsx`
- `Avaliacoes.tsx`
- `Avisos.tsx`

### Critérios de aceite

- `rg "apiFetch\\(" frontend/src/pages frontend/src/components` não retorna ocorrências.
- Toda integração HTTP vive em `services/`.
- Hooks passam a ser o ponto principal de orquestração.

## Ordem recomendada

1. Financeiro.
2. Gestão.
3. PlanoEditor/TreinoEditor.
4. Calendário subviews.
5. Dívida de lint.
6. Cobertura total de services.

Essa ordem prioriza os maiores ganhos de manutenibilidade com menor risco de regressão funcional.

## Métricas de acompanhamento

Executar antes e depois de cada fase:

```bash
wc -l frontend/src/pages/*.tsx frontend/src/pages/home/*.tsx frontend/src/components/*.tsx
rg "apiFetch\\(" frontend/src/pages frontend/src/components -c
npm run lint
npx tsc --noEmit -p frontend/tsconfig.json
```

Metas:

- Nenhum `apiFetch` direto em `pages/` e `components/`.
- Páginas principais abaixo de aproximadamente 400 linhas.
- Componentes apresentacionais sem dependência de `useAuth`, `useToast` ou `apiFetch`, exceto containers explícitos.
- Regras de negócio críticas cobertas por funções puras em `domain/`.

