# Referência — `Docs/` e convenções

## Índice de arquivos

| Arquivo | Uso no plano de execução |
|---------|---------------------------|
| `Docs/README.md` | Índice e convenções RN / ROT / CA |
| `Docs/00-visao-e-objetivos.md` | RN-000, filosofia, UX |
| `Docs/01-glossario-e-entidades.md` | Modelo conceitual, nomes |
| `Docs/02-papeis-e-permissoes.md` | RBAC, ROT-PERM-*, CA-02.* |
| `Docs/03-multi-tenant-e-lgpd.md` | tenantId, LGPD, CA-03.* |
| `Docs/04` … `Docs/15` | Módulos funcionais |
| `Docs/16-requisitos-nao-funcionais.md` | Performance, segurança, CA-16.* |
| `Docs/17-arquitetura-e-stack-sugerida.md` | Nest, Prisma, front, CA-17.* |
| `Docs/18-indice-rotinas-e-aceite.md` | Lista mestre ROT / CA |
| `Docs/19-design-system-brand-guide.md` | Tokens, componentes, modos UI |

## Convenções

- **RN-xxx:** regra de negócio.
- **ROT-xxx:** rotina (fluxo).
- **CA-xx.yy:** critério de aceite.

## Stack do repositório

- Backend: NestJS + PostgreSQL (Prisma).
- Frontend: React + Vite.
