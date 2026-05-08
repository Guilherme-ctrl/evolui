# Documentação de produto — SaaS Escolinhas de Futebol

Especificações derivadas das regras de negócio do produto (escolinhas de futebol, multi-tenant). Cada arquivo cobre um módulo ou tema transversal, com **rotinas** (fluxos), **regras de negócio** e **critérios de aceite** para implementação e QA.

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

## Convenções

- **RN-xxx**: identificador de regra de negócio (referenciado no índice de rotinas).
- **Rotina**: fluxo nomeado com pré-condição, passos, pós-condição e exceções.
- **CA-xx.yy**: critério de aceite (módulo.rotina).
