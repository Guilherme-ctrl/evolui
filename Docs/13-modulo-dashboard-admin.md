# 13 — Módulo: Dashboard administrativo

## 1. Objetivo

Painel geral da escolinha para o **ADMIN** com indicadores operacionais e de saúde do negócio.

## 2. Indicadores (RN-1000)

- Total de alunos (ativos / inativos).  
- Frequência média (turma ou escolinha — granularidade configurável).  
- Taxa de retenção (definição operacional: alunos ativos mês atual vs. mês anterior ou cohort; documentar fórmula na implementação).  
- Inadimplência (valor e/ou % de alunos em atraso).  
- Turmas mais cheias (ocupação vs. limite).  
- Evolução de alunos ativos (série temporal).

## 3. Rotinas

### ROT-DAS-01 — Carregar dashboard

**Ator:** ADMIN.  
**Pré-condição:** dados agregados ou consultas otimizadas (cache).  
**Pós-condição:** cartões e gráficos renderizados.

### ROT-DAS-02 — Filtrar por período

**Default:** mês corrente.

### ROT-DAS-03 — Exportar snapshot (opcional)

PDF ou CSV para reunião de staff.

## 4. Regras

| ID | Regra |
|----|--------|
| RN-1001 | Dados sempre filtrados pelo **tenant** atual. |
| RN-1002 | Treinador **não** acessa dashboard administrativo completo (pode ter “mini-dashboard” só suas turmas — feature opcional). |

## 5. Critérios de aceite

- **CA-13.01:** tempo de carregamento alvo definido em [16-requisitos-nao-funcionais.md](16-requisitos-nao-funcionais.md).  
- **CA-13.02:** definição de retenção documentada no código e na ajuda interna para evitar interpretações divergentes.
