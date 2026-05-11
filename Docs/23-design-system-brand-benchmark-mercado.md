# 23 — Design system, marca, logo e benchmark (visão de mercado e entrega faseada)

Documento **estratégico de design** para o SaaS descrito em [00 — Visão e objetivos](00-visao-e-objetivos.md) e materializado no repositório conforme [20 — Estado da implementação](20-estado-implementacao-mvp.md). Complementa o guia operacional [19 — Design system e brand guide](19-design-system-brand-guide.md) com **contexto de mercado**, **diretrizes de logotipo**, **benchmark ampliado** e **plano de execução em fases** para time de produto, design e engenharia.

**Relação com outros docs:** regras de produto e ROT/CA continuam em `Docs/00–18`; direção UX complementar em [21](21-opinioes-melhoria-ux-po.md).

---

## Visão executiva

| Dimensão | Síntese |
|----------|---------|
| **O que é** | **Evolui** — SaaS **multi-tenant** para escolinhas de futebol: operação leve, comunicação com famílias, percepção de evolução do atleta e finanças básicas — **sem** ambição de ERP ou scout profissional ([00](00-visao-e-objetivos.md)). |
| **O que vende** | Confiança, organização, transparência e profissionalismo percebido — não “tecnologia” como fim ([00 §4](00-visao-e-objetivos.md)). |
| **Diferencial de UX** | **RN-000:** o sistema não pode aumentar o trabalho do treinador; fluxos de **campo** (presença, avaliação) são o coração competitivo. |
| **Base visual** | Paleta **escura operacional** + acentos esportivos discretos; mesma família de tokens do projeto anterior (“futPro”), recontextualizada para escolinha — já refletida em `frontend/src/index.css` e [19](19-design-system-brand-guide.md). |

---

# Fase 0 — Contexto de mercado e encaixe

## 0.1 Problema no mercado

Escolinhas e pequenos centros de formação operam com **informação fragmentada**: planilhas, grupos de mensagem, papel e memória. Isso gera:

- Retrabalho e inconsistência (presença, valores, avisos).  
- Baixa **confiança percebida** por pais e instituições parceiras.  
- Dificuldade em mostrar **evolução** de forma contínua e positiva.

## 0.2 Alternativas atuais (substitutos)

| Substituto | Limite para o posicionamento deste produto |
|------------|--------------------------------------------|
| **WhatsApp / redes** | Bom para urgência; ruim para histórico, permissões, financeiro e LGPD. |
| **Planilhas** | Flexíveis; fracas em mobile no campo, notificações e portal do responsável. |
| **ERP / sistemas de academia genéricos** | Cobrem cobrança e cadastro; pouco aderentes ao ritmo **treino ↔ família** e à simplicidade RN-000. |
| **Ferramentas de scout / performance** | Fora do anti-objetivo cultural ([00 §6](00-visao-e-objetivos.md)); outro ICP e ticket. |

## 0.3 Onde o produto se encaixa (segmentação)

- **Categoria:** software de **gestão operacional e comunicação** para **formação esportiva amadora / semi-profissional**, com foco em **futebol de base** e **multi-tenant** (várias escolinhas na mesma plataforma).  
- **Modelo:** B2B **SMB** (pequenas e médias organizações) + usuários indiretos (responsáveis).  
- **Proposta de valor central:** “A escolinha organizada que os pais sentem — sem virar burocracia para o treinador.”  
- **Não compete com:** ERP pesado, scouting, streaming, gestão de estádio ou licitações.

## 0.4 Implicações para marca e UI

- Visual deve comunicar **confiabilidade institucional** (pais, parceiros) **e** **eficiência em campo** (treinador com celular ao sol).  
- Evitar estética “gamer”, “terminal” ou **verde neon** como único idioma de interação ([19 §2.4](19-design-system-brand-guide.md)).  
- Duas **intenções de experiência** (operacional × campo/portal) podem coexistir no mesmo app; o design system deve suportar **densidade variável** sem quebrar identidade ([19 §1](19-design-system-brand-guide.md)).

**Entregáveis da Fase 0:** esta seção + validação com 2–3 stakeholders (dono de escolinha, treinador, responsável) em entrevistas curtas; ajuste de vocabulário de marketing (não substitui specs).

---

# Fase 1 — Estratégia de marca (brand)

## 1.1 Pilares de marca (derivados da visão)

| Pilar | Manifestação em produto e comunicação |
|-------|----------------------------------------|
| **Confiança** | Datas e valores alinhados ao backend; feedback de erro com retry; linguagem estável em financeiro e presença. |
| **Clareza** | Fluxos lineais para responsável; “próxima ação” para staff ([21 §3](21-opinioes-melhoria-ux-po.md)). |
| **Respeito ao tempo do treinador** | RN-000; telas de campo com poucos passos e alvos grandes ([07](07-modulo-presenca.md), [08](08-modulo-avaliacoes.md)). |
| **Acolhimento (família)** | Tom positivo; sem comparações negativas entre crianças ([09](09-modulo-relatorios-pais.md), RN-602). |
| **Profissionalismo leve** | Visual “premium operacional”, não infantilizado nem corporativo engessado. |

## 1.2 Personalidade e tom de voz

- **Personalidade:** direta, acolhedora com pais, profissional com equipe; motivadora sem infantilizar atletas ([19 §4.1](19-design-system-brand-guide.md)).  
- **Tom na UI:** frases curtas; verbos de ação (“Registrar presença”, “Publicar relatório”).  
- **Tom com responsáveis:** evolução, transparência, próximos passos — alinhado a [19 §7](19-design-system-brand-guide.md).

## 1.3 Proposição de marca (rascunho para naming comercial)

> **Evolui** — plataforma para escolinhas que organizam treinos, finanças e comunicação com famílias — com registro de presença e evolução em poucos toques, no celular ou no escritório.

(Ajustar quando o **nome comercial** definitivo existir; o repositório é agnóstico ao nome.)

**Entregáveis da Fase 1:** pilares aprovados; guia de voz de 1 página; glossário “o que dizemos / o que evitamos” para marketing e suporte.

---

# Fase 2 — Logo e sistema de identidade visual

Esta fase define **como** o logotipo deve funcionar quando produzido por designer gráfico; não substitui entrega de arquivos vetoriais (`.svg`, manual da marca).

## 2.1 Conceito criativo (brief)

- **Metáfora:** “**campo organizado**” — ordem, progressão e comunidade (turma + família), sem literalidade de bola ou gramado que remeta a apps infantis.  
- **Forma:** preferir **geometria simples** (monograma ou símbolo abstrato de trajetória / linha de progresso) compatível com favicon e app icon.  
- **Atitude:** confiança + energia contida; alinhado a “esportivo premium + operacional” ([19 §2.4](19-design-system-brand-guide.md)).

## 2.2 Paleta do logo em relação ao produto

- **Fundo escuro (padrão do app):** versão do logo em **claro** ou **monocromático** sobre `#0c0e11` / `#141820` (tokens `--bg-base`, `--bg-elevated`).  
- **Fundo claro (materiais impressos, e-mail claro):** versão em **escuro**; acento pode usar `--accent-primary` (`#22c55e` na implementação atual) ou neutro profundo para máxima seriedade institucional.  
- **Regra:** não depender de gradientes complexos no ícone principal; gradiente opcional apenas em hero de marketing.

## 2.3 Construção e proteção

- **Área de respiro:** mínimo = altura da letra capital do wordmark ou metade da altura do símbolo.  
- **Tamanho mínimo digital:** símbolo legível a ~24 px de altura; abaixo disso, usar apenas monograma ou marca tipográfica simplificada.  
- **Não fazer:** distorcer proporção; aplicar sombras pesadas no símbolo; usar o acento verde como “contorno neon” do logo.

## 2.4 Wordmark e tipografia de marca

- **Direção:** sans humanista ou neo-grotesco de alta legibilidade, coerente com **Inter** na UI ([19 §4.3](19-design-system-brand-guide.md), `index.css`).  
- **Peso sugerido:** semibold para nome; evitar condensed “esportivo” datado.

## 2.5 Favicon e ícone de app

- Forma quadrada com **símbolo centralizado**; testar em Android adaptive icon (safe zone).  
- Evitar detalhes finos que somem em 16×16 px.

**Entregáveis da Fase 2:** 2–3 propostas vetoriais; versões claro/escuro; manual de 2–4 páginas (cores, espaçamento, usos proibidos); export kit (SVG, PNG @1x/@2x, favicon).

---

# Fase 3 — Design system (tokens, componentes, acessibilidade)

## 3.1 Fonte de verdade

- **Especificação narrativa:** [19-design-system-brand-guide.md](19-design-system-brand-guide.md).  
- **Implementação atual (MVP):** variáveis CSS em `frontend/src/index.css` (comentário remete ao Doc 19).

## 3.2 Tokens implementados (referência rápida)

| Família | Tokens principais (código) |
|---------|----------------------------|
| Fundo | `--bg-base`, `--bg-elevated`, `--bg-muted` |
| Borda / texto | `--border-subtle`, `--text-primary`, `--text-secondary` |
| Acentos | `--accent-primary`, `--accent-secondary` + hovers e muted |
| Estado | `--state-success`, `--state-warning`, `--state-danger`, `--state-info` |
| Layout | `--page-max-operational`, `--page-max-portal`, espaçamento `--space-*` |
| Movimento | `--duration-fast`, `--duration-ui`, `--ease-out` |

Manter **semântica de estado** para financeiro e presença (em dia / pendente / atenção), não só cor decorativa ([19 §2.3](19-design-system-brand-guide.md)).

## 3.3 Inventário de componentes

Ver tabela em [19 §5.1](19-design-system-brand-guide.md). Prioridade de consistência para MVP:

1. Botões (primary, ghost, danger) com estados de loading.  
2. Toggle/chip para presença e avaliação rápida.  
3. Toast/banner e modal de confirmação para ações destrutivas.  
4. ListRow / tabela com hit-area adequada ([16](16-requisitos-nao-funcionais.md)).

## 3.4 Acessibilidade e “modo campo”

- Contraste **WCAG AA** onde possível; foco visível (`--focus-ring` em `index.css`).  
- Alvos **≥ 44×44 px** em fluxos mobile críticos ([19 §3](19-design-system-brand-guide.md)).  
- Evolução futura (alinhada a [21 §4.4](21-opinioes-melhoria-ux-po.md)): perfil **alto brilho / alto contraste** opcional sem trocar a marca.

**Entregáveis da Fase 3:** checklist de componentes cobertos no código; auditoria de contraste por tela crítica; Storybook ou página interna de tokens (opcional, pós-MVP).

---

# Fase 4 — Benchmark e referências (UX e mercado)

## 4.1 Benchmark de UX (como no Doc 19, expandido)

| Referência | O que observar | Lição para este produto |
|------------|----------------|-------------------------|
| **TrueCoach / CoachNow** | Relação coach ↔ cliente; histórico escaneável | Staff: densidade controlada; responsável: fluxo linear ([19 §2.1](19-design-system-brand-guide.md)). |
| **Strong / Hevy** | Controles amplos, poucos botões | Presença/avaliação com uma mão e leitura rápida ([19 §2.2](19-design-system-brand-guide.md)). |
| **Strava / apps de hábito** | Semântica de cor + linha do tempo | Estados financeiros e de frequência com significado consistente ([19 §2.3](19-design-system-brand-guide.md)). |
| **Calendários familiares (Google Calendar, etc.)** | Clareza de “próximo evento” | Calendário e mudanças de horário com diff humanizado ([21 §5.1](21-opinioes-melhoria-ux-po.md)). |
| **Produtos financeiros B2C leves** | Explicação de status, sem jargão | Inadimplência e confirmação de pagamento com linguagem estável. |

## 4.2 Benchmark de mercado (categorias adjacentes)

| Categoria | Exemplos ilustrativos | Relação |
|-----------|----------------------|---------|
| Gestão de academias / associações | Soluções genéricas de cobrança e cadastro | Competidores por **orçamento**; diferenciar pelo **domínio escolinha + RN-000**. |
| Comunicação escolar | Apps de escola / diário digital | Competidores por **expectativa de “portal do pai”**; este produto é **esporte + operação de turma**. |
| Software esportivo profissional | Scout, load management | **Anti-objetivo** explícito ([00 §6](00-visao-e-objetivos.md)). |

## 4.3 Métricas de sucesso de design (validação contínua)

Reutilizar [19 §8](19-design-system-brand-guide.md) e instrumentar:

- Tempo e toques até **sessão de presença fechada** (meta alinhada a [07](07-modulo-presenca.md)).  
- Tempo para **avaliação em lote** ([08](08-modulo-avaliacoes.md)).  
- Entendimento de **calendário e status financeiro** pelo responsável sem suporte.

**Entregáveis da Fase 4:** planilha viva de benchmark (links, screenshots, notas); revisão semestral.

---

# Fase 5 — Governança e evolução

| Atividade | Responsável sugerido | Frequência |
|-----------|----------------------|------------|
| Atualizar tokens ao mudar marca | Design + Front | A cada release visual maior |
| Revisar contraste e alvos mobile | Design / QA | A cada feature em presença/financeiro |
| Alinhar copy operacional vs. portal | Produto | A cada novo módulo de comunicação |
| Sincronizar este doc com [19](19-design-system-brand-guide.md) | Produto | Trimestral ou quando `index.css` mudar tokens globais |

---

## Documentação relacionada

- [00-visao-e-objetivos.md](00-visao-e-objetivos.md)  
- [16-requisitos-nao-funcionais.md](16-requisitos-nao-funcionais.md)  
- [19-design-system-brand-guide.md](19-design-system-brand-guide.md)  
- [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md)  
- [21-opinioes-melhoria-ux-po.md](21-opinioes-melhoria-ux-po.md)

---

# Anexos

## Anexo A — One-pager executivo (Fases 0–2)

*Uso: apresentação rápida a parceiro, investidor ou diretoria da escolinha. Nome comercial do produto: **Evolui**.*

### O problema

Escolinhas e pequenos centros de formação ainda operam com **informação espalhada** (planilhas, grupos, papel). Isso gera retrabalho, erros e **menos confiança** de pais e parceiros.

### A solução

**Evolui** — SaaS **multi-tenant** que centraliza cadastro, turmas, calendário, presença rápida, avaliações leves, comunicação, mídia, relatórios para responsáveis e finanças básicas — **sem** virar ERP nem ferramenta de scout.

### Para quem é

- **Cliente:** escolinhas, projetos sociais, academias e treinadores em modelo de contrato.  
- **Usuários:** equipe (admin/treinador) e **responsáveis** pelo atleta.

### Diferencial de produto

**O sistema não pode aumentar o trabalho do treinador (RN-000).** Presença e avaliação são **mobile-first**, em poucos toques — o restante é operação clara em desktop/tablet.

### O que a marca comunica

**Confiança + profissionalismo leve:** painel organizado para a equipe; portal acolhedor e transparente para a família. Visual **escuro operacional** com acentos esportivos discretos — credível para instituições, eficiente ao ar livre.

### Identidade (logo) — direção

Monograma **E** com **arco ascendente** e acento em verde (`accent-primary`); wordmark *Evolui*; versões para fundo **claro** e **escuro** em `frontend/public/brand/`. Manual detalhado em [19 §4](19-design-system-brand-guide.md).

### Pedido ao leitor

> Queremos parceiros que valorizem **disciplina operacional** e **experiência da família** no mesmo produto — sem prometer estatística avançada nem burocracia extra no campo.

---

## Anexo B — Checklist de aceite marca / UI

*Uso: revisão de PR, QA de tela ou critério leve de design review. Não substitui CA das specs; reforça coerência com [00](00-visao-e-objetivos.md), [19](19-design-system-brand-guide.md) e [21](21-opinioes-melhoria-ux-po.md).*

### B.1 Pilares de marca (sim / não)

| # | Pergunta | Esperado |
|---|----------|----------|
| B1.1 | A tela reforça **confiança** (dados, datas, estados claros)? | Sim |
| B1.2 | O fluxo deixa **claro o próximo passo** (especialmente responsável e treinador em campo)? | Sim |
| B1.3 | Em fluxo de **treinador no celular**, a ação principal é óbvia e com **área de toque ampla** (≥ 44 px onde crítico)? | Sim |
| B1.4 | Copy e layout **não comparam crianças negativamente** nem sugerem ranking humilhante? | Sim |
| B1.5 | O tom com **responsável** é acolhedor e transparente; o operacional não usa jargão desnecessário para pais? | Sim |

### B.2 Tokens e consistência visual

| # | Pergunta | Esperado |
|---|----------|----------|
| B2.1 | Cores de **estado** (sucesso, atenção, erro, info) seguem a semântica do design system, não “só decoração”? | Sim |
| B2.2 | **CTA primário** não depende só de verde neon agressivo; contraste legível em fundo escuro? | Sim |
| B2.3 | Tipografia e escala seguem o padrão (Inter / escala modular; `tabular-nums` em números comparáveis)? | Sim |
| B2.4 | **Modo operacional** vs. **portal/campo**: densidade adequada (mais informação no backoffice; mais foco no mobile crítico)? | Sim |

### B.3 Acessibilidade e feedback

| # | Pergunta | Esperado |
|---|----------|----------|
| B3.1 | Contraste corpo de texto **≥ WCAG AA** onde aplicável; **foco visível** em interativos? | Sim |
| B3.2 | Formulários com **label** associado; erros com mensagem humana e, quando possível, **retry**? | Sim |
| B3.3 | Loading / sucesso / erro **explícitos** — sem falha silenciosa? | Sim |

### B.4 Dados sensíveis e permissões

| # | Pergunta | Esperado |
|---|----------|----------|
| B4.1 | Pré-visualizações (notificação, lista, banner) **não expõem** observação médica ou dado sensível indevido ([03](03-multi-tenant-e-lgpd.md))? | Sim |
| B4.2 | Ações que o papel **não pode** executar não aparecem como habilitadas ([02](02-papeis-e-permissoes.md))? | Sim |

### B.5 Ações destrutivas

| # | Pergunta | Esperado |
|---|----------|----------|
| B5.1 | Desmatricular, excluir mídia, cancelar evento relevante exigem **confirmação explícita**? | Sim |

**Critério de passagem sugerido:** todas as linhas **Esperado = Sim** para merge em fluxo crítico (presença, avaliação, financeiro, comunicação a pais). Demais telas: B1 e B2 obrigatórios; B3–B5 conforme escopo da mudança.

---

*Versão alinhada ao repositório em maio/2026; marca comercial **Evolui**; evoluir com pesquisa com usuários e materiais impressos.*
