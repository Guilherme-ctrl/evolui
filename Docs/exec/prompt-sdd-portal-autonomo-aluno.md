# Prompt SDD — Portal autônomo do aluno (flag + `portalUserId`)

Documento autocontido para colar em agente Cursor (ou outro), épico ou briefing técnico. Implementa o plano **[plano-implementacao-aluno-portal-autonomo.md](plano-implementacao-aluno-portal-autonomo.md)** e atualiza as specs de produto correspondentes.

---

## 1. Papel e missão

Você é **engenheiro(a) de software sênior** no monorepo **NestJS + Prisma + PostgreSQL** (backend) e **React + Vite** (frontend), produto **SaaS multi-tenant para escolinhas de futebol**.

**Missão:** permitir que o **ADMIN** ative uma **flag** no aluno (`selfManagedPortal`) e associe um **`User`** com papel **`RESPONSAVEL`** (`portalUserId`), **sem usar data de nascimento ou idade** como critério. Com a flag ativa e vínculo válido, esse usuário **faz e recebe tudo** que um responsável faria **para aquele aluno** (escopo de API, notificações, rotas `/guardian/*`, extrato, calendário, mídia, relatórios, avaliações, comunicações, presença em leitura, planos individuais no portal, etc.).

**Não implementar neste trabalho:** papel novo `ALUNO` com app separado; execução guiada de treino; mudanças em **RN-000** (treinador de campo).

---

## 2. Regras não negociáveis

- **CA-03.01 / CA-17.01** ([03](../03-multi-tenant-e-lgpd.md), [17](../17-arquitetura-e-stack-sugerida.md)): `tenantId` sempre do JWT; teste E2E cross-tenant obrigatório para novos fluxos.
- **CA-02.02** ([02](../02-papeis-e-permissoes.md)): titular portal não acessa outro aluno sem vínculo (guardian **ou** `portalUserId` + flag para si).
- **Consistência RN-103 estendida:** Caso B do plano — com `selfManagedPortal` e `portalUserId` válido, permitir portal/matricula/notificações **sem** `StudentGuardian` obrigatório; **nunca** flag `true` sem `portalUserId` e user `RESPONSAVEL` ativo no mesmo tenant.
- **Dedupe:** notificações e listas de destinatários não duplicam o mesmo `userId` se já existir vínculo guardian.
- **Design** ([19](../19-design-system-brand-guide.md)): UI de gestão alinhada aos tokens existentes; mensagens claras sobre titular da conta.

---

## 3. Fontes de verdade (leitura obrigatória)

| Tema | Documento |
|------|-----------|
| Plano técnico completo | [plano-implementacao-aluno-portal-autonomo.md](plano-implementacao-aluno-portal-autonomo.md) |
| Alunos / responsáveis | [04-modulo-alunos-e-responsaveis.md](../04-modulo-alunos-e-responsaveis.md) |
| Papéis | [02-papeis-e-permissoes.md](../02-papeis-e-permissoes.md) |
| Glossário | [01-glossario-e-entidades.md](../01-glossario-e-entidades.md) |
| Notificações | [14-modulo-notificacoes.md](../14-modulo-notificacoes.md) |
| Planos individuais (portal guardian) | [24-modulo-planos-individuais.md](../24-modulo-planos-individuais.md) |
| Índice ROT/CA | [18-indice-rotinas-e-aceite.md](../18-indice-rotinas-e-aceite.md) |
| Estado implementação | [20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md) |

Antes de codar, leia o **§5.3 (checklist de serviços)** do plano técnico e confirme que nenhum arquivo que filtra só por `StudentGuardian` ficou de fora.

---

## 4. Escopo de specs (PR PA-1 — pode ir sozinho)

### 4.1 Atualizar `Docs/04-modulo-alunos-e-responsaveis.md`

- Estender **RN-103** com **Caso A** (guardians) e **Caso B** (`selfManagedPortal` + `portalUserId`), conforme §2.3 do plano técnico.
- Incluir **RN-1400 a RN-1404** (tabela do plano §3) com redação de produto (não só IDs soltos).
- Nova rotina **ROT-ALU-07** — Configurar portal autônomo (ADMIN): pré/pós-condições, validações, exceções.
- Critérios **CA-25.01 a CA-25.05** em §4.
- Nota em **ROT-ALU-06**: desvincular último guardian com flag ativa só se RN-1403 permitir (documentar).

### 4.2 Atualizar `Docs/02-papeis-e-permissoes.md`

- Em **§2.3 Responsável**: explicar que o mesmo papel pode ser **titular autônomo** do aluno quando a escolinha configurar a flag (sem novo papel).
- Matriz ou nota: escopo de dados continua sendo “filhos vinculados”; o vínculo pode ser **N:N guardian** **ou** **portal direto** via flag.

### 4.3 Atualizar `Docs/01-glossario-e-entidades.md`

- Termo **Portal autônomo / titular da conta (atleta)** e campos conceituais em **Student** (`selfManagedPortal`, `portalUserId`).

### 4.4 Atualizar `Docs/14-modulo-notificacoes.md` (se aplicável)

- Parágrafo curto: destinatários “responsáveis do aluno” incluem `portalUserId` quando a flag estiver ativa (alinhar a **RN-1404**).

### 4.5 Atualizar `Docs/24-modulo-planos-individuais.md` (ajuste mínimo)

- Em **visibilidade RESPONSAVEL** ou notas: leitura no portal guardian também aplica ao titular autônomo (`portalUser` + flag), equivalente a responsável vinculado.

### 4.6 Atualizar `Docs/18-indice-rotinas-e-aceite.md`

- **§1:** ROT-ALU-07 → Doc 04.
- **§2:** CA-25.01–CA-25.05 → Doc 04.
- **§3:** RN-1400–RN-1404 na amostra global.

### 4.7 Atualizar `Docs/20-estado-implementacao-mvp.md`

- Linha ou bullet: “Portal autônomo (flag + portalUserId)” — pendente / entregue conforme PRs.

### 4.8 Opcional

- Entrada em [Docs/README.md](../README.md) na tabela se criar doc novo; **não** é obrigatório criar `Docs/25-*.md` se todo o texto couber no **04**.

**Critério de pronto PA-1:** links internos válidos; ROT/CA/RN alinhados ao plano técnico; sem contradizer **RN-000** nem introduzir papel `ALUNO`.

---

## 5. Escopo de código (ordem sugerida)

Seguir **§9 do plano técnico** (PRs 2–8). Resumo:

| ID | Conteúdo |
|----|----------|
| **PA-2** | Prisma: `selfManagedPortal`, `portalUserId`, relação `User` ↔ `Student`; migration. |
| **PA-3** | `studentIdsVisibleToResponsavelUser` + `ensureCanReadStudent` + `students.service` (lista/get). |
| **PA-4** | `NotificationsService.guardianUserIdsForStudent` + revisar emissões que montam destinatários manualmente. |
| **PA-5** | `turmas.service` — regra de matrícula / titular (Caso B). |
| **PA-6** | Calendar, media, reports, finance, communications, attendance, evaluations — unificar via helper ou replicar union (preferir helper). |
| **PA-7** | `PATCH` em `students` (ou rota dedicada) + DTO; só ADMIN; validações RN-1401/RN-1403. |
| **PA-8** | Frontend gestão (toggle + seletor de usuário RESPONSAVEL); copy opcional no portal. |
| **PA-9** | E2E (CA-25.xx) + atualizar **Doc 20** como entregue. |

**Critério global:** `npm test` no `backend/` verde; `npm run lint` e `npm run build` no `frontend/` verdes.

---

## 6. Definição de pronto (release)

1. Specs **PA-1** aplicadas.
2. Migration aplicada; invariantes de flag/`portalUserId` no serviço.
3. Todo endpoint que hoje depende de `StudentGuardian` para RESPONSAVEL foi revisado (checklist §5.3 do plano).
4. E2E mínimo: aluno só com Caso B acessa dados do próprio aluno; outro tenant 404; notificação chega ao `portalUser`.
5. **Doc 20** reflete entrega.

---

## 7. Antiescopo

- Papel `ALUNO` no enum `UserRole`.
- Inferência automática por `birthDate`.
- Execução guiada / `IndividualPlanProgress`.
- Alteração do fluxo operacional do treinador de campo (**RN-000**).

---

## 8. Entregáveis

- PRs pequenos **PA-1 … PA-9** (ou fusão razoável: specs+schema; escopo+notificações; resto).
- Código em `backend/` e `frontend/` nos padrões do repositório.
- Nenhuma duplicação desnecessária de lógica de escopo — **um helper** é preferível.

---

## 9. Início imediato

1. Ler [plano-implementacao-aluno-portal-autonomo.md](plano-implementacao-aluno-portal-autonomo.md) por completo.
2. Abrir **PA-1** atualizando Docs **04, 02, 01, 14, 24, 18, 20** conforme §4 deste prompt.
3. Implementar **PA-2** em diante; após cada fase, `grep` em `backend/src` por `studentGuardian` e `RESPONSAVEL` para achar regressões de escopo.

---

*Prompt SDD alinhado ao plano `plano-implementacao-aluno-portal-autonomo.md`.*
