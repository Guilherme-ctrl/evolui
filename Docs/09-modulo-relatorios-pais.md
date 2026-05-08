# 09 — Módulo: Relatórios para pais

## 1. Objetivo

Funcionalidade **emocional** central: retenção, engajamento, sensação de evolução, justificativa de valor da mensalidade, percepção de profissionalismo.

## 2. Conteúdo exibido (RN-600)

Relatório consolidado por aluno deve poder incluir:

- Frequência (resumo e tendência).  
- Evolução geral (linguagem qualitativa + indicadores individuais).  
- Avaliações recentes (agregadas).  
- Feedback do treinador (incl. automático).  
- Fotos recentes.  
- Vídeos recentes.  
- Participação em eventos.

**RN-601:** Responsável vê apenas alunos vinculados.

## 3. Regras éticas e de tom (RN-602)

| ID | Regra |
|----|--------|
| RN-602a | **Nunca** comparar crianças publicamente no mesmo relatório/página social. |
| RN-602b | **Nunca** gerar rankings negativos. |
| RN-602c | **Nunca** humilhar atletas. |
| RN-602d | Foco em **evolução individual**. |
| RN-602e | Tom **positivo e construtivo**. |

## 4. Rotinas

### ROT-REL-01 — Gerar relatório periódico (sistema)

**Gatilho:** mensal ou configurável pelo ADMIN.  
**Passos:** agregar dados do período; aplicar templates de texto RN-602; gerar PDF ou página.  
**Pós-condição:** relatório disponível no portal; notificação “Novo relatório” ([14-modulo-notificacoes.md](14-modulo-notificacoes.md)).

### ROT-REL-02 — Pré-visualizar relatório (ADMIN)

**Objetivo:** validar tom e dados antes do envio em massa (opcional produto).

### ROT-REL-03 — Publicar relatório manual (treinador/ADMIN)

**Política:** treinador pode sugerir nota ou bloco; ADMIN publica se fluxo exigir moderação.

### ROT-REL-04 — Visualizar relatório (responsável)

**Passos:** lista de filhos → relatórios por período → detalhe.  
**CA-09.01:** não há menção a posição relativa em turma (“pior/melhor da turma”).

## 5. Critérios de aceite

- **CA-09.02:** motor de template **não** inclui variáveis que exponham ranking.  
- **CA-09.03:** relatório pode ser compartilhado por link assinado/expiração (opcional) sem expor outros alunos.

## 6. Métricas de produto (analytics interno)

Taxa de abertura de relatório, retorno de assinatura (fora do escopo técnico detalhado aqui).
