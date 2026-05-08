# 02 — Papéis e permissões

## 1. Papéis do sistema

| Papel | Descrição |
|-------|-----------|
| **ADMIN** | Gestão da escolinha (tenant). |
| **TREINADOR** | Operação de turmas atribuídas. |
| **RESPONSAVEL** | Portal do pai/responsável. |
| **ALUNO** | *Opcional futuro:* app próprio; no escopo inicial, experiência via responsável. |

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

### 2.3 Responsável (RN-012)

- Visualizar informações dos filhos vinculados.  
- Visualizar calendário relevante (turmas do filho).  
- Receber notificações.  
- Visualizar pagamentos e status.  
- Visualizar relatórios.  
- Visualizar fotos e vídeos liberados.  
- Receber feedbacks / resumos (sem comparação negativa com outros alunos).  

## 3. Matriz resumida (ação × papel)

| Ação | ADMIN | TREINADOR | RESPONSAVEL |
|------|:-----:|:---------:|:-----------:|
| CRUD aluno/responsável | ✓ | ✗ | ✗ |
| CRUD turma | ✓ | ✗ | ✗ |
| Presença | ✓* | ✓ | ✗ |
| Avaliação rápida | ✓* | ✓ | ✗ |
| Calendário (todas as turmas) | ✓ | ✗ | ✗ |
| Calendário (minhas turmas / meus filhos) | ✓ | ✓ | ✓ |
| Financeiro (configuração) | ✓ | ✗ | ✗ |
| Financeiro (visualização própria) | ✓ | ✗ | ✓ |
| Comunicados globais | ✓ | ✗** | ✗ |
| Avisos por turma | ✓ | ✓ | ✗ |
| Mídia (upload) | ✓ | ✓ | ✗ |
| Mídia (visualização) | ✓ | ✓*** | ✓ |

\* Administrador pode ter permissão operacional de “substituto” — opcional por produto; se existir, deve ser auditável.  
\** Treinador pode enviar avisos apenas no escopo da turma (não “institucional global” salvo política explícita).  
\*** Treinador vê mídia das suas turmas.

## 4. Rotinas transversais

### ROT-PERM-01 — Verificar escopo de turma (treinador)

**Pré-condição:** usuário autenticado como TREINADOR.  
**Passos:** sistema resolve `turmaId` solicitado; verifica vínculo treinador–turma no tenant.  
**Pós-condição:** acesso concedido ou negado (403).  
**Critério de aceite CA-02.01:** treinador nunca lista ou edita turma de outro treinador.

### ROT-PERM-02 — Verificar vínculo responsável–aluno

**Pré-condição:** usuário autenticado como RESPONSAVEL.  
**Passos:** valida que `alunoId` pertence ao responsável no tenant.  
**Pós-condição:** dados do aluno exibidos ou 403.  
**Critério de aceite CA-02.02:** responsável não acessa aluno de outro responsável.

## 5. Referências

Multi-tenant e isolamento: [03-multi-tenant-e-lgpd.md](03-multi-tenant-e-lgpd.md).
