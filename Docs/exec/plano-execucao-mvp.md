# Plano de execução — MVP (SaaS Escolinhas)

> **⚠️ SUPERADO pela refator ATLETA (2026-05).** O modelo de papéis com `RESPONSAVEL` e `Guardian.userId` deste plano foi substituído por:
> - `UserRole.ATLETA` (renomeado);
> - `Student.accountUserId` obrigatório (conta-atleta que opera o app — RN-200 multi-aluno);
> - `Guardian` = contato puro (sem login);
> - Aceite de termos no 1º login (RN-201, `User.termsAcceptedAt` + `User.termsKinship`).
>
> A fonte da verdade agora é o código (`backend/prisma/schema.prisma`, `auth/`, `students/`) e o documento [20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md). As fases descritas abaixo permanecem úteis como histórico, mas devem ser lidas substituindo o vocabulário antigo.

Documento gerado a partir das especificações em `Docs/`, alinhado ao skill **escolinhas-specs-exec-plan** e ao índice **`18-indice-rotinas-e-aceite.md`** (priorização §4).

**Estado do repositório:** a implementação base do MVP está refletida no código atual; ver [20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md). Para padronização e lint, ver [plano-limpeza-padronizacao-codigo.md](plano-limpeza-padronizacao-codigo.md).

## Contexto

- **Produto:** SaaS multi-tenant para escolinhas de futebol.
- **Stack:** NestJS + PostgreSQL (Prisma) + React/Vite — `17-arquitetura-e-stack-sugerida.md`.
- **Design / UX:** `19-design-system-brand-guide.md`, `00-visao-e-objetivos.md` (**RN-000**), `16-requisitos-nao-funcionais.md`.
- **Fora do MVP** (explícito em `18` §4): gamificação (`15`, ROT-GAM-*, CA-15.*) e IA (`17` §4).

---

## Fases

### Fase 0 — Fundação técnica e observabilidade

| | |
|--|--|
| **Docs** | `16-requisitos-nao-funcionais.md`, `17-arquitetura-e-stack-sugerida.md` |
| **Entregas** | PostgreSQL + Prisma migrável; health check da API; logs estruturados sem PII em claro; rate limit em login (quando existir); README de env local. |
| **ROT / CA** | **CA-16.01** (baseline de carga em listagens antes de release maior), **CA-16.02** (backup/RPO/RTO — decisão operacional documentada). |
| **Notas técnicas** | `schema.prisma` inicial mínimo para Fase 1; contrato `DATABASE_URL`. |
| **Definição de pronto** | API sobe, health responde, migrate aplicável em dev. |

---

### Fase 1 — Tenant, identidade, auth e contexto de requisição

| | |
|--|--|
| **Docs** | `03-multi-tenant-e-lgpd.md`, `02-papeis-e-permissoes.md`, `17-arquitetura-e-stack-sugerida.md`, `01-glossario-e-entidades.md` |
| **Entregas** | Modelo Tenant + usuários (ADMIN / TREINADOR / RESPONSAVEL); auth (JWT ou Clerk); **ROT-TENANT-01**; **ROT-TENANT-02** (onboarding: seed em dev + fluxo mínimo conforme produto). |
| **ROT / CA** | Base para **ROT-PERM-01**, **ROT-PERM-02**; **CA-17.01**, **CA-03.01**, **CA-02.01**, **CA-02.02**. |
| **Notas técnicas** | Guard de tenant; nunca aceitar `tenantId` arbitrário do cliente; teste automatizado isolamento entre tenants (**CA-03.01**). |
| **Definição de pronto** | Login com `tenantId` + `role`; cross-tenant bloqueado; queries de negócio sempre filtradas (**CA-17.01**). |

---

### Fase 2 — Alunos e responsáveis

| | |
|--|--|
| **Docs** | `04-modulo-alunos-e-responsaveis.md`, `02`, `03`, `01` |
| **Entregas** | CRUD aluno e responsável; vínculos; ativo/inativo; UI ADMIN + API. |
| **ROT / CA** | **ROT-ALU-01** … **ROT-ALU-06**; **CA-04.01–03**. |
| **Notas técnicas** | Campos sensíveis e política de exibição; alinhar nomenclatura ao glossário. |
| **Definição de pronto** | Rotinas 04 cobertas; aceite 04 verificável em QA. |

---

### Fase 3 — Turmas, categorias e matrículas

| | |
|--|--|
| **Docs** | `05-modulo-turmas-e-categorias.md`, `02`, `03`, `01` |
| **Entregas** | Turmas com treinador; matricular/desmatricular; troca de treinador; UI ADMIN; API com escopo TREINADOR. |
| **ROT / CA** | **ROT-TUR-01** … **ROT-TUR-05**; **CA-05.01–03**; **ROT-PERM-01** + **CA-02.01**. |
| **Notas técnicas** | Índices `(tenantId, …)`; limite de vagas; notificação ao mudar horário quando **CA-05** exigir. |
| **Definição de pronto** | Treinador só turmas atribuídas; ADMIN escopo completo. |

---

### Fase 4 — Calendário e notificações mínimas

| | |
|--|--|
| **Docs** | `06-modulo-calendario.md`, `14-modulo-notificacoes.md`, `03`, `02`, `17` |
| **Entregas** | **ROT-CAL-01** … **ROT-CAL-05**; pipeline **ROT-NOT-01** para alterações/cancelamentos (**RN-301–305**); **ROT-NOT-02**, **ROT-NOT-03** em versão mínima (in-app antes de FCM). |
| **ROT / CA** | **CA-06.01–03**; **CA-14.01–03**; **CA-03.02** em conteúdo de notificações. |
| **Notas técnicas** | UTC no banco; fila/worker para push quando adotar FCM (`17`). |
| **Definição de pronto** | Alteração/cancelamento rastreável; notificação in-app sem vazar dado sensível. |

---

### Fase 5 — Presença rápida (mobile-first)

| | |
|--|--|
| **Docs** | `07-modulo-presenca.md`, `00`, `16`, `19` |
| **Entregas** | **ROT-PRE-01** … **ROT-PRE-05**; UI treinador com poucos toques; histórico para responsável. |
| **ROT / CA** | **CA-07.01–03**; **RN-000** validado em UX. |
| **Notas técnicas** | Paginação/cursor em listas grandes (**CA-16.01**). |
| **Definição de pronto** | Histórico responsável só com **ROT-PERM-02** / **CA-02.02**. |

---

### Fase 6 — Avaliações rápidas e feedback simples

| | |
|--|--|
| **Docs** | `08-modulo-avaliacoes.md`, `00`, `16`, `19` |
| **Entregas** | **ROT-AVA-01** … **ROT-AVA-04**. |
| **ROT / CA** | **CA-08.01–03**. |
| **Notas técnicas** | Alinhar a **RN-602** e anti-objetivos em `00`. |
| **Definição de pronto** | Evolução visível ao responsável sem ranking humilhante; lote usável no celular. |

---

### Fase 7 — Relatórios básicos para responsáveis

| | |
|--|--|
| **Docs** | `09-modulo-relatorios-pais.md`, `03`, `02` |
| **Entregas** | **ROT-REL-01** … **ROT-REL-04**. |
| **ROT / CA** | **CA-09.01–03**; **RN-602**. |
| **Definição de pronto** | Publicação e leitura com escopo e LGPD (`03`). |

---

### Fase 8 — Comunicação (avisos)

| | |
|--|--|
| **Docs** | `10-modulo-comunicacao.md`, `14`, `02`, `03` |
| **Entregas** | **ROT-COM-01** … **ROT-COM-04**. |
| **ROT / CA** | **CA-10.01–03**. |
| **Definição de pronto** | Escopo treinador vs institucional conforme `02`. |

---

### Fase 9 — Mídia simplificada

| | |
|--|--|
| **Docs** | `11-modulo-midia.md`, `17`, `03`, `02` |
| **Entregas** | **ROT-MID-01** … **ROT-MID-04**; storage com URLs assinadas. |
| **ROT / CA** | **CA-11.01–03**; **CA-17.02**. |
| **Notas técnicas** | Adapter S3/Supabase; retry de upload (`16`). |
| **Definição de pronto** | Exclusão consistente storage + DB. |

---

### Fase 10 — Financeiro básico e dashboard admin

| | |
|--|--|
| **Docs** | `12-modulo-financeiro.md`, `13-modulo-dashboard-admin.md`, `02`, `03`, `16` |
| **Entregas** | **ROT-FIN-01** … **ROT-FIN-05**; **ROT-DAS-01** … **ROT-DAS-03**. |
| **ROT / CA** | **CA-12.01–03**; **CA-13.01–02**; **CA-02.02** no extrato. |
| **Definição de pronto** | Responsável vê só seu extrato; admin vê KPIs no período. |

---

### Fase 11 — Planos individuais (Doc 24)

| | |
|--|--|
| **Docs** | `24-modulo-planos-individuais.md`, `02`, `03`, `04`, `14`, `18`, `19`, `20` |
| **Entregas** | **ROT-PLI-01** … **ROT-PLI-08**; `StaffProfile` + CRUD/publicação de `IndividualPlan`; portal responsável; notificações com preview seguro (**CA-03.02**, **RN-1304**); pausa automática ao inativar aluno (**RN-1306**, **CA-24.06**). |
| **ROT / CA** | **CA-24.01–08**; **RN-1300–1308**; **ROT-PERM-03**; reforço **CA-02.02** no portal do responsável. |
| **Notas técnicas** | **RN-000:** UI de criação de plano só para `StaffProfile.active`; treinador de campo sem Staff não ganha fluxo novo. Ver ordem de PRs em [plano-implementacao-planos-individuais.md](plano-implementacao-planos-individuais.md) §7. |
| **Definição de pronto** | Profissional demo no seed; E2E cobre publicação, isolamento tenant e preview `TRATAMENTO`; `Doc 20` marca Fase 1 entregue. |

---

## Ordem sugerida de PRs

1. Prisma + health + logging + env.
2. Tenant + User + auth + guards + testes **CA-03.01**, **CA-02.01**, **CA-02.02**.
3. Alunos e responsáveis — **ROT-ALU-\***.
4. Turmas e matrículas — **ROT-TUR-\***.
5. Calendário + notificações in-app — **ROT-CAL-\***, **ROT-NOT-\***.
6. Presença — **ROT-PRE-\***.
7. Avaliações — **ROT-AVA-\***.
8. Relatórios — **ROT-REL-\***.
9. Comunicação — **ROT-COM-\***.
10. Mídia — **ROT-MID-\***, **CA-17.02**.
11. Financeiro + dashboard — **ROT-FIN-\***, **ROT-DAS-\***.
12. Planos individuais (Doc 24) — **ROT-PLI-\***, **ROT-PERM-03**, **CA-24.\***.
13. Hardening: **CA-16.01**; FCM/worker se push for imediato (**CA-14.01**).

---

## Testes e aceite mínimo (referência rápida)

| ID | Verificação |
|----|-------------|
| **CA-03.01** | Teste automatizado cross-tenant (403/404). |
| **CA-02.01** | Treinador não acessa turma alheia. |
| **CA-02.02** | Responsável não acessa aluno sem vínculo. |
| **CA-17.01** | Queries de negócio com `tenantId` do contexto. |
| **CA-17.02** | Mídia sem URL pública previsível sem authz (pós-Fase 9). |
| **CA-03.02** | Saúde não em notificação indevida. |
| **CA-04.01–03** … **CA-14.01–03** | Conforme módulos após cada fase correspondente. |
| **CA-16.01–02** | Carga mínima listagens; política de backup. |

---

## Riscos e dependências

- Decisão **auth** (JWT vs Clerk) na Fase 1.
- **FCM** pode ficar após MVP in-app; manter eventos **ROT-NOT-01** internos.
- **Mídia** depende de bucket; impacta **CA-17.02**.
- **Relatórios** dependem de dados das fases 5–7 — ordem 5→6→7 deve ser respeitada.
- **RN-000:** revisões de UX nas fases 5–6 são críticas.

---

## Documentação relacionada

- Índice de rotinas e aceite: [../18-indice-rotinas-e-aceite.md](../18-indice-rotinas-e-aceite.md)
- README dos docs: [../README.md](../README.md)
- Skill de planejamento: [../../.cursor/skills/escolinhas-specs-exec-plan/SKILL.md](../../.cursor/skills/escolinhas-specs-exec-plan/SKILL.md)
