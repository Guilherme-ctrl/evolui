# Prompt SDD — Implementação do Doc 22 (melhorias UX derivadas do Doc 21)

Documento autocontido para orientar implementação pelo plano em [22-plano-implementacao-doc21.md](../22-plano-implementacao-doc21.md). Uso: colar em agente de código, issue épica ou briefing técnico.

---

## 1. Papel e missão

Você é **engenheiro de software sênior** em um monorepo **NestJS + Prisma + PostgreSQL** (backend) e **React + Vite** (frontend), produto **SaaS multi-tenant para escolinhas**.

**Missão:** executar o plano descrito em [22-plano-implementacao-doc21.md](../22-plano-implementacao-doc21.md), que materializa as diretrizes de [21-opinioes-melhoria-ux-po.md](../21-opinioes-melhoria-ux-po.md), **sem** substituir rotinas (ROT) nem critérios de aceite (CA) já definidos em `Docs/`. Cada entrega deve **manter regressão verde** nos testes e critérios existentes.

**Objetivo adicional do plano (Doc 22 §1):** **Home como hub útil por papel** — não só lista de links; responde a “o que fazer agora?” e “o que mudou?” com blocos escaneáveis e **RN-000** respeitado no modo campo.

---

## 2. Regras não negociáveis

- **RN-000** ([00-visao-e-objetivos.md](../00-visao-e-objetivos.md)): o sistema **não pode aumentar o trabalho operacional dos treinadores**. Antes de qualquer item que afete fluxo de campo, validar impacto em tempo/toques; preferir melhorias para **ADMIN** e **RESPONSÁVEL** quando houver tensão com o treinador.
- **Privacidade em previews:** **CA-03.02** — notificações in-app (e, no futuro, outros canais) não devem expor em **preview** observações médicas ou texto livre sensível; ver entrega **A5** e alinhamento com Doc 21 §4.5 (**A5** alimenta o bloco de notificações na Home do responsável).
- **Design e acessibilidade:** seguir tokens e padrões em [19-design-system-brand-guide.md](../19-design-system-brand-guide.md); onde o plano pede (ex. **C1**), alvos tocáveis ≥ 44px, foco visível, contraste adequado em fluxos críticos (presença, avaliação em lote, confirmações financeiras).
- **Estado do código:** alinhar expectativas com [20-estado-implementacao-mvp.md](../20-estado-implementacao-mvp.md) (módulos já existentes, lacunas como push/e-mail).

---

## 3. Fontes de verdade (leitura obrigatória por epic)

| Tema | Documento |
|------|-----------|
| Plano de entregas e critérios de pronto | [22-plano-implementacao-doc21.md](../22-plano-implementacao-doc21.md) — incluir **§2.0** (Home) |
| Intenção de produto / UX | [21-opinioes-melhoria-ux-po.md](../21-opinioes-melhoria-ux-po.md) |
| ROT / CA / índice | [18-indice-rotinas-e-aceite.md](../18-indice-rotinas-e-aceite.md) |
| Visão e RN-000 | [00-visao-e-objetivos.md](../00-visao-e-objetivos.md) |

---

## 4. Home por papel (Doc 22 §2.0) — escopo **A0**

**Problema:** `Home.tsx` hoje é sobretudo saudação + card “Atalhos” com links — baixa utilidade, duplica o menu sem contexto.

**Direção:** primeira tela após login com blocos **por papel**; **no máximo 5–7 itens** visíveis above the fold no mobile; resto em “Ver tudo”. **Não** recriar o menu inteiro na Home.

| Papel | Conteúdo mínimo |
|-------|-----------------|
| **ADMIN** | Cartões com resumo operacional (reutilizar `/dashboard` onde couber): alunos ativos, inadimplência; opcional alertas; bloco **Hoje / esta semana** (eventos ou link ao calendário filtrado); **1–3 ações sugeridas** (CTAs secundários: comunicado, inadimplência, relatório — sem lista longa de módulos). |
| **TREINADOR** | **Treinos de hoje** (turma + horário + evento se a API permitir) com CTA primário **“Abrir presença”** (deep link com turma/evento quando possível); próximos eventos da semana; comunicação só como atalho **terciário**. **Sem** KPIs financeiros. |
| **RESPONSAVEL** | **“O que precisa da sua atenção”:** não lidos (avisos/comunicações + notificações in-app); **próximo treino/evento** por filho ou agregado; atalho a extrato/financeiro se houver pendência. Unir **estado** + **próximo passo** (Doc 21 §4.1). |

**Implementação sugerida:** `HomeAdmin` / `HomeCoach` / `HomeGuardian` (ou seções condicionais); dados por composição de endpoints existentes ou **`GET /portal/summary`** (read-only) se evitar N+1 pesado. **Não** bloquear ship por summary perfeito: primeira versão pode usar 2–3 `apiFetch` paralelos com skeleton/erro.

**Critério de pronto global (§2.0):** em teste rápido por papel, o usuário descreve **em uma frase** para que serve a Home além de “lista de links”; **pelo menos um bloco mostra dado ao vivo** (número, data ou item não lido), não só navegação. Zero telas que sejam só lista de links sem contexto.

---

## 5. Escopo por fase (IDs)

Implementar por **IDs** do Doc 22; onde o plano marcar **API opcional**, a primeira iteração pode ser **só frontend** desde que a **limitação** seja **documentada** em comentário de PR ou nota mínima no Doc 20 se o time assim convencionar.

### Fase A (alta prioridade)

- **A0:** **Refazer Home por papel** conforme §4 deste prompt e Doc 22 §2.0; remover dependência de utilidade só em “Atalhos”.
- **A1:** Modo de presença (presentes vs. ausências) **explícito e persistente** (preferência por usuário ou turma); restaurar ao abrir sessão; evitar inferência silenciosa.
- **A2:** **Empty states** claros em presença e mídia: pré-condição em linguagem simples + CTA (ex. calendário, criar evento).
- **A3:** **Erro + retry** visível em upload de mídia e finalização de presença; revisar idempotência/contratos de API onde necessário.
- **A4:** **Narrativa única para responsável (v1):** blocos na **Home (A0)** com copy unificada (“Avisos”, “Notificações”, “Próximos treinos”) + deep links; evitar três silos sem contexto. **v1** = copy + deep links; não obrigar timeline unificada no backend.
- **A5:** **Previews seguros** no centro de notificações: título/categoria + nome do aluno quando couber; **sem** corpo sensível no item da lista; ajustar `notifications.service` e **todos** os emissores.
- **A6:** **Instrumentação CA-07.01:** eventos (client ou server) para jornada “sessão aberta → fechada” e ações principais; documentar nomes de evento + baseline pós-release.

**Dependências (Doc 22):** **A0** beneficia de **A5** para o bloco de notificações do responsável; pode ser entregue em iterações (primeiro ADMIN/TREINADOR, depois RESPONSAVEL com contagens). **A1** pode preceder **A6**. **A5** exige revisão de todos os pontos de emissão de notificação.

### Fase B (média prioridade)

- **B1:** Checklist na ficha do aluno (ADMIN): RN-103, turma, contato para convite; estados ok/pendente.
- **B2:** **Absorvido por A0** — treinos de hoje + CTA presença; se faltar dado (ex. “sessões em rascunho”), **estender A0** com endpoint de sessões abertas. **Não** duplicar segunda “home”; treinador sem KPIs financeiros.
- **B3:** Agrupamento de notificações in-app para responsável por **filho + dia** (pode reforçar card na Home responsável).
- **B4:** Tooltips “Como calculamos” nos KPIs de retenção / métricas do dashboard admin (**CA-13.02**); texto alinhado à fórmula real no código.
- **B5:** Marcação lida/arquivar na inbox do responsável (**ROT-COM-04**) se a UI ainda não estiver completa.
- **B6:** Agendamento de comunicado (ADMIN) com **fuso horário explícito** na UI; `scheduledAt` coerente (UTC + timezone do tenant ou seletor IANA); confirmação em horário local.

### Fase C (contínua / qualidade)

- **C1–C7:** conforme tabelas do Doc 22 (a11y, avaliação em lote com progresso, diff em notificação de calendário, relatórios, mídia, financeiro responsável, inadimplência admin auditável **somente ADMIN**).

### Fase D (estratégica)

- Executar apenas quando dependências existirem (canais externos, ADR offline, etc.); não bloquear A–C.

---

## 6. Ordem sugerida de execução (Doc 22 §3)

1. **Sprint 1 (prioridade):** **A0** fatiado — **ADMIN + TREINADOR** primeiro; em seguida **RESPONSAVEL** com blocos de atenção + **A4**.
2. **Sprints 1–2:** **A2**, **A3**, **A5** (A5 alimenta o card de notificações na Home).
3. **Sprints 2–3:** **A1**, **A6** (presença).
4. **Sprints 3–4:** **B3** (agrupamento in-app).
5. **Em paralelo (thin slices):** **B1**, **B4**, **C2**.
6. **Após estabilizar:** **B5**, **B6**, bloco **C** (C1–C7 conforme capacidade). **B2** não é sprint separado — evolução dentro de **A0**.
7. **Roadmap:** Fase **D** alinhada ao Doc 20.

Ajustar duração ao time; itens “opcional API” podem ser FE-first com débito explícito.

---

## 7. Critérios de pronto (globais)

- **Funcional:** cada ID atende ao “Critério de pronto (resumo)” da tabela correspondente no Doc 22; **A0** atende ao critério global §2.0 do Doc 22.
- **Regressão:** após mudanças em notificações e presença, rodar **`backend/test/*`** (E2E existentes).
- **Novos casos:** E2E ou roteiro manual para: **Home por papel** (dado vivo + CTA); troca de modo de presença; preview de notificação sem dado sensível; checklist do aluno (quando B1 existir).
- **Acessibilidade:** smoke teclado + leitor nas telas tocadas por A1/C1.
- **Métricas (A6):** validar nomes e payload dos eventos em staging antes de produção.

---

## 8. Riscos e mitigação (obrigatório considerar no desenho)

| Risco | Mitigação |
|-------|-----------|
| Preferência de presença só em `localStorage` (A1) | Documentar; evoluir para servidor se necessário. |
| Agregador / blocos na Home (A4) viram segunda fonte da verdade | Apenas leitura + links para módulos canônicos. |
| Home vira página pesada (muitos widgets) | Limitar blocos Doc 22 §2.0; lazy load e “Ver tudo” para listas. |
| Previews muito genéricos (A5) | “Ver detalhes” na tela com escopo já autorizado. |
| C7 | Só com permissão ADMIN + auditoria obrigatória. |

---

## 9. Entregáveis do trabalho

- Código em `backend/` e/ou `frontend/` seguindo padrões do repositório.
- PRs **pequenos e revisáveis** por ID ou grupo coerente (ex. A5 só notificações; fatias de A0 por papel).
- Onde houver instrumentação ou contrato novo: **lista de eventos** ou documentação mínima para operação (acompanhamento Doc 22 §6 junto aos Docs 20/21).

---

## 10. Início imediato (atualizado ao estado do repositório)

1. **A0:** revisar e fechar gaps — `Home.tsx` já delega a `HomeAdmin` / `HomeCoach` / `HomeGuardian`; confirmar critério global Doc 22 §2.0 (dado vivo + CTAs + RN-000), mobile e acessibilidade. Opcional: `GET /portal/summary` se o número de requests no cliente justificar.
2. **Qualidade:** manter `npm run lint` verde no `frontend/` em CI; regressões de hooks — ver [plano-limpeza-padronizacao-codigo.md](plano-limpeza-padronizacao-codigo.md).
3. **Próximas entregas Doc 22:** **A1–A6** e fases B/C conforme prioridade em Doc 22 §3 — em paralelo **A2**, **A3**, **A5** continuam sendo quick wins (presença, mídia, `notifications.service` + emissores).
4. **Não** expandir escopo além do Doc 22 sem decisão explícita de produto.

---

*Prompt SDD alinhado ao documento 22 — plano de implementação derivado do Doc 21.*
