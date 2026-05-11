# Plano de implementação — Portal autônomo do aluno (flag, sem critério por idade)

## 1. Objetivo

Permitir que o **ADMIN** marque um aluno com uma **flag** indicando que **não há responsável terceiro** no fluxo familiar: a **mesma pessoa** passa a usar o portal com papel **`RESPONSAVEL`** e tem o **mesmo escopo de acesso e os mesmos recebíveis** (notificações, rotas `/guardian/*`, extrato, calendário, mídia, relatórios, avaliações, comunicações, presença em modo leitura, etc.) que um responsável teria **para aquele aluno**.

**Critério:** **somente a flag** (e regras de consistência abaixo). **Não** usar data de nascimento nem idade calculada.

**Fora deste plano:** novo papel `ALUNO` com UX separada; execução guiada de treino; alteração de RN-000 (treinador de campo).

---

## 2. Decisão de produto e modelo

### 2.1 Por que não “só a flag” no `Student`

O login atual é sempre **`User`** + **`JwtPayload`**. `Student` não autentica sozinho. Portanto a flag precisa de um **usuário de portal** associado.

### 2.2 Abordagem recomendada (reutiliza `RESPONSAVEL`)

| Elemento | Definição |
|----------|-----------|
| Flag | `Student.selfManagedPortal` (nome sugerido no Prisma; no produto: “Portal próprio do aluno” / “Titular da conta é o próprio atleta”) |
| Conta | `Student.portalUserId` → `User.id`, com `User.role = RESPONSAVEL`, mesmo `tenantId` |
| Regra | Se `selfManagedPortal = true`, **`portalUserId` é obrigatório** e deve referenciar um `User` ativo `RESPONSAVEL` do tenant |

**Semântica:** o atleta (maior de idade ou política da escolinha) tem **conta de responsável** que o ADMIN associa explicitamente ao cadastro do aluno. Não é inferência por idade — é **ação administrativa**.

### 2.3 RN-103 (portal e notificações) — extensão

Especificar **RN-103 bis** (ou atualizar RN-103 no Doc 04):

- **Caso A (default):** ao menos um vínculo `StudentGuardian` (como hoje).
- **Caso B (`selfManagedPortal = true`):** **não** exige `StudentGuardian` para “habilitar portal” **desde que** `portalUserId` esteja definido e o usuário seja `RESPONSAVEL` ativo; notificações e gatilhos que hoje resolvem destinatários por `studentGuardian` devem **também** incluir `portalUserId` quando a flag estiver ativa.

**Invariante:** não permitir `selfManagedPortal = true` sem `portalUserId`. Opcional: ao ativar a flag, UI obriga escolher/criar usuário.

### 2.4 Matrícula e turmas

- `turmas.service`: hoje exige contagem de guardians para matricular (**RN-103**). Ajustar para aceitar **Caso B** (flag + `portalUserId`) como equivalente a “tem titular para comunicação”.

### 2.5 Múltiplos filhos na mesma conta

Conta `RESPONSAVEL` pode continuar com **vários** `StudentGuardian`. Para autonomia, um mesmo `portalUserId` pode ser titular de **apenas um** `Student` com `selfManagedPortal` **ou** política explícita: um user, um aluno autônomo — **recomendação v1:** `@@unique([tenantId, portalUserId])` onde `selfManagedPortal = true` (parcial unique: no PostgreSQL usar índice único filtrado *partial index* ou validação em serviço). Documentar exceção se negócio permitir um adulto ser autônomo em dois cadastros (improvável).

---

## 3. Especificação funcional (resumo)

| ID | Regra |
|----|--------|
| RN-1400 | `selfManagedPortal` só pode ser alterada por **ADMIN**. |
| RN-1401 | Se `selfManagedPortal`, então `portalUserId` obrigatório, `User.role = RESPONSAVEL`, mesmo `tenantId`, `User.active = true`. |
| RN-1402 | Com flag ativa, o usuário em `portalUserId` **equivale** a um responsável com vínculo ao aluno para **todo** escopo de API hoje restrito a “meus filhos” via `StudentGuardian`. |
| RN-1403 | Desativar flag: exige que exista ao menos um `StudentGuardian` **ou** novo `portalUserId` removido e outro titular definido — evitar aluno sem titular nem vínculo. |
| RN-1404 | Notificações dirigidas a “responsáveis do aluno” incluem `portalUserId` quando `selfManagedPortal`. |

**Critérios de aceite (amostra):**

- **CA-25.01:** Com flag + `portalUserId`, `GET /students` lista só o aluno vinculado (mesmo comportamento agregado que guardian com um filho).
- **CA-25.02:** `GET /guardian/children/:studentId/individual-plans` e demais rotas guardian funcionam para esse usuário nesse `studentId`.
- **CA-25.03:** `guardianUserIdsForStudent` retorna o `portalUser` quando aplicável (dedupe com guardian já existente).
- **CA-25.04:** Matrícula em turma permitida sem `StudentGuardian` se RN-1401 satisfeita.
- **CA-25.05:** Isolamento `tenantId` / CA-03.01 inalterado.

---

## 4. Modelagem (Prisma)

```prisma
model Student {
  // ... campos existentes
  selfManagedPortal Boolean  @default(false)
  portalUserId      String?
  portalUser        User?    @relation("StudentPortalUser", fields: [portalUserId], references: [id], onDelete: SetNull)

  @@index([tenantId, portalUserId])
}

model User {
  // ... relações existentes
  studentsWherePortal Student[] @relation("StudentPortalUser")
}
```

Garantir que o nome `"StudentPortalUser"` seja único entre relações do `User`.

**Migration:** adicionar colunas + FK; default `false` / `null`.

---

## 5. Camada transversal (backend)

### 5.1 Helper único de escopo (recomendado)

Criar algo como `src/common/permissions/guardian-scope.ts`:

- `async function studentIdsVisibleToResponsavelUser(prisma, user: AuthUser): Promise<string[]>`
  - Se `user.role !== RESPONSAVEL`: delegar vazio ou não usar.
  - Buscar `studentGuardian` onde `guardian.userId = user.sub`.
  - **UNION** com `student` onde `tenantId = user.tenantId` AND `selfManagedPortal` AND `portalUserId = user.sub`.

Refatorar **`ensureCanReadStudent`** em `scope.ts` para: permitir leitura se `studentId` estiver nessa lista **ou** lógica atual de turma/admin.

Assim reduz-se drift entre `students.service`, `calendar`, `media`, `finance`, `reports`, etc.

### 5.2 `NotificationsService`

- `guardianUserIdsForStudent`: append `portalUserId` se `selfManagedPortal` e usuário ativo (dedupe com links existentes).

### 5.3 Serviços a revisar (checklist)

| Área | Arquivo(s) | Ajuste |
|------|------------|--------|
| Escopo leitura aluno | `common/permissions/scope.ts` | `ensureCanReadStudent` + novo helper |
| Lista alunos | `students.service.ts` | `visibleStudentIds` para RESPONSAVEL |
| Vínculos | `students.service.ts` | `unlinkGuardian` / RN-103 com Caso B |
| Matrícula | `turmas/turmas.service.ts` | Contagem titular: guardians **ou** portal |
| Calendário | `calendar/calendar.service.ts` | IDs de alunos do responsável |
| Mídia | `media/media.service.ts` | `myStudents` |
| Financeiro | rotas extrato / serviço | escopo por `studentId` já ok se (1) ok |
| Relatórios | `reports/reports.service.ts` | ramo RESPONSAVEL |
| Comunicações / inbox | `communications/*` | destinatários e escopo |
| Presença (leitura) | `attendance/*` | se filtra por filhos |
| Planos individuais | `individual-plans.service.ts` | `ensureCanReadStudent` já usado nos guardian routes |
| Avaliações | `evaluations/*` | endpoints RESPONSAVEL |
| Preferências / notificações | já por `userId` | sem mudança se user é RESPONSAVEL |

### 5.4 API ADMIN — configurar flag

- **`PATCH /students/:id`** ou rota dedicada **`PATCH /students/:id/portal-autonomy`** com body `{ selfManagedPortal: boolean, portalUserId?: string | null }`.
- Validações RN-1401 / RN-1403.
- Opcional: ao ativar, convite para definir senha se user novo (fora MVP: apenas selecionar user existente).

### 5.5 `AuthService` / `me` (opcional)

- Incluir no `me` lista `selfManagedStudentIds` ou flag `isSelfManagedAthlete` para o front mostrar copy adequada (“sua conta como atleta”).

---

## 6. Frontend

- **Gestão / aluno:** toggle “Titular do portal é o próprio atleta” + seletor de usuário `RESPONSAVEL` (ou fluxo criar usuário + associar).
- **Portal:** sem novo papel — reutilizar rotas `/filhos`, `/guardian/*`, etc. Ajustar **copy** quando só existe um aluno autônomo (ex.: “Meu perfil” vs “Meus filhos”) — opcional fase 2 UX.
- **Validação:** não permitir salvar flag sem usuário.

---

## 7. Documentação de produto

| Arquivo | Alteração |
|---------|-----------|
| `Docs/04-modulo-alunos-e-responsaveis.md` | RN-103 estendida; nova ROT-ALU-07 (configurar portal autônomo); CA-25.xx |
| `Docs/02-papeis-e-permissoes.md` | Nota: RESPONSAVEL pode ser titular autônomo sem terceiro |
| `Docs/18-indice-rotinas-e-aceite.md` | Entradas novas |
| `Docs/20-estado-implementacao-mvp.md` | Linha “Portal autônomo” após entrega |

---

## 8. Testes

| Tipo | Cenário |
|------|---------|
| E2E | Aluno só com flag + `portalUserId`, zero `StudentGuardian`: login responsável vê aluno, calendário, extrato, guardian planos |
| E2E | `guardianUserIdsForStudent` + notificação de cobrança chega no portal user |
| E2E | Matrícula sem guardian rows mas com flag |
| E2E | Desativar flag sem outro titular → 400 |
| Unit | helper `studentIdsVisibleToResponsavelUser` |

---

## 9. Ordem sugerida de PRs

1. **Specs** — Docs 04, 02, 18, 20 + este plano (referência cruzada).
2. **Schema + migration** — `selfManagedPortal`, `portalUserId`, relação `User`.
3. **Escopo central** — helper + `ensureCanReadStudent` + `students.list/getOne`.
4. **Notificações** — `guardianUserIdsForStudent` + qualquer `emit` que liste guardians manualmente.
5. **Turmas matrícula** — validação titular.
6. **Calendar, media, reports, finance, communications, attendance** — trocar para helper ou replicar union (preferir helper).
7. **ADMIN API + UI** — toggle e seletor.
8. **E2E + Doc 20** — entregue.

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Esquecer um módulo que filtra só por `StudentGuardian` | Checklist §5.3 + busca `studentGuardian` / `guardian.findFirst` no `backend/src` |
| Duplicar notificações (portal user = também guardian) | Dedupe por `userId` na lista de destinatários |
| LGPD / auditoria | Log em `StudentHealthAudit` ou audit leve ao mudar flag/`portalUserId` (opcional v1) |

---

## 11. Referências no código atual

- Escopo responsável–aluno: `backend/src/common/permissions/scope.ts` (`ensureCanReadStudent`).
- Lista de alunos para RESPONSAVEL: `backend/src/students/students.service.ts` (`visibleStudentIds`).
- Notificações por aluno: `backend/src/notifications/notifications.service.ts` (`guardianUserIdsForStudent`).
- Bloqueio matrícula: `backend/src/turmas/turmas.service.ts` (contagem guardians).

---

*Documento gerado para orientar implementação; não altera código até execução dos PRs acima.*
