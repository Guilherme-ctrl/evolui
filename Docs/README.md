# Documentação de produto — SaaS Escolinhas de Futebol

Especificações derivadas das regras de negócio do produto (escolinhas de futebol, multi-tenant). Cada arquivo cobre um módulo ou tema transversal, com **rotinas** (fluxos), **regras de negócio** e **critérios de aceite** para implementação e QA.

> **Refator ATLETA (2026-05) — fonte da verdade no código.** O papel `RESPONSAVEL` foi substituído por `ATLETA` no enum `UserRole`. Cada `Student` agora tem `accountUserId` (obrigatório) apontando para um `User role=ATLETA` — a conta que opera o app. `Guardian` virou entidade **de contato** (cobrança/WhatsApp/e-mail), **sem login**. Suporte a múltiplos alunos por conta (switcher no header — RN-200) e aceite de termos no 1º login (RN-201, `User.termsAcceptedAt`+`termsKinship`). Specs `01/02/03/04/10/12/14/18/20` foram atualizadas a partir desta nota; partes que ainda usam o vocabulário antigo devem ser lidas substituindo `RESPONSAVEL → ATLETA` e `Guardian.userId → Student.accountUserId`. Plano antigo de cadastro de responsável com login (em `exec/plano-execucao-mvp.md`) está **superado** por esta refator.

## Índice

| Arquivo | Conteúdo |
|---------|----------|
| [00-visao-e-objetivos.md](00-visao-e-objetivos.md) | Visão, filosofia, anti-objetivos |
| [01-glossario-e-entidades.md](01-glossario-e-entidades.md) | Termos e entidades |
| [02-papeis-e-permissoes.md](02-papeis-e-permissoes.md) | Papéis e matriz de permissões |
| [03-multi-tenant-e-lgpd.md](03-multi-tenant-e-lgpd.md) | Isolamento, dados sensíveis |
| [04-modulo-alunos-e-responsaveis.md](04-modulo-alunos-e-responsaveis.md) | Alunos e responsáveis |
| [05-modulo-turmas-e-categorias.md](05-modulo-turmas-e-categorias.md) | Turmas e categorias |
| [06-modulo-calendario.md](06-modulo-calendario.md) | Agenda e eventos |
| [07-modulo-presenca.md](07-modulo-presenca.md) | Presença e métricas |
| [08-modulo-avaliacoes.md](08-modulo-avaliacoes.md) | Avaliações rápidas |
| [09-modulo-relatorios-pais.md](09-modulo-relatorios-pais.md) | Relatórios para responsáveis |
| [10-modulo-comunicacao.md](10-modulo-comunicacao.md) | Comunicação escolinha ↔ pais |
| [11-modulo-midia.md](11-modulo-midia.md) | Fotos e vídeos |
| [12-modulo-financeiro.md](12-modulo-financeiro.md) | Mensalidades e pagamentos |
| [13-modulo-dashboard-admin.md](13-modulo-dashboard-admin.md) | Painel administrativo |
| [14-modulo-notificacoes.md](14-modulo-notificacoes.md) | Notificações e gatilhos |
| [15-modulo-gamificacao-opcional.md](15-modulo-gamificacao-opcional.md) | Gamificação (opcional) |
| [16-requisitos-nao-funcionais.md](16-requisitos-nao-funcionais.md) | RNF |
| [17-arquitetura-e-stack-sugerida.md](17-arquitetura-e-stack-sugerida.md) | Stack e integrações |
| [18-indice-rotinas-e-aceite.md](18-indice-rotinas-e-aceite.md) | Lista mestre de rotinas e IDs |
| [19-design-system-brand-guide.md](19-design-system-brand-guide.md) | Identidade, tokens e componentes UI |
| [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md) | Alinhamento specs × código neste repositório |
| [21-opinioes-melhoria-ux-po.md](21-opinioes-melhoria-ux-po.md) | Diretriz de UX/produto (complementa ROT/CA) |
| [22-plano-implementacao-doc21.md](22-plano-implementacao-doc21.md) | Plano técnico das melhorias do Doc 21 |
| [23-design-system-brand-benchmark-mercado.md](23-design-system-brand-benchmark-mercado.md) | Mercado, marca, logo, design system e benchmark (fases + anexos: one-pager e checklist) |

### Execução e engenharia

| Arquivo | Conteúdo |
|---------|----------|
| [exec/plano-execucao-mvp.md](exec/plano-execucao-mvp.md) | Fases, ROT/CA e ordem de PRs |
| [exec/plano-limpeza-padronizacao-codigo.md](exec/plano-limpeza-padronizacao-codigo.md) | Backlog de padronização, lint e refator front |
| [exec/prompt-sdd-doc22.md](exec/prompt-sdd-doc22.md) | Prompt único para agentes: implementação do Doc 22 |
| [exec/plano-producao.md](exec/plano-producao.md) | Checklist enxuto: testes, CI, segredos, segurança, operação, deploy |

## Convenções

- **RN-xxx**: identificador de regra de negócio (referenciado no índice de rotinas).
- **Rotina**: fluxo nomeado com pré-condição, passos, pós-condição e exceções.
- **CA-xx.yy**: critério de aceite (módulo.rotina).
