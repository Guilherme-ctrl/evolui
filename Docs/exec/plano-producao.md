# Plano — repo pronto para produção

Objetivo: **regressão verde**, **deploy reprodutível**, **segurança mínima aceitável**, **operação básica**. Sem escopo de produto novo.

---

## 1. Testes e CI (bloqueante)

| # | Entrega | Notas |
|---|---------|--------|
| 1.1 | `backend`: separar **`npm test`** (só `*.spec.ts`, excluir e2e) e **`npm run test:e2e`** (só `*.e2e-spec.ts`) | Hoje `jest` na raiz do backend mistura tudo; CI precisa dos dois comandos explícitos. |
| 1.2 | Corrigir **todos** os e2e até verde | Sintomas vistos: 404 em POST que deveriam existir, FK no seed vs IDs fixos nos testes, 500 calendário (turma inexistente), 403 vs 404 em isolamento. Alinhar **seed** (`prisma/seed.ts`) com IDs usados nos testes **ou** trocar testes para criar dados via API e guardar ids. |
| 1.3 | CI (GitHub Actions ou equivalente) | Pipeline: `backend` lint + `test` + `test:e2e` com Postgres de serviço + `migrate deploy` + seed de **teste** (não necessariamente seed demo completo — preferir factories nos testes). `frontend` lint + `build`. |
| 1.4 | Documentar no README | Um bloco “Produção / CI”: variáveis obrigatórias, comandos exatos. |

**Definição de pronto:** merge bloqueado se qualquer job falhar.

---

## 2. Configuração e segredos (bloqueante)

| # | Entrega | Notas |
|---|---------|--------|
| 2.1 | Lista mínima de env em produção | `DATABASE_URL`, `JWT_SECRET` (forte, rotação documentada), `PORT`, `CORS_ORIGIN` (origens reais, sem `*`), opcional `VITE_*` no front. |
| 2.2 | **Nunca** rodar `db:seed` de demo em prod | Seed só dev/staging; prod: migrate + usuário bootstrap documentado (script ou painel interno). |
| 2.3 | Revisar `.env.example` / `backend/.env.example` | Campos alinhados ao código; sem valores secretos. |

---

## 3. Segurança API (alta prioridade)

| # | Entrega | Notas |
|---|---------|--------|
| 3.1 | `helmet` (ou equivalente) | Headers HTTP baseline atrás de reverse proxy. |
| 3.2 | Upload / mídia | Limite de tamanho, tipos MIME, path seguro, sem path traversal; disco local só se aceito explicitamente (Doc 20 já alerta). |
| 3.3 | Throttling | Login já restrito; revisar rotas públicas e bulk (financeiro, comunicações). |
| 3.4 | `npm audit` / Dependabot | Política: critical/high antes de deploy. |
| 3.5 | Resposta 403 vs 404 | Onde a spec pedir “não revelar existência”, alinhar testes e implementação uma vez só. |

---

## 4. Operação (bloqueante para SLA)

| # | Entrega | Notas |
|---|---------|--------|
| 4.1 | Healthcheck | `GET` dedicado para LB (ex. `/api/health` ou `/api/ready` com checagem DB opcional). |
| 4.2 | Logs | Estruturados, sem PII em claro (já alinhado à Doc 16); nível e formato definidos em prod. |
| 4.3 | Backup e restore | **CA-16.02:** RPO/RTO escrito, teste de restore feito uma vez. |
| 4.4 | Migrações | `prisma migrate deploy` no deploy; nunca `migrate dev` em prod. |

---

## 5. Frontend e deploy estático

| # | Entrega | Notas |
|---|---------|--------|
| 5.1 | Build com `VITE_*` corretos | URL da API em produção; mesmo domínio ou CORS já configurado. |
| 5.2 | Opcional curto prazo | Playwright ou smoke manual documentado (login + 1 fluxo crítico). |

---

## 6. Infra pós-MVP (antes de escalar)

| # | Entrega | Notas |
|---|---------|--------|
| 6.1 | Object storage para mídia | Substitui disco do container; URLs e auth alinhados à Doc 16/20. |
| 6.2 | Observabilidade | Métricas + alertas (latência, 5xx, fila se houver). |

---

## Ordem sugerida

1. **1.1 → 1.2 → 1.3** (testes + CI)  
2. **2.* + 4.*** em paralelo com ajustes pequenos de código  
3. **3.***  
4. **5.*** no freeze antes do primeiro deploy  
5. **6.*** conforme carga e contrato com cliente  

---

## Documentação

- Atualizar [20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md) quando CI e env de prod estiverem definidos.  
- Índice: [README.md](../README.md).
