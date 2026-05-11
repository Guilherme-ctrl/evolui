# 02 — Papéis e permissões

> **Refator ATLETA (2026-05):** o papel `RESPONSAVEL` foi renomeado para `ATLETA` (`UserRole.ATLETA`). A "conta-atleta" representa o login do aluno e pode ser operada pelo próprio atleta ou por um adulto responsável (pai/mãe/tutor) — declarado no aceite de termos (RN-201, `User.termsKinship`). Uma mesma conta pode ser titular de mais de um aluno (irmãos), expostos via `User.accountStudents`/`Student.accountUserId` e selecionáveis via switcher (RN-200, header `X-Active-Student-Id`). `Guardian` permanece apenas como entidade de contato (cobrança/WhatsApp/e-mail), **sem login**.

## 1. Papéis do sistema

| Papel | Descrição |
|-------|-----------|
| **ADMIN** | Gestão da escolinha (tenant). |
| **TREINADOR** | Operação de turmas atribuídas. |
| **ATLETA** | Conta de acesso ao app vinculada a um ou mais alunos (`Student.accountUserId`). Operada pelo próprio atleta ou por um adulto responsável (kinship declarado no aceite de termos). |
| ~~RESPONSAVEL~~ | *Substituído por ATLETA.* O contato do responsável legal (canais externos/cobrança) é mantido na entidade `Guardian`, sem login no app. |

## 2. Permissões por papel

### 2.1 Administrador (RN-010)

- Gerenciar treinadores (convite, desativação, vínculo a turmas).  
- Gerenciar alunos e responsáveis.  
- Criar e editar turmas.  
- Configurar calendário (eventos institucionais e políticas).  
- Gerenciar pagamentos / mensalidades / inadimplência.  
- Visualizar dashboards administrativos.  
- Enviar comunicados (gerais e segmentados).  
- Gerenciar fotos e vídeos (moderação, exclusão).  
- Configurar planos da escolinha (se aplicável ao modelo SaaS).  

### 2.2 Treinador (RN-011)

- Visualizar **apenas** turmas atribuídas.  
- Registrar presença (fluxos rápidos).  
- Realizar avaliações rápidas.  
- Publicar fotos e vídeos (nas turmas permitidas).  
- Enviar avisos (escopo: suas turmas ou alunos delas — política em [10-modulo-comunicacao.md](10-modulo-comunicacao.md)).  
- Visualizar calendário filtrado às suas turmas.  
- Visualizar evolução dos atletas **das suas turmas** (presença, avaliações, mídia permitida).  
- Quando possui `StaffProfile` (professor / fisioterapeuta / preparador físico), pode prescrever **planos individuais** para alunos vinculados — ver [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md).

### 2.3 Atleta / Conta-atleta (RN-012)

- Visualizar informações do(s) aluno(s) vinculado(s) à conta (`Student.accountUserId`).
- Visualizar calendário relevante (turmas do(s) aluno(s) ativos no switcher).
- Receber notificações (in-app) e e-mail/WhatsApp via `Guardian` (contato).
- Visualizar pagamentos e status.
- Visualizar relatórios publicados.
- Visualizar fotos e vídeos liberados.
- Receber feedbacks / resumos (sem comparação negativa entre alunos).

**Multi-aluno (switcher — RN-200):** uma única `User role=ATLETA` pode ser `accountUserId` de N `Student`s (irmãos). O front envia o header `X-Active-Student-Id` para indicar qual aluno é o foco atual da sessão; o backend valida via `athlete-scope` (`isAccountOfStudent`). O cadastro de mais alunos compartilhando a mesma conta é feito por **ADMIN** (`PATCH /students/:id/account-user` ou `accountUserId` no `POST /students`).

**Aceite de termos (RN-201):** no 1º login a conta-atleta precisa declarar `User.termsKinship` (`ATLETA` quando o próprio atleta opera, ou o grau de parentesco quando um adulto opera a conta da família) e marcar `User.termsAcceptedAt` via `POST /auth/accept-terms`. Sem aceite, a UI bloqueia operações com modal forçado.

## 3. Matriz resumida (ação × papel)

| Ação | ADMIN | TREINADOR | ATLETA |
|------|:-----:|:---------:|:------:|
| CRUD aluno/Guardian (contato) | ✓ | ✗ | ✗ |
| CRUD turma | ✓ | ✗ | ✗ |
| Presença | ✓* | ✓ | ✗ |
| Avaliação rápida | ✓* | ✓ | ✗ |
| Calendário (todas as turmas) | ✓ | ✗ | ✗ |
| Calendário (minhas turmas / meu(s) aluno(s) ativo(s)) | ✓ | ✓ | ✓ |
| Financeiro (configuração) | ✓ | ✗ | ✗ |
| Financeiro (extrato do aluno ativo) | ✓ | ✗ | ✓ |
| Comunicados globais | ✓ | ✗** | ✗ |
| Avisos por turma | ✓ | ✓ | ✗ |
| Mídia (upload) | ✓ | ✓ | ✗ |
| Mídia (visualização) | ✓ | ✓*** | ✓ |
| Plano individual (criar/editar) | ✓ | ✓ (Staff + vínculo aluno) | ✗ |
| Plano individual (visualizar publicado) | ✓ | ✓ (turmas / Doc 24) | ✓ (alunos da conta — Doc 04) |
| Aceitar termos (1º login) | — | — | ✓ (obrigatório — RN-201) |
| Trocar aluno ativo (switcher) | — | — | ✓ (RN-200, quando `students.length > 1`) |

\* Administrador pode ter permissão operacional de “substituto” — opcional por produto; se existir, deve ser auditável.  
\** Treinador pode enviar avisos apenas no escopo da turma (não “institucional global” salvo política explícita).  
\*** Treinador vê mídia das suas turmas.

**Nota (planos individuais):** “Staff + vínculo aluno” = `StaffProfile` ativo e escopo **CA-24.01**; visualização por treinador segue **RN-1304** em [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md).

## 4. Rotinas transversais

### ROT-PERM-01 — Verificar escopo de turma (treinador)

**Pré-condição:** usuário autenticado como TREINADOR.  
**Passos:** sistema resolve `turmaId` solicitado; verifica vínculo treinador–turma no tenant.  
**Pós-condição:** acesso concedido ou negado (403).  
**Critério de aceite CA-02.01:** treinador nunca lista ou edita turma de outro treinador.

### ROT-PERM-02 — Verificar vínculo conta-atleta ↔ aluno

**Pré-condição:** usuário autenticado como ATLETA.  
**Passos:** valida que `alunoId` está em `Student.accountUserId = user.sub` (vínculo direto da conta-atleta — RN-200). Quando há mais de um aluno na conta, o front envia `X-Active-Student-Id` para indicar o aluno em foco; o backend só aceita IDs pertencentes à conta.  
**Pós-condição:** dados do aluno exibidos ou 403.  
**Critério de aceite CA-02.02:** ATLETA nunca acessa aluno de outra conta-atleta (verificado em `account-switcher.e2e-spec.ts` e `tenant-isolation.e2e-spec.ts`).

### ROT-PERM-03 — Verificar autoria e escopo de plano individual

**Pré-condição:** usuário autenticado como ADMIN ou TREINADOR.  
**Passos:** para criar/editar/publicar plano, validar tenant, vínculo do aluno ao profissional (ou papel ADMIN) e regras de autor conforme [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md) (**RN-1300**, **RN-1305**, **CA-24.01**, **CA-24.07**).  
**Pós-condição:** operação permitida ou 403/404.

## 5. Referências

Multi-tenant e isolamento: [03-multi-tenant-e-lgpd.md](03-multi-tenant-e-lgpd.md).
