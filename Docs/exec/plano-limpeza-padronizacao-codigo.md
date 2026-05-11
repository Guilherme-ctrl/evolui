# Plano de limpeza e padronização de código

Documento gerado por revisão estática do monorepo (`backend/` NestJS + Prisma, `frontend/` Vite + React 19). Serve como backlog priorizado de higiene técnica; não substitui testes nem revisão humana de segurança.

**Última análise:** execução local de `npm run lint` em `frontend/` e `backend/` (maio/2026); frontend corrigido na mesma janela.

## Resumo executivo

| Área | Situação | Prioridade |
|------|----------|------------|
| ESLint backend | **Verde** (`eslint` em `src/` + `test/`) | — |
| ESLint frontend | **Verde** — correções em `Modal`, `Attendance`, `Finance`, `Gestao`, `HomeGuardian` | — |
| Duplicação de `Modal` | **Resolvida** — `Gestao.tsx` e `Midia.tsx` usam `components/Modal.tsx` | — |
| Componentes em `frontend/src/components/` | Todos referenciados por páginas ou providers (`Banner`, `ConfirmDialog`, `EvolutionList`, `Modal`, `ProgressBar`, `ToastProvider`, `useToast`; arquivos `*-context-internal.ts` usados pelos providers) | — |
| Páginas grandes | `Gestao.tsx` continua concentrando CRUD, modais e matrícula (~1,9k linhas); ganho estrutural com `useGestaoDirectoryData.ts` | Média |
| Atualização otimista (inbox) | `Avisos.tsx` marca leitura só no recipient índice `0` no map — alinhar ao contrato real da API (multi-recipient) se aplicável | Baixa |
| Testes | E2E Jest em `backend/test/`; **sem** suíte automatizada no frontend | Média (fase 2) |

---

## 1. Ferramentas e gates de qualidade

1. **CI obrigatório:** `npm run lint` em `frontend/` e `backend/` em todo PR.
2. **Typecheck front:** `npm run build` já roda `tsc -b`; opcional `tsc -b --noEmit` em CI para feedback rápido.
3. **Prettier:** backend tem `format` (Prettier); frontend não expõe `format` no `package.json` — alinhar ou documentar decisão.
4. **Dead code (fase 2):** com lint verde, considerar `knip` ou `typescript` `noUnusedLocals`/`noUnusedParameters` para exports e imports mortos.

---

## 2. Backend (NestJS)

### 2.1 Estado atual

- Lint sem erros reportados na última execução.
- Padrão: módulos por domínio, DTOs com `class-validator`, guards de tenant/role.

### 2.2 Melhorias sugeridas (não bloqueantes)

- **Throttling:** login com `@Throttle` específico; manter coerência com limites globais documentados em `16-requisitos-nao-funcionais.md`.
- **Health:** avaliar `GET /api/health` dedicado se infraestrutura exigir (além do JSON mínimo na raiz, se existir).
- **DTOs:** padronizar `class-transformer`/`@Type()` apenas onde há aninhamento que exige.

---

## 3. Frontend (React + Vite)

### 3.1 ESLint frontend (histórico de correções)

Rodada maio/2026 (regras `react-hooks/*`, `no-useless-assignment`):

| Arquivo | O que foi feito |
|---------|-----------------|
| `components/Modal.tsx` | Sincronizar `onCloseRef` em `useEffect([onClose])` em vez de durante o render. |
| `pages/Attendance.tsx` | Um único efeito de bootstrap: após fetch, aplica `turmaId`/`eventId` a partir da query quando válidos; deps `[prefTurma, prefEvent]`. |
| `pages/Finance.tsx` | Removidos efeitos que só resetavam seleção; `selectTab()` centraliza troca de aba + resets. Limpeza de `selectedHistIds` ao trocar aluno continua no efeito que carrega extrato. |
| `pages/Gestao.tsx` | `setSecao`: deps `[setSearchParams, setErr]`; `onCreateFamily`: `studentId` atribuído uma vez após `POST /students`. |
| `pages/home/HomeGuardian.tsx` | `upcoming`: `new Date()` em vez de `Date.now()` no `useMemo` (alinhado ao padrão de `HomeCoach`). |

**Diretrizes gerais:**

- Regras novas do `eslint-plugin-react-hooks` (React 19 / Compiler) são **mais estritas** que o padrão clássico; vale documentar no PR a estratégia (corrigir vs. exceção pontual com justificativa no `eslint.config`).
- **Fast refresh:** hooks já estão em `useAuth.ts`, `useToast.ts` separados dos providers — manter esse padrão.

### 3.2 Código limpo e arquitetura

- **Gestão:** extrair mais fluxos de `Gestao.tsx` para hooks por domínio (aluno, responsável, turma, matrícula) e subcomponentes de formulário — reduz risco de regressão e facilita testes futuros.
- **Erros na UI:** padrão atual — `Banner` para erro de página; `useToast` para ação — manter consistente ao criar telas novas.

### 3.3 Acessibilidade

- Após correções em `Modal` e fluxos longos, smoke com teclado/leitor em `Calendar`, `Midia`, `Gestao`, presença e financeiro (alinhado ao Doc 19 e ao plano Doc 22 fase C).

---

## 4. Testes

- Backend: manter e estender `backend/test/*.e2e-spec.ts` quando alterar permissões, tenant ou contratos financeiros/notificações.
- Frontend: **fase 2** — Playwright ou RTL nos fluxos críticos (login, presença, financeiro).

---

## 5. Ordem de execução recomendada

1. ~~Corrigir erros de ESLint no frontend~~ **feito** (ver §3.1).
2. Introduzir ou reforçar **gate de CI** (lint backend + frontend + `test:e2e` ou `test` conforme política do time).
3. Continuar **extração** de `Gestao.tsx` (hooks e sub-UI).
4. Revisar **otimista** de leitura em `Avisos.tsx` vs. modelo multi-recipient.
5. Opcional: Prettier no frontend + `knip`/strict unused após lint estável.

---

## Documentação relacionada

- Estado produto × código: [../20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md)
- Plano UX pós-MVP: [../22-plano-implementacao-doc21.md](../22-plano-implementacao-doc21.md)
- Design system: [../19-design-system-brand-guide.md](../19-design-system-brand-guide.md)
