# 22 — Plano de implementação (derivado do Doc 21)

Plano técnico e de produto para executar as diretrizes de [21-opinioes-melhoria-ux-po.md](21-opinioes-melhoria-ux-po.md), respeitando [00-visao-e-objetivos.md](00-visao-e-objetivos.md) (RN-000), [18-indice-rotinas-e-aceite.md](18-indice-rotinas-e-aceite.md) e o estado atual em [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md).

**Escopo:** prioriza melhorias de **experiência e coesão**; não substitui ROT/CA existentes — cada entrega deve continuar passando nos testes e critérios já documentados.

### 1.0 Estado no repositório (snapshot)

| ID Doc 22 | Situação (alto nível) |
|-----------|------------------------|
| **A0** Home por papel | **Grande parte entregue** — `frontend/src/pages/Home.tsx` + `home/HomeAdmin.tsx`, `HomeCoach.tsx`, `HomeGuardian.tsx` com dados ao vivo (dashboard, eventos, inbox, notificações, pendências financeiras). Validar em QA o critério global da §2.0 (utilidade percebida, limite de blocos no mobile). |
| **A1–A6**, **B–D** | Em fila; marcar como concluídos apenas após revisão de código e ROT/CA. |
| Higiene front | ESLint do frontend revisado (maio/2026) — ver [exec/plano-limpeza-padronizacao-codigo.md](exec/plano-limpeza-padronizacao-codigo.md). |

---

## 1. Objetivos do plano

| Objetivo | Referência Doc 21 |
|----------|-------------------|
| Reduzir ambiguidade e silos entre calendário, inbox e notificações (responsável) | §4.1, §5.9, prioridade alta §7 |
| Tornar presença e avaliação mais previsíveis e resilientes em campo | §5.2, §5.3, §6 |
| Orientar cadastro (checklist) sem virar burocracia para o ADMIN | §4.2 |
| Reforçar confiança: cópias, previews seguros, transparência de KPIs | §4.5, §5.4, §5.8 |
| Instrumentar para não degradar CA-07.01 ao longo do tempo | §5.2, §8 |
| **Home como hub útil por papel** (não só lista de links) | Doc 21 §3–4; A0 em grande parte no código — validar §2.0 |

**Filtro obrigatório:** antes de incluir qualquer item novo na fila do treinador em campo, validar contra **RN-000** (Doc 21 §1, §3).

---

## 2.0 Refazer a Home (`frontend/src/pages/Home.tsx`)

**Problema original:** a Home era sobretudo **saudação + atalhos** — baixa utilidade percebida.

**Situação atual (código):** a rota `/` já usa componentes por papel com **dados ao vivo** (ver `HomeAdmin` / `HomeCoach` / `HomeGuardian`). Manter esta seção como **checklist de produto**: afinar copy, limitar widgets, deep links para presença e critério global da §2.0 até estar validado em QA.

**Direção de produto:** a Home continua sendo o **primeiro contato útil** após o login, com blocos **escaneáveis** por papel, alinhados ao Doc 21 (próxima ação, coesão calendário/comunicação/notificações, RN-000 no modo campo).

| Papel | Conteúdo mínimo da nova Home (substitui ou reduz “Atalhos”) |
|-------|----------------------------------------------------------------|
| **ADMIN** | Resumo operacional em **cartões** (reutilizar dados de `/dashboard` onde fizer sentido): alunos ativos, inadimplência (valor ou contagem), opcional “alertas” (ex.: turmas no limite). Bloco **“Hoje / esta semana”** com próximos eventos do tenant ou link direto ao calendário filtrado. **Ações sugeridas** (1–3): ex. “Enviar comunicado”, “Ver inadimplência”, “Publicar relatório” — só como CTA secundário, não como lista longa de todos os módulos. |
| **TREINADOR** | Foco **campo + RN-000:** **Treinos de hoje** (turma + horário + evento, se a API permitir) com CTA primário **“Abrir presença”** (deep link com turma/evento quando possível). Lista curta de **próximos eventos** da semana. Comunicação como atalho **terciário** — não competir com presença. Sem KPIs financeiros. |
| **RESPONSAVEL** | **“O que precisa da sua atenção”:** contagem ou lista curta de não lidos (avisos/comunicações + notificações in-app), **próximo treino/evento** por filho (ou agregado), atalho para **extrato/financeiro** se houver pendência (quando dados existirem). Reduz sensação de “só links” unindo **estado** + **próximo passo** (Doc 21 §4.1). |

**O que não fazer:** recriar o menu inteiro em forma de lista na Home; manter **no máximo 5–7 itens** visíveis “above the fold” no mobile, resto em “Ver tudo”.

**Implementação sugerida:** nova estrutura de componentes (ex.: `HomeAdmin`, `HomeCoach`, `HomeGuardian`) ou seções condicionais; dados via composição de chamadas existentes (`/dashboard`, `/turmas`, eventos/calendário, inbox/notificações) ou **`GET /portal/summary`** (read-only) se o número de requests no cliente ficar alto.

**Critério de pronto global:** em teste rápido com cada papel, o usuário consegue **nomear em uma frase** para que serve a Home além de “lista de links”; pelo menos **um bloco mostra dado ao vivo** (número, data, ou item não lido), não só navegação.

---

## 2. Fases e entregas

### Fase A — Alta prioridade (valor × risco UX)

Foco: **Home útil**, fluxos críticos, responsável com múltiplas fontes de informação, presença inequívoca.

| ID | Entrega | Doc 21 | Front | Back / dados | Critério de pronto (resumo) |
|----|---------|--------|-------|--------------|-----------------------------|
| **A0** | **Refazer Home por papel:** cartões + “hoje” + ações sugeridas (ADMIN); treinos de hoje + CTA presença (TREINADOR); atenção + próximos eventos + financeiro pendente se aplicável (RESPONSAVEL). Remover dependência da utilidade em lista única de “Atalhos”. | §2.0 acima, §3–4 | `Home.tsx` + subcomponentes; possível `GET /portal/summary` ou múltiplos fetches | Agregar ou estender endpoints de leitura existentes; evitar N+1 pesado | Critério global §2.0; zero telas que sejam só lista de links sem dado contextual |
| A1 | **Modo de presença explícito e persistente** (presentes vs. ausências): preferência por usuário ou por turma, restaurada ao abrir sessão | §5.2 | Tela de presença + persistência (localStorage ou preferência no servidor) | Opcional: endpoint `PATCH /users/me/preferences` ou campo em perfil; se só FE, documentar limitação multi-dispositivo | Treinador vê modo atual antes de marcar lista; troca de modo é intencional, não inferida |
| A2 | **Empty states** em presença e mídia: pré-condição em linguagem clara + CTA (ex.: calendário, criar evento) | §4.3 | `Attendance`, `Midia` (ou equivalentes) | Nenhum obrigatório; opcional endpoint que indique “eventos hoje por turma” se a UI precisar | Estados vazios não são página em branco; há próximo passo |
| A3 | **Tratamento de erro + retry** reforçado em upload de mídia e finalização de presença | §6 | Fila/retry visível, mensagem de rede | Idempotência já desejável nas APIs de presença — revisar contratos | Usuário recupera de falha sem perder contexto óbvio (ou com mensagem explícita) |
| A4 | **Narrativa única para responsável (v1):** blocos na **Home** (A0) com copy unificada (“Avisos”, “Notificações”, “Próximos treinos”) + deep links; evitar duplicar três silos sem contexto | §4.1, §7 | Integrado em `Home` responsável + ajuste de labels/rotas | Coberto por A0 ou `GET /portal/summary` | Responsável vê “o que mudou” na Home, não só links soltos |
| A5 | **Pré-visualizações seguras** no centro de notificações in-app: título/categoria + nome do aluno quando aplicável; **sem** corpo de observação médica ou texto livre sensível no preview | §4.5, CA-03.02 | Lista de notificações; truncamento e templates | Ajustar `payload`/`title` gerados em `notifications.service` (e emissores) | Inspeção manual + teste: notificação ligada a saúde não vaza detalhe no list item |
| A6 | **Instrumentação CA-07.01 (MVP analítico):** eventos client-side ou server-side para “sessão aberta → fechada” e contagem de ações principais | §5.2, §8 | Hooks na tela de presença (analytics provider ou logs estruturados se já existir) | Opcional: endpoint `POST /analytics/beacon` ou uso de ferramenta externa | Documento com definição de evento + baseline após 1 release |

**Dependências:** **A0** beneficia de A5 (previews limpos) para o bloco “notificações” do responsável; pode ser entregue em iterações (primeiro ADMIN/TREINADOR, depois RESPONSAVEL com contagens). A1 pode preceder A6. A5 exige revisão de todos os pontos de emissão de notificação (calendário, financeiro, avaliação, etc.).

**Risco:** A4 pode crescer em escopo — manter **v1 como IA + copy + deep links**, não obrigatoriamente timeline unificada no backend. **A0:** não bloquear ship por “summary” perfeito — primeira versão pode usar 2–3 `apiFetch` paralelos com skeleton/erro.

---

### Fase B — Média prioridade

Foco: onboarding, treinador fora do ERP, admin informado, inbox utilizável.

| ID | Entrega | Doc 21 | Front | Back | Critério de pronto (resumo) |
|----|---------|--------|-------|------|-----------------------------|
| B1 | **Checklist na ficha do aluno** (ADMIN): itens RN-103, turma, contato para convite; estados “ok / pendente” | §4.2 | `StudentDetail` ou formulário | Opcional: campos calculados via API `GET /students/:id/completeness` | ADMIN vê o que falta sem adivinhar regras de negócio |
| B2 | **Mini-dashboard treinador** | §3, §5.8 | **Absorvido por A0** (treinos de hoje + CTA presença). Se faltar dado (“sessões em rascunho”), estender A0 com endpoint de sessões abertas | Calendário + presença | Não duplicar segunda “home”; treinador não acessa KPIs financeiros do doc 13 |
| B3 | **Agrupamento de notificações in-app** para responsável: por **filho + dia** (colapsar itens similares) | §5.9 | Centro de notificações | Opcional: chave de agrupamento na query ou pós-processamento no cliente | Lista legível para família com 2+ filhos |
| B4 | **Tooltips “Como calculamos”** nos KPIs de retenção e métricas do dashboard admin | §5.8, CA-13.02 | `Dashboard` admin | Texto alinhado à fórmula no código (Doc 20 §4) | Tooltip coincide com implementação |
| B5 | **Marcação lida / arquivar** na inbox do responsável (ROT-COM-04) se ainda não estiver completa na UI | §5.5 | `Comunicacoes`, `Avisos` | Endpoints existentes ou `PATCH` em thread/mensagem | Histórico não é lista infinita sem controle |
| B6 | **Agendamento de comunicado (ADMIN)** com **fuso horário explícito** na UI | §5.5 | Form de envio | Campo `scheduledAt` em UTC + timezone do tenant ou seletor IANA | Confirmação mostra horário local correto |

**Dependências:** B6 pode exigir decisão de produto: timezone por tenant vs. por usuário (documentar em `03` ou ADR curto).

---

### Fase C — Contínuo / qualidade UX (paralelo às fases A–B)

| ID | Entrega | Doc 21 | Ação |
|----|---------|--------|------|
| C1 | **Acessibilidade** em presença, avaliação em lote, confirmações financeiras: alvos ≥ 44px, foco visível, contraste | §4.4 | Auditoria no `19` + ajustes CSS/componentes |
| C2 | **Avaliação em lote:** barra de progresso “n/total” + feedback de salvamento incremental | §5.3 | `Avaliacoes` |
| C3 | **Calendário:** copy de notificação com **diff** (antes/depois) quando houver alteração de horário/local | §5.1 | Templates em serviço de notificação + calendário |
| C4 | **Relatórios:** microcopy na publicação + alinhar preview admin ao portal | §5.4 | `Relatorios`, `RelatorioDetail` |
| C5 | **Mídia:** texto de ajuda sobre tag por turma vs. aluno; galeria responsável com filtro **filho** e **mês** | §5.6 | `Midia`, `Filho` |
| C6 | **Financeiro (responsável):** destaque “próximo vencimento” + visão timeline além de tabela | §5.7 | `Finance`, `Filho` |
| C7 | **Inadimplência (ADMIN):** ações secundárias auditáveis (“lembrete”, “contato registrado”) — se aprovado por produto | §5.7 | `Finance` + tabela de auditoria |

**Gate RN-000:** C7 não deve adicionar passos obrigatórios ao treinador; apenas ADMIN.

---

### Fase D — Estratégica (pós-canais externos ou infra)

| ID | Entrega | Doc 21 | Notas |
|----|---------|--------|-------|
| D1 | Push / e-mail com **previews seguros** (mesmas regras de A5) | §6, §7 | Depende Doc 14 canais |
| D2 | Link **ICS** / assinar calendário pessoal a partir de evento | §5.1 | Opcional terceiros |
| D3 | **Digest** diário in-app ou por e-mail para responsável | §5.9 | Respeitar RN-1101 |
| D4 | **Offline / fila local** para presença (CA-07.02) | §6 | Maior esforço; ADR |
| D5 | **Modo campo** (alto contraste / brilho) | §4.4 | Preferência usuário |

---

## 3. Ordem sugerida de execução (squads pequenos)

1. **Sprint 1 (prioridade):** **A0** fatiado — ADMIN + TREINADOR primeiro (maior dor “só atalhos”); RESPONSAVEL em seguida com blocos de atenção + A4.  
2. **Sprint 1–2:** A2, A3, A5 (rápidos ganhos de confiança e suporte; A5 alimenta bloco de notificações na Home).  
3. **Sprint 2–3:** A1, A6 (presença).  
4. **Sprint 3–4:** B3 (agrupamento in-app; pode reforçar card na Home responsável).  
5. **Em paralelo (thin slices):** B1, B4, C2.  
6. **Após estabilizar:** B5, B6, bloco C (C1–C7 conforme capacidade). **B2** não é sprint separado — evolução dentro de A0.  
7. **Roadmap:** Fase D alinhado a [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md) lacunas.

Ajustar duração conforme tamanho do time; itens marcados “opcional API” podem ser entregues só no frontend na primeira iteração, com débito documentado.

---

## 4. Testes e QA

| Área | Sugestão |
|------|----------|
| Regressão | Rodar E2E backend existentes (`backend/test/*`) após mudanças em notificações e presença |
| Novos casos | E2E ou testes manuais guiados para: **Home por papel** (dado vivo + CTA), troca de modo de presença, preview de notificação sem dado sensível, checklist aluno |
| Acessibilidade | Smoke com teclado + leitor em telas A1/C1 |
| Métricas | Validar nomes de eventos A6 em ambiente de staging antes de produção |

---

## 5. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Preferência de modo de presença só no localStorage (A1) | Documentar; evoluir para servidor quando houver churn de dispositivo entre treinadores |
| Agregador “Resumo” (A4) vira segunda fonte da verdade | Manter links para módulos canônicos; agregador só leitura |
| Home vira página pesada (muitos widgets) | Limitar blocos §2.0; lazy load e “Ver tudo” para listas |
| Esconder demais contexto em previews (A5) | “Ver detalhes” abre tela segura com escopo já validado |
| C7 aumenta superfície de abuso | Permissão só ADMIN + auditoria obrigatória |

---

## 6. Acompanhamento

- Revisar este plano quando [21-opinioes-melhoria-ux-po.md](21-opinioes-melhoria-ux-po.md) ou [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md) mudarem.  
- Métricas do Doc 21 §8: responsável designado no time de produto para dashboard simples (planilha ou BI) após A6.

---

*Documento 22 — plano de implementação derivado do Doc 21.*
