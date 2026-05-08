# 10 — Módulo: Comunicação interna

## 1. Objetivo

Comunicação entre escolinha e responsáveis: avisos, alterações, convocações, eventos, mensagens individuais e alertas de pagamento.

## 2. Tipos de comunicação

- Avisos gerais (tenant ou segmento).  
- Alterações de treino (integração com calendário).  
- Convocações.  
- Eventos.  
- Mensagens individuais (responsável ou aluno como assunto).  
- Notificações de pagamento ([12-modulo-financeiro.md](12-modulo-financeiro.md)).

## 3. Regras de negócio

| ID | Regra |
|----|--------|
| RN-700 | Comunicação pode ser por **turma** ou **individual**. |
| RN-701 | Notificações **push** quando canal configurado ([14-modulo-notificacoes.md](14-modulo-notificacoes.md)). |
| RN-702 | **Histórico de mensagens** persistido por thread ou feed cronológico. |
| RN-703 | Treinador envia avisos apenas no **escopo das suas turmas** salvo delegação explícita do ADMIN. |
| RN-704 | ADMIN pode enviar comunicados globais. |

## 4. Rotinas

### ROT-COM-01 — Enviar aviso por turma

**Ator:** ADMIN ou TREINADOR (turma própria).  
**Passos:** redigir título e corpo; anexos opcionais; confirmar turma; agendar ou enviar agora.  
**Pós-condição:** mensagem entregue; RN-701 se habilitado.

### ROT-COM-02 — Enviar mensagem individual

**Ator:** ADMIN (e TREINADOR se política permitir contato direto ao responsável do aluno da turma).  
**Pós-condição:** thread individual visível ao remetente e destinatário.

### ROT-COM-03 — Consultar histórico (responsável)

**Filtro:** comunicações dos filhos / turmas relacionadas.

### ROT-COM-04 — Marcar como lida / arquivar

**Opcional:** melhora UX do inbox.

## 5. Critérios de aceite

- **CA-10.01:** treinador não seleciona turma de outro treinador.  
- **CA-10.02:** histórico não perde mensagens ao atualizar app (sincronização servidor como fonte da verdade).  
- **CA-10.03:** alteração de treino originada do calendário gera entrada de comunicação automática (link para evento).

## 6. Moderação e LGPD

Conteúdo proibido — termos de uso do tenant; denúncia e bloqueio sob responsabilidade do ADMIN.
