# 14 — Módulo: Notificações

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

## 3. Canais

- **In-app** (centro de notificações).  
- **Push** (FCM ou equivalente).  
- **E-mail** (transacional).  

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

| Módulo | Gatilho típico |
|--------|----------------|
| Calendário | RN-301, RN-303 |
| Financeiro | RN-901, ROT-FIN-04 |
| Avaliações | avaliação salva |
| Relatórios | publicação |
| Mídia | upload concluído |
| Comunicação | novo aviso |

## 6. Critérios de aceite

- **CA-14.01:** falha de push não impede persistência in-app.  
- **CA-14.02:** notificações não vazam dados de outro tenant ou família.  
- **CA-14.03:** texto respeita RN-602 (tom) quando template incluir nome do aluno.
