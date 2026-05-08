# 06 — Módulo: Calendário

## 1. Objetivo

Centralizar a agenda da escolinha com eventos tipados e regras de alteração, cancelamento e visibilidade por papel.

## 2. Tipos de evento

Treino, jogo, amistoso, evento (genérico), campeonato, avaliação, reunião.

## 3. Regras de negócio

| ID | Regra |
|----|--------|
| RN-301 | Alterações de evento (data, hora, local) geram **notificações automáticas** aos responsáveis afetados. |
| RN-302 | Cancelamentos devem ser **registrados** (motivo opcional, timestamp, autor). |
| RN-303 | Pais/responsáveis devem receber **alertas** de alteração e cancelamento. |
| RN-304 | Treinadores visualizam apenas eventos relacionados às **suas turmas** (e eventos institucionais se política permitir). |
| RN-305 | ADMIN visualiza calendário completo do tenant. |

## 4. Rotinas

### ROT-CAL-01 — Criar evento

**Ator:** ADMIN (treinador: apenas se produto permitir “proposta” — default ADMIN).  
**Passos:** tipo, título, início/fim, local, turma(s) ou “toda escolinha”, recorrência opcional.  
**Pós-condição:** evento publicado; participantes elegíveis notificados se configurado.

### ROT-CAL-02 — Alterar evento

**Ator:** ADMIN.  
**Passos:** editar campos; confirmar envio de notificação.  
**Pós-condição:** histórico de versão mínimo (antes/depois) + RN-301.

### ROT-CAL-03 — Cancelar evento

**Ator:** ADMIN.  
**Passos:** cancelar com motivo; opcional mensagem aos pais.  
**Pós-condição:** status cancelado; RN-302 e RN-303.

### ROT-CAL-04 — Visualizar calendário (treinador)

**Filtro:** apenas turmas do treinador + eventos globais do tenant (se houver).

### ROT-CAL-05 — Visualizar calendário (responsável)

**Filtro:** turmas dos filhos vinculados.

## 5. Critérios de aceite

- **CA-06.01:** toda alteração relevante gera notificação configurável (push/e-mail/in-app).  
- **CA-06.02:** cancelamento não apaga o registro — marca cancelado.  
- **CA-06.03:** treinador não acessa evento de turma alheia.

## 6. Integração com presença

Sessões de presença devem referenciar evento de treino (ou sessão gerada automaticamente a partir do treino recorrente) — ver [07-modulo-presenca.md](07-modulo-presenca.md).
