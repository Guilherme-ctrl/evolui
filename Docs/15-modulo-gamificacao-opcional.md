# 15 — Módulo: Gamificação (opcional)

## 1. Objetivo

Engajamento adicional **sem** conflitar com RN-602 (sem rankings humilhantes ou comparação negativa entre crianças).

## 2. Funcionalidades possíveis

- Medalhas digitais individuais (“participou do amistoso”, “frequência 4 semanas”).  
- Destaque da semana **opcional** — apenas com critérios **positivos** e **sem** listar “piores”.  
- Conquistas pessoais.  
- Objetivos semanais individuais.  
- Evolução visual (avatar, progresso cosmético).

## 3. Regras de negócio

| ID | Regra |
|----|--------|
| RN-1200 | Gamificação é **desligável** por tenant (ADMIN). |
| RN-1201 | Nenhuma conquista deve implicar ranking público de desempenho negativo. |
| RN-1202 | Mensagens celebram esforço e presença, não “ser o melhor da turma” em detrimento de outros. |

## 4. Rotinas (esboço)

### ROT-GAM-01 — Habilitar/desabilitar módulo

**Ator:** ADMIN.

### ROT-GAM-02 — Conceder medalha automática

**Gatilhos:** frequência, participação em evento (regras configuráveis).

### ROT-GAM-03 — Visualizar vitrine (responsável/aluno)

**Exibe:** apenas conquistas do próprio aluno.

## 5. Critérios de aceite

- **CA-15.01:** com módulo desligado, UI não mostra placeholders vazios confusos.  
- **CA-15.02:** critérios de “destaque” passam revisão de produto para evitar RN-602b.
