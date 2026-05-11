# 14 — Módulo: Notificações

> **Refator ATLETA (2026-05):** ver nota no [README de Docs](README.md). O **target in-app** é a `User role=ATLETA` (conta-atleta). Os helpers em `NotificationsService` foram renomeados para `recipientUserIdsForTurmas` e `recipientUserIdsForStudent` (resolvem `Student.accountUserId`). Os canais **externos** (e-mail/WhatsApp/SMS), quando ativados, usam `Guardian` com `isPrimaryForBilling=true`. As regras de preview seguro (CA-03.02, RN-1304) continuam válidas e independem do papel.

## 1. Objetivo

Sistema centralizado de notificações (in-app, e-mail, push) com preferências por tipo e por usuário quando aplicável.

## 2. Eventos que geram notificação (RN-1100)

- Novo aviso / comunicado relevante.  
- Alteração de treino (calendário).  
- Cancelamento de treino/evento.  
- Pagamento pendente / atrasado.  
- Nova avaliação disponível para o responsável.  
- Novo relatório publicado.  
- Fotos ou vídeos adicionados (turma/filho).
- Plano individual publicado (`INDIVIDUAL_PLAN_PUBLISHED` — [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md), ROT-PLI-04).
- Plano individual atualizado após publicação (`INDIVIDUAL_PLAN_UPDATED`).
- Plano individual pausado ou retomado (`INDIVIDUAL_PLAN_PAUSED` quando aplicável ao fluxo de pausa).
- Plano individual concluído (`INDIVIDUAL_PLAN_COMPLETED` — ROT-PLI-06).
- Plano individual cancelado (`INDIVIDUAL_PLAN_CANCELLED` — ROT-PLI-07).

## 3. Canais

- **In-app** (centro de notificações) — **implementado no MVP deste repositório**, com preferências por categoria e idempotência onde aplicável.  
- **Push** (FCM ou equivalente) — planejado; não faz parte do MVP atual.  
- **E-mail** (transacional) — planejado; não faz parte do MVP atual.  

**RN-1101:** Responsável pode silenciar tipos não críticos; alertas de **cancelamento de treino** e **segurança** não desligáveis (política mínima).

## 4. Rotinas

### ROT-NOT-01 — Emitir notificação

**Entrada:** tipo, payload, destinatários (userIds ou segmento turma/responsáveis).  
**Passos:** persistir evento → enfileirar envio → entregar por canal.  
**Idempotência:** chave por (tipo, entidadeId, versão) para evitar duplicatas.

### ROT-NOT-02 — Registrar preferências

**Ator:** usuário autenticado.  
**Escopo:** por canal e por categoria.

### ROT-NOT-03 — Marcar como lida

**Ator:** destinatário.

## 5. Integração com outros módulos

**Destinatários “responsáveis do aluno”:** além dos `User` ligados via `StudentGuardian`, incluir o `portalUserId` quando o aluno estiver em **portal autônomo** (`selfManagedPortal`), com dedupe se o mesmo usuário já for guardian (**RN-1404**, Doc 04).

| Módulo | Gatilho típico |
|--------|----------------|
| Calendário | RN-301, RN-303 |
| Financeiro | RN-901, ROT-FIN-04 |
| Avaliações | avaliação salva |
| Relatórios | publicação |
| Mídia | upload concluído |
| Comunicação | novo aviso |
| Planos individuais | gatilhos ROT-PLI-04 a ROT-PLI-07 ([24](24-modulo-planos-individuais.md)) |

## 6. Critérios de aceite

- **CA-14.01:** falha de push não impede persistência in-app.  
- **CA-14.02:** notificações não vazam dados de outro tenant ou família.  
- **CA-14.03:** texto respeita RN-602 (tom) quando template incluir nome do aluno.  
- **CA-03.02** / **RN-1304:** planos do tipo `TRATAMENTO` não expõem objetivo, nomes de sessão nem detalhe clínico no **preview** in-app ou push; apenas título/body genéricos; detalhe só na tela autenticada do app ([24-modulo-planos-individuais.md](24-modulo-planos-individuais.md)).
