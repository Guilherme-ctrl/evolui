# 07 — Módulo: Presença

## 1. Objetivo

Registrar presença com **mínimo atrito** para o treinador; operação **mobile-first**; concluir em **poucos toques**.

## 2. Regras de negócio

| ID | Regra |
|----|--------|
| RN-401 | Registro deve ser extremamente rápido. |
| RN-402 | Treinador não deve perder tempo operacional em fluxos longos. |
| RN-403 | Interface otimizada para **celular**. |
| RN-404 | Uma sessão de presença está ligada a **evento de treino** (ou sessão equivalente) + **turma**. |
| RN-405 | Métricas derivadas automaticamente: frequência mensal, frequência anual, percentual de presença, histórico de faltas. |

## 3. Fluxos suportados

### Fluxo A (RN-406)

Treinador marca alunos **presentes** (default: todos presentes; desmarca faltas).

### Fluxo B (RN-407)

Treinador marca **apenas ausências** (default presente para não listados).

**Especificação UX:** o produto deve oferecer **uma escolha de modo** na primeira versão ou inferir pelo comportamento (ex.: “marcar faltas” como tela principal).

## 4. Rotinas

### ROT-PRE-01 — Abrir sessão de presença

**Ator:** TREINADOR.  
**Pré-condição:** turma atribuída; existe evento de treino hoje ou seleção manual de data/evento.  
**Passos:** selecionar turma → selecionar sessão/evento → listar alunos ativos da turma.  
**Pós-condição:** rascunho de sessão criado (opcional) ou gravação direta.

### ROT-PRE-02 — Registrar presença (modo presentes)

**Passos:** marcar presentes; demais ficam ausentes **ou** ausência explícita conforme RN-406.  
**Pós-condição:** sessão fechada; métricas atualizadas (RN-405).

### ROT-PRE-03 — Registrar presença (modo ausências)

**Passos:** marcar somente ausências; demais considerados presentes (RN-407).  
**Pós-condição:** idem.

### ROT-PRE-04 — Reabrir / corrigir sessão

**Ator:** TREINADOR ou ADMIN (política: janela de tempo, ex.: mesma semana).  
**Pós-condição:** auditoria de alteração (quem, quando).

### ROT-PRE-05 — Consultar histórico (responsável)

**Escopo:** apenas filhos vinculados; exibe frequência e faltas sem comparar com outros alunos.

## 5. Critérios de aceite

- **CA-07.01:** fluxo completo em até **3 interações principais** após abrir a lista (alvo de UX; medir em teste de usabilidade).  
- **CA-07.02:** offline-first é desejável em roadmap; MVP pode exigir conexão com mensagem clara.  
- **CA-07.03:** métricas RN-405 disponíveis no perfil do aluno e nos relatórios.

## 6. Notificações

Opcional: resumo de falta para responsável (configurável por escolinha) — [14-modulo-notificacoes.md](14-modulo-notificacoes.md).
