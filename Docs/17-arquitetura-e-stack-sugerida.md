# 17 — Arquitetura e stack sugerida

## 1. Alinhamento com este repositório

O monorepo **personal-futebol-mvp-empty** já inclui:

- **Backend:** Node.js + **NestJS** + **PostgreSQL** (Prisma).  
- **Frontend:** **React** + **Vite** (alternativa ao Next.js citado nas regras de negócio originais).

**Decisões já adotadas no código (MVP):** autenticação **JWT** própria (sem Clerk/Firebase neste repo); **Throttler** global na API e limite mais baixo em `POST /auth/login`; mídia servida pela API com autorização (sem bucket objeto gerenciado até evolução de deploy); **Sentry** opcional no frontend via `VITE_SENTRY_DSN`. Detalhes por módulo: [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md).

A especificação de negócio é **agnóstica** ao framework front; Next.js pode ser adotado em fork se SSR/SEO forem prioridade para o portal dos pais.

## 2. Stack sugerida (documento de negócio original)

| Camada | Opções citadas |
|--------|----------------|
| Frontend | React, Next.js |
| Backend | Node.js, NestJS |
| Banco | PostgreSQL |
| Armazenamento de mídia | Supabase Storage, Firebase Storage |
| Autenticação | Firebase Auth, Clerk |
| Notificações push | Firebase Cloud Messaging |

## 3. Mapeamento sugerido para implementação neste repo

- **API NestJS:** módulos por bounded context (tenant, identidade, turmas, calendário, presença, avaliações, relatórios, comunicação, mídia, financeiro, notificações).  
- **Prisma:** `tenantId` em todas as tabelas de negócio; índices compostos `(tenantId, ...)`.  
- **Vite/React:** app ADMIN/TREINADOR; app ou área RESPONSAVEL (pode ser mesmo SPA com rotas por papel).  
- **Storage:** adapter S3 ou Supabase; URLs assinadas para download.  
- **Auth:** JWT próprio ou Clerk; sincronizar `tenantId` e `role` nas claims.  
- **FCM:** worker assíncrono para envio de push.

## 4. IA (futuro)

Treinador seleciona avaliações rápidas → serviço de IA gera feedback humanizado, relatório amigável, resumo de evolução — com revisão humana opcional e opt-in do tenant.

## 5. Critérios de aceite de arquitetura

- **CA-17.01:** nenhuma query sem filtro de tenant em dados de negócio.  
- **CA-17.02:** mídia servida sem path público previsível sem autenticação/autorização.
