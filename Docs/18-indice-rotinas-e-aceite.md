# 18 — Índice de rotinas e critérios de aceite

> **Refator ATLETA (2026-05):** ver nota no [README de Docs](README.md) e em [02-papeis-e-permissoes.md](02-papeis-e-permissoes.md). Onde o documento dizer "responsável" como **papel/usuário**, leia como `ATLETA` (conta-atleta). Onde dizer "responsável" como **contato** (cobrança/WhatsApp/e-mail), leia como `Guardian`. ROT-ALU-07 (portal autônomo) foi **superada** pelo modelo `Student.accountUserId` obrigatório + switcher (RN-200). Adicionadas duas regras transversais:
>
> - **RN-200** — Switcher de aluno ativo. `User` com `role=ATLETA` pode ser `accountUserId` de N `Student`. O front envia `X-Active-Student-Id` para indicar o aluno em foco; o backend valida via `athlete-scope.isAccountOfStudent`. CA: `account-switcher.e2e-spec.ts`.
> - **RN-201** — Aceite de termos no 1º login. ATLETA com `termsAcceptedAt = null` é forçado a um modal que captura `kinship` ("ATLETA" ou parentesco) e chama `POST /auth/accept-terms`. Acessos a operações sensíveis ficam bloqueados até o aceite.

Referência cruzada de **rotinas** (ROT-*) e **critérios de aceite** (CA-*) por módulo. Regras de negócio: **RN-*** (espalhadas nos documentos; principais listadas abaixo).

## 1. Tabela mestre de rotinas

| ID | Nome | Doc |
|----|------|-----|
| ROT-PERM-01 | Verificar escopo de turma (treinador) | [02](02-papeis-e-permissoes.md) |
| ROT-PERM-02 | Verificar vínculo responsável–aluno | [02](02-papeis-e-permissoes.md) |
| ROT-PERM-03 | Verificar autoria e escopo de plano individual | [02](02-papeis-e-permissoes.md) |
| ROT-TENANT-01 | Resolver tenant na requisição | [03](03-multi-tenant-e-lgpd.md) |
| ROT-TENANT-02 | Onboarding escolinha (tenant) | [03](03-multi-tenant-e-lgpd.md) |
| ROT-ALU-01 | Cadastrar aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-02 | Editar aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-03 | Inativar / reativar aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-04 | Cadastrar responsável | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-05 | Vincular responsável ↔ aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-06 | Desvincular responsável | [04](04-modulo-alunos-e-responsaveis.md) |
| ~~ROT-ALU-07~~ | ~~Configurar portal autônomo (ADMIN)~~ — **superada** pela refator ATLETA. Cada `Student` já tem `accountUserId` obrigatório; trocar a conta vinculada usa `PATCH /students/:id/account-user`. | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ATL-01 | Trocar aluno ativo (switcher — RN-200) | [02](02-papeis-e-permissoes.md) |
| ROT-ATL-02 | Aceitar termos no 1º login (RN-201) | [03](03-multi-tenant-e-lgpd.md) |
| ROT-TUR-01 | Criar turma | [05](05-modulo-turmas-e-categorias.md) |
| ROT-TUR-02 | Editar turma | [05](05-modulo-turmas-e-categorias.md) |
| ROT-TUR-03 | Matricular aluno na turma | [05](05-modulo-turmas-e-categorias.md) |
| ROT-TUR-04 | Desmatricular aluno | [05](05-modulo-turmas-e-categorias.md) |
| ROT-TUR-05 | Trocar treinador da turma | [05](05-modulo-turmas-e-categorias.md) |
| ROT-CAL-01 | Criar evento | [06](06-modulo-calendario.md) |
| ROT-CAL-02 | Alterar evento | [06](06-modulo-calendario.md) |
| ROT-CAL-03 | Cancelar evento | [06](06-modulo-calendario.md) |
| ROT-CAL-04 | Visualizar calendário (treinador) | [06](06-modulo-calendario.md) |
| ROT-CAL-05 | Visualizar calendário (responsável) | [06](06-modulo-calendario.md) |
| ROT-PRE-01 | Abrir sessão de presença | [07](07-modulo-presenca.md) |
| ROT-PRE-02 | Registrar presença (modo presentes) | [07](07-modulo-presenca.md) |
| ROT-PRE-03 | Registrar presença (modo ausências) | [07](07-modulo-presenca.md) |
| ROT-PRE-04 | Reabrir / corrigir sessão | [07](07-modulo-presenca.md) |
| ROT-PRE-05 | Consultar histórico (responsável) | [07](07-modulo-presenca.md) |
| ROT-AVA-01 | Configurar dimensões e modelo | [08](08-modulo-avaliacoes.md) |
| ROT-AVA-02 | Avaliar aluno | [08](08-modulo-avaliacoes.md) |
| ROT-AVA-03 | Avaliar lote (turma) | [08](08-modulo-avaliacoes.md) |
| ROT-AVA-04 | Visualizar evolução (responsável) | [08](08-modulo-avaliacoes.md) |
| ROT-REL-01 | Gerar relatório periódico | [09](09-modulo-relatorios-pais.md) |
| ROT-REL-02 | Pré-visualizar relatório (ADMIN) | [09](09-modulo-relatorios-pais.md) |
| ROT-REL-03 | Publicar relatório manual | [09](09-modulo-relatorios-pais.md) |
| ROT-REL-04 | Visualizar relatório (responsável) | [09](09-modulo-relatorios-pais.md) |
| ROT-COM-01 | Enviar aviso por turma | [10](10-modulo-comunicacao.md) |
| ROT-COM-02 | Enviar mensagem individual | [10](10-modulo-comunicacao.md) |
| ROT-COM-03 | Consultar histórico (responsável) | [10](10-modulo-comunicacao.md) |
| ROT-COM-04 | Marcar comunicação como lida | [10](10-modulo-comunicacao.md) |
| ROT-MID-01 | Upload mídia pós-treino | [11](11-modulo-midia.md) |
| ROT-MID-02 | Organizar mídia por evento | [11](11-modulo-midia.md) |
| ROT-MID-03 | Moderar / remover mídia | [11](11-modulo-midia.md) |
| ROT-MID-04 | Galeria (responsável) | [11](11-modulo-midia.md) |
| ROT-FIN-01 | Cadastrar mensalidade | [12](12-modulo-financeiro.md) |
| ROT-FIN-02 | Registrar pagamento manual | [12](12-modulo-financeiro.md) |
| ROT-FIN-03 | Listar inadimplência | [12](12-modulo-financeiro.md) |
| ROT-FIN-04 | Notificar pagamento pendente | [12](12-modulo-financeiro.md) |
| ROT-FIN-05 | Extrato (responsável) | [12](12-modulo-financeiro.md) |
| ROT-DAS-01 | Carregar dashboard | [13](13-modulo-dashboard-admin.md) |
| ROT-DAS-02 | Filtrar dashboard por período | [13](13-modulo-dashboard-admin.md) |
| ROT-DAS-03 | Exportar snapshot | [13](13-modulo-dashboard-admin.md) |
| ROT-PLI-01 | Cadastrar profissional (ADMIN) | [24](24-modulo-planos-individuais.md) |
| ROT-PLI-02 | Criar plano individual | [24](24-modulo-planos-individuais.md) |
| ROT-PLI-03 | Editar sessões e exercícios do plano | [24](24-modulo-planos-individuais.md) |
| ROT-PLI-04 | Publicar plano | [24](24-modulo-planos-individuais.md) |
| ROT-PLI-05 | Pausar / retomar plano | [24](24-modulo-planos-individuais.md) |
| ROT-PLI-06 | Concluir plano | [24](24-modulo-planos-individuais.md) |
| ROT-PLI-07 | Cancelar plano | [24](24-modulo-planos-individuais.md) |
| ROT-PLI-08 | Visualizar planos (responsável) | [24](24-modulo-planos-individuais.md) |
| ROT-NOT-01 | Emitir notificação | [14](14-modulo-notificacoes.md) |
| ROT-NOT-02 | Preferências de notificação | [14](14-modulo-notificacoes.md) |
| ROT-NOT-03 | Marcar notificação como lida | [14](14-modulo-notificacoes.md) |
| ROT-GAM-01 | Habilitar/desabilitar gamificação | [15](15-modulo-gamificacao-opcional.md) |
| ROT-GAM-02 | Conceder medalha automática | [15](15-modulo-gamificacao-opcional.md) |
| ROT-GAM-03 | Vitrine de conquistas | [15](15-modulo-gamificacao-opcional.md) |

## 2. Mapa de critérios de aceite (CA)

| ID | Descrição resumida | Doc |
|----|--------------------|-----|
| CA-02.01 | Treinador não acessa turma alheia | [02](02-papeis-e-permissoes.md) |
| CA-02.02 | Responsável não acessa aluno alheio | [02](02-papeis-e-permissoes.md) |
| CA-03.01 | Teste de isolamento entre tenants | [03](03-multi-tenant-e-lgpd.md) |
| CA-03.02 | Dados de saúde não em notificação indevida | [03](03-multi-tenant-e-lgpd.md) |
| CA-04.01–03 | Matrícula com responsável; log de saúde; unicidade contato | [04](04-modulo-alunos-e-responsaveis.md) |
| CA-25.01–25.05 | Portal autônomo: escopo RESPONSAVEL, rotas guardian, destinatários, matrícula Caso B, isolamento tenant | [04](04-modulo-alunos-e-responsaveis.md) |
| CA-05.01–03 | Limite turma; escopo treinador; notificação ao mudar horário | [05](05-modulo-turmas-e-categorias.md) |
| CA-06.01–03 | Notificar alteração; cancelamento registrado; escopo calendário | [06](06-modulo-calendario.md) |
| CA-07.01–03 | Poucos toques; métricas de presença | [07](07-modulo-presenca.md) |
| CA-08.01–03 | Limite comentário; feedback auto; sem comparação | [08](08-modulo-avaliacoes.md) |
| CA-09.01–03 | Sem ranking; templates seguros; link compartilhável | [09](09-modulo-relatorios-pais.md) |
| CA-10.01–03 | Escopo comunicação; histórico; integração calendário | [10](10-modulo-comunicacao.md) |
| CA-11.01–03 | Upload resiliente; thumbnails; exclusão consistente | [11](11-modulo-midia.md) |
| CA-12.01–03 | Extrato isolado; export; centavos no backend | [12](12-modulo-financeiro.md) |
| CA-13.01–02 | Performance dashboard; definição de retenção | [13](13-modulo-dashboard-admin.md) |
| CA-14.01–03 | Push opcional; sem vazamento; tom seguro | [14](14-modulo-notificacoes.md) |
| CA-15.01–02 | Gamificação opcional; sem ranking negativo | [15](15-modulo-gamificacao-opcional.md) |
| CA-16.01–02 | Carga mínima; backup | [16](16-requisitos-nao-funcionais.md) |
| CA-17.01–02 | Tenant em toda query; mídia protegida | [17](17-arquitetura-e-stack-sugerida.md) |
| CA-24.01–11 | Planos individuais: escopo, rascunho invisível, dedupe, preview clínico seguro, pausa ao inativar aluno, autoria/reatribuição, isolamento tenant, UI completa de sessão e exercício no editor (CA-24.09), **biblioteca de exercícios compartilhada por tenant + snapshot (CA-24.10/11)**. **A partir do Doc 25 só aceita `TRATAMENTO` clínico (RN-1320).** | [24](24-modulo-planos-individuais.md) |
| CA-25.01–06 | **Treinos (workouts)**: criação por ADMIN/PROFESSOR via biblioteca, snapshot de exercícios, atribuição XOR a turma ou aluno (unique por alvo), visibilidade do ATLETA com switcher (RN-200), modal de detalhe do exercício (objetivo + vídeo) | [25](25-modulo-treinos.md) |
| CA-25.07–09 | **Feedback físico pós-treino (Workout)**: dimensões 1–5 configuráveis por treino, submissão idempotente por dia pelo ATLETA, relatório agregado por treino e histórico cronológico por aluno (ADMIN/TREINADOR) | [25 §7](25-modulo-treinos.md) |
| CA-06.04–07 | **Feedback físico pós-evento (calendário)**: defaults do tenant configuráveis em Preferências, override por evento (custom/`[]`/herdar), submissão única por (evento,aluno) pelo ATLETA, relatório por evento e histórico cronológico por aluno (ADMIN/TREINADOR) | [06 §7](06-modulo-calendario.md) |

## 3. Regras de negócio globais (amostra)

| ID | Resumo |
|----|--------|
| RN-000 | Não aumentar trabalho operacional do treinador |
| RN-021 | Isolamento total entre tenants |
| RN-301–305 | Calendário: notificar alterações/cancelamentos; escopo por papel |
| RN-602 | Relatórios: sem comparação pública negativa, sem ranking humilhante |
| RN-1300–1308 | Planos individuais: escopo, rascunho, publicação, notificação segura, autoria, pausa ao inativar aluno, cancelamento soft, linguagem positiva | [24](24-modulo-planos-individuais.md) |
| RN-1320–1321 | **Treinos (workouts)**: Workout substitui o tipo `TREINO` do IndividualPlan; atribuição XOR turma/aluno; visibilidade da conta-atleta combina atribuições diretas + da turma | [25](25-modulo-treinos.md) |
| RN-1323–1324 | **Feedback físico de Workout**: dimensões por treino (até 5, key slug) e cadência diária com upsert idempotente (`unique(workoutId, studentId, submittedDate)`) | [25 §7](25-modulo-treinos.md) |
| RN-1325–1326 | **Feedback físico de evento (calendário)**: herança tenant→evento (override por evento aceita `[]` para desligar e `null` para herdar) + cadência **uma resposta por (evento,aluno)** com `unique(eventId, studentId)` | [06 §7](06-modulo-calendario.md) |
| RN-1400–1404 | Portal autônomo: quem altera flag, titular obrigatório, equivalência de escopo, desligar flag, notificações | [04](04-modulo-alunos-e-responsaveis.md) |

## 4. Priorização sugerida para MVP

1. Tenant + ADMIN + autenticação  
2. Alunos, responsáveis, turmas, treinador  
3. Calendário (treinos) + notificações mínimas  
4. Presença rápida  
5. Avaliação rápida + feedback automático simples  
6. Relatório básico para responsável  
7. Comunicados por turma  
8. Mídia simplificada  
9. Financeiro básico + dashboard  
10. Planos individuais (Doc 24, Fase 1 — prescrição, publicação, portal responsável; sem progresso/check-in)

Gamificação e IA: pós-MVP conforme [15](15-modulo-gamificacao-opcional.md) e [17](17-arquitetura-e-stack-sugerida.md).

## 5. Implementação neste repositório

O mapeamento rotina/critério × código e decisões de stack estão em [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md).
