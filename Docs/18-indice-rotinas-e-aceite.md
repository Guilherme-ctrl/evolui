# 18 — Índice de rotinas e critérios de aceite

Referência cruzada de **rotinas** (ROT-*) e **critérios de aceite** (CA-*) por módulo. Regras de negócio: **RN-*** (espalhadas nos documentos; principais listadas abaixo).

## 1. Tabela mestre de rotinas

| ID | Nome | Doc |
|----|------|-----|
| ROT-PERM-01 | Verificar escopo de turma (treinador) | [02](02-papeis-e-permissoes.md) |
| ROT-PERM-02 | Verificar vínculo responsável–aluno | [02](02-papeis-e-permissoes.md) |
| ROT-TENANT-01 | Resolver tenant na requisição | [03](03-multi-tenant-e-lgpd.md) |
| ROT-TENANT-02 | Onboarding escolinha (tenant) | [03](03-multi-tenant-e-lgpd.md) |
| ROT-ALU-01 | Cadastrar aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-02 | Editar aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-03 | Inativar / reativar aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-04 | Cadastrar responsável | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-05 | Vincular responsável ↔ aluno | [04](04-modulo-alunos-e-responsaveis.md) |
| ROT-ALU-06 | Desvincular responsável | [04](04-modulo-alunos-e-responsaveis.md) |
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

## 3. Regras de negócio globais (amostra)

| ID | Resumo |
|----|--------|
| RN-000 | Não aumentar trabalho operacional do treinador |
| RN-021 | Isolamento total entre tenants |
| RN-301–305 | Calendário: notificar alterações/cancelamentos; escopo por papel |
| RN-602 | Relatórios: sem comparação pública negativa, sem ranking humilhante |

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

Gamificação e IA: pós-MVP conforme [15](15-modulo-gamificacao-opcional.md) e [17](17-arquitetura-e-stack-sugerida.md).
