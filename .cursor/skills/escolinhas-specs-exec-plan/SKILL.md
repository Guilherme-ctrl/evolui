---
name: escolinhas-specs-exec-plan
description: >-
  Gera planos de execução de implementação a partir das especificações em Docs/
  (SaaS escolinhas multi-tenant): fases, dependências, ROT/CA, escopo backend/
  frontend e checagens de QA. Use quando o usuário pedir plano de execução,
  roadmap de MVP, ordem de implementação das specs, ou “como desenvolver o que
  está em Docs”.
---

# Plano de execução — specs Escolinhas (`Docs/`)

## Objetivo

Produzir um **plano de execução acionável** alinhado aos documentos do repositório, com fases ordenadas por dependência, rastreio **ROT-*** / **CA-*** e cortes verticais adequados ao monorepo (NestJS + Prisma + Vite/React), sem inventar regra de negócio fora dos `.md`.

## Antes de escrever o plano

1. Ler **`Docs/18-indice-rotinas-e-aceite.md`** (mapa mestre de rotinas e critérios de aceite).
2. Ler **`Docs/01-glossario-e-entidades.md`** se o plano envolver modelo de dados ou nomenclatura.
3. Para o escopo MVP, usar a **priorização sugerida** em `18` §4 e cruzar com **`Docs/17-arquitetura-e-stack-sugerida.md`**.
4. Para UX, mobile-first e fluxos críticos: **`Docs/00-visao-e-objetivos.md`**, **`Docs/16-requisitos-nao-funcionais.md`**, **`Docs/19-design-system-brand-guide.md`**.
5. Transversais obrigatórios em qualquer fase com API: **`Docs/02-papeis-e-permissoes.md`**, **`Docs/03-multi-tenant-e-lgpd.md`**.

Se o usuário pedir só um módulo, limitar o plano ao módulo correspondente (`04`–`15`) mas citar **02**, **03**, **17** quando houver permissão, `tenantId` ou dados sensíveis.

## Regras de qualidade do plano

- Cada fase deve ter **objetivo**, **docs de entrada** (lista de arquivos), **entregas** (API/DB/UI), **ROT/CA** cobertos e **verificação** (teste ou checklist).
- **Não** aceitar `tenantId` do cliente sem contexto de super-admin; plano deve mencionar isolamento (CA-17.01, CA-03.01).
- Fluxos de treinador em campo devem respeitar **RN-000** (não aumentar trabalho operacional) — referenciar `00`.
- IDs de rotina e aceite devem ser **copiados dos docs** (ex.: ROT-PRE-01, CA-07.01), não inventados.

## Template de saída (usar este esqueleto)

```markdown
# Plano de execução — [escopo: MVP | módulo X | feature Y]

## Contexto
- Produto: SaaS escolinhas (multi-tenant). Stack: ver Docs/17.
- Design / UX: Docs/19, 00, 16.

## Fases
### Fase N — [nome]
- **Docs:** …
- **Entregas:** …
- **ROT / CA:** …
- **Notas técnicas:** (Prisma, guards, paginação, etc.)
- **Definição de pronto:** …

## Ordem sugerida de PRs / prompts
1. …
2. …

## Testes e aceite mínimo
- CA-03.01: …
- CA-02.01 / CA-02.02: …
- (demais CAs do escopo)

## Riscos e dependências
- …
```

## Ordem base MVP (ajustar só se o usuário mudar escopo)

Referência rápida — detalhar no plano com ROT/CA do `18`:

1. Fundação: repo, DB, health, observabilidade mínima (`16`, `17`).
2. Tenant + identidade + auth + contexto `tenantId` (`03`, `02`, `17`).
3. Onboarding / primeiro ADMIN (`03` — ROT-TENANT-02).
4. Alunos e responsáveis (`04`).
5. Turmas e matrículas (`05`).
6. Calendário (`06`) + notificações mínimas (`14`).
7. Presença (`07`).
8. Avaliações rápidas (`08`).
9. Relatórios para responsáveis (`09`).
10. Comunicação (`10`).
11. Mídia (`11`).
12. Financeiro básico (`12`) + dashboard admin (`13`).
13. Pós-MVP: gamificação (`15`), IA (`17` §4).

## Recursos adicionais

- Tabela expandida de docs e convenções: [reference.md](reference.md)
