# 05 — Módulo: Turmas e categorias

## 1. Objetivo

Organizar alunos em turmas operacionais com horários, local, treinador e limite de vagas; suportar categorias exemplificadas (Sub 7, Sub 9, Sub 11, Sub 13, Feminino, Adulto, etc.).

## 2. Regras de negócio

| ID | Regra |
|----|--------|
| RN-201 | Turma possui: nome, faixa etária (texto ou intervalo), dias da semana, horários, treinador responsável, limite de alunos, local do treino. |
| RN-202 | Não matricular aluno além do limite salvo override explícito do ADMIN com justificativa (opcional produto). |
| RN-203 | Treinador visualiza e opera apenas turmas atribuídas ([02-papeis-e-permissoes.md](02-papeis-e-permissoes.md)). |
| RN-204 | Categoria pode ser atributo da turma e/ou do aluno; consistência validada na matrícula (alerta se divergente). |

## 3. Rotinas

### ROT-TUR-01 — Criar turma

**Ator:** ADMIN.  
**Passos:** preencher RN-201; associar treinador.  
**Pós-condição:** turma disponível para matrícula e calendário.

### ROT-TUR-02 — Editar turma

**Ator:** ADMIN.  
**Efeitos:** alteração de horário/dias deve disparar fluxo de notificação ([06-modulo-calendario.md](06-modulo-calendario.md)).

### ROT-TUR-03 — Matricular aluno na turma

**Ator:** ADMIN.  
**Pré-condição:** aluno ativo; vagas disponíveis (RN-202).  
**Pós-condição:** aluno aparece nas listas da turma (presença, mídia, relatórios).

### ROT-TUR-04 — Desmatricular aluno

**Ator:** ADMIN.  
**Pós-condição:** aluno não aparece em novas sessões da turma; histórico mantido.

### ROT-TUR-05 — Trocar treinador da turma

**Ator:** ADMIN.  
**Pós-condição:** novo treinador vê turma; anterior perde acesso operacional; eventos futuros podem ser realocados (política: manter histórico com autor original).

## 4. Critérios de aceite

- **CA-05.01:** limite de alunos respeitado na matrícula.  
- **CA-05.02:** treinador não lista turmas não atribuídas.  
- **CA-05.03:** alteração de horário gera registro auditável + notificação (RN-301).

## 5. Métricas (dashboard)

“Turmas mais cheias” usa ocupação atual vs. limite ([13-modulo-dashboard-admin.md](13-modulo-dashboard-admin.md)).
