# 16 — Requisitos não funcionais

## 1. Performance

- Fluxos críticos (presença, avaliação rápida) **rápidos no celular**; interação perceptível < 100 ms para toggles locais; telas principais carregam em alvo a definir (ex.: LCP < 2,5 s em 4G médio).  
- **Baixo tempo de carregamento** de listas (paginação infinita ou cursor).  
- **Upload otimizado** de imagens: compressão client-side opcional, limite de dimensão, fila de retry.

## 2. Segurança

- **Isolamento entre tenants** (RN-021).  
- **Controle de permissões** por papel ([02-papeis-e-permissoes.md](02-papeis-e-permissoes.md)).  
- **Proteção de dados pessoais** e sensíveis ([03-multi-tenant-e-lgpd.md](03-multi-tenant-e-lgpd.md)).  
- Autenticação forte; sessões revogáveis; **rate limit** na API (`@nestjs/throttler`, com limite específico no login) e política de upload a documentar por ambiente.

## 3. Escalabilidade

- Suporte a **múltiplas escolinhas** (multi-tenant horizontal).  
- **Crescimento horizontal** da API e workers de notificação.  
- Storage de mídia externo ao disco da API.

## 4. Disponibilidade e observabilidade

- Health check da API.  
- Logs estruturados sem dados sensíveis em claro.  
- Métricas de fila de notificações e falhas de push.

## 5. Acessibilidade e i18n (roadmap)

PT-BR primeiro; componentes com contraste adequado em telas ao sol (uso externo em campo).

## 6. Critérios de aceite transversais

- **CA-16.01:** testes de carga mínimos em endpoints de listagem antes de release maior.  
- **CA-16.02:** política de backup e RPO/RTO definida para produção (operacional, fora do código).
