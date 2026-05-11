# Guia de marca e Campo Design System — Evolui (SaaS para escolinhas de futebol)

**Evolui** é o nome comercial do produto. **Campo Design System** é o sistema visual e de componentes: tokens CSS, padrões de layout, biblioteca de UI e identidade de marca (logo). Este documento é a **fonte de verdade** para alinhar implementação em `frontend/src/index.css`, componentes em `frontend/src/components/` e comportamentos às specs [**00 — Visão**](./00-visao-e-objetivos.md), [**16 — RNF**](./16-requisitos-nao-funcionais.md) e [**18 — Rotinas e aceite**](./18-indice-rotinas-e-aceite.md).

**Contexto de mercado, benchmark e plano faseado:** [23-design-system-brand-benchmark-mercado.md](./23-design-system-brand-benchmark-mercado.md)  
**Índice geral:** [README.md](./README.md)

---

## 1. Contexto do produto (síntese)

### Problema

Escolinhas de futebol dispersam operação, comunicação com pais e acompanhamento do atleta entre planilhas, grupos de mensagem e papel. Isso reduz **confiança percebida**, aumenta retrabalho e dificulta mostrar **evolução** de forma consistente.

### Solução (MVP)

SaaS **multi-tenant** que centraliza cadastro, turmas, calendário, **presença rápida**, **avaliações rápidas**, comunicação, mídia, relatórios para responsáveis e finanças básicas — sem virar ERP pesado (ver [00](./00-visao-e-objetivos.md)).

### Duas experiências distintas (obrigatório refletir no design)

| Modo | Usuário | Contexto de uso | Estado emocional |
|------|---------|-----------------|------------------|
| **Operacional** | ADMIN, TREINADOR (gestão) | Desktop/tablet, cadastros, calendário, financeiro, comunicados | Produtividade, escaneabilidade, confiança nos dados |
| **Campo e portal** | TREINADOR (sessão), RESPONSÁVEL | Celular: presença/avaliação em poucos toques; pais vendo evolução e avisos | Foco, baixa carga cognitiva, feedback imediato; tom positivo para pais |

**Regra de ouro (RN-000):** o sistema **não** pode aumentar o trabalho do treinador no dia a dia; telas de campo devem priorizar velocidade e alvos grandes ([07](./07-modulo-presenca.md), [08](./08-modulo-avaliacoes.md), [16](./16-requisitos-nao-funcionais.md)).

---

## 2. Benchmark (resumo)

Referências qualitativas e posicionamento visual ampliados estão em [23 §4](./23-design-system-brand-benchmark-mercado.md). Em síntese: **densidade controlada** no operacional, **fluxo linear** para responsáveis, controles amplos no campo (inspiração Strong/Hevy), **semântica de estado** tipo Strava para financeiro e presença; evitar estética terminal ou verde neon como único idioma de CTA.

---

## 3. Princípios de UX (não negociáveis)

1. **Progressão clara** — o usuário sabe onde está e o próximo passo.  
2. **Confiança nos dados** — datas, presença e valores alinhados ao backend (UTC no banco, timezone na UI).  
3. **Acessibilidade mínima** — contraste WCAG AA onde possível; foco visível; alvos ≥ 44×44 px em fluxos mobile críticos.  
4. **Feedback de sistema** — loading, erro com retry, sucesso discreto; nunca falha silenciosa.  
5. **Respeito ao contexto** — operacional: mais informação por tela; campo/portal: menos texto, mais ação.  
6. **Proteção de dados sensíveis** — saúde do aluno e mensagens não vazam em notificações indevidas ([03](./03-multi-tenant-e-lgpd.md), CA-03.02).

---

## 4. Marca e logo

### 4.1 Conceito

O símbolo (**marca**) é um **monograma em E** (primeira letra de *Evolui*): traços arredondados em **branco gelo** (`text-primary`), com **arco ascendente** e **ponto** em **`accent-primary`** (`#22c55e`) saindo do braço médio — leitura de **evolução**, **progresso** e **direção**, sem bola, mascote ou caixa vazia genérica. No favicon, o mesmo E aparece sobre fundo `#0c0e11`.

**Grafia da marca:** sempre **Evolui** (nome próprio; não confundir com a conjugação verbal *evolui*).

### 4.2 Nome e wordmark

- **Nome do produto (UI):** *Evolui* — exibido no login, wordmarks e no cabeçalho autenticado; o **nome da escolinha** (`tenantName`) aparece como contexto (**Evolui · {tenant}**). A aba do navegador: `Evolui — {tenant}` quando logado; `Entrar · Evolui` na tela de login.  
- **Tipografia do wordmark:** **Inter** bold (~19 px no SVG), alinhada ao peso de destaque da UI.

### 4.3 Arquivos canônicos (implementação)

Todos em `frontend/public/brand/` (servidos em `/brand/…`):

| Arquivo | Uso |
|---------|-----|
| `logo-mark.svg` | Símbolo isolado; header autenticado, ícones grandes, referências em doc. |
| `logo-wordmark-on-dark.svg` | Wordmark para fundo **escuro** (login, e-mails escuros, slides). |
| `logo-wordmark-on-light.svg` | Wordmark para fundo **claro** (PDF, papel, landing clara). |
| `favicon.svg` | Aba do navegador; fundo `#0c0e11` + monograma E (branco + arco verde). |

**HTML:** `index.html` referencia `<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />`.

### 4.4 Regras de uso

- **Área de respiro:** margem livre ≥ metade da altura do símbolo ao redor da marca.  
- **Tamanho mínimo digital:** símbolo **24×24 px** no header; abaixo disso usar apenas favicon ou marca simplificada.  
- **Não fazer:** distorcer proporções; contorno neon no logo; usar o verde do símbolo como preenchimento do wordmark.  
- **Contraste:** em fundo escuro, texto do wordmark `#f0f3f7` (alinhado a `text-primary`); em fundo claro, texto `#0c0e11` (`bg-base`).

### 4.5 Direção de voz e personalidade

- **Personalidade:** direta, acolhedora com pais, profissional com equipe; motivadora sem infantilizar atletas.  
- **Tom de voz (UI):** frases curtas; verbos de ação (“Registrar presença”, “Publicar relatório”, “Ver calendário”).  
- **Para responsáveis:** tom positivo e transparente; evitar comparações negativas entre crianças ([09](./09-modulo-relatorios-pais.md)).

---

## 5. Tokens (fundação)

**Implementação:** `:root` em `frontend/src/index.css`. Manter **nomes** estáveis ao refinar valores.

### 5.1 Cor

| Token | Uso | Valor (referência atual) |
|-------|-----|--------------------------|
| `bg-base` | Fundo principal da aplicação | `#0c0e11` |
| `bg-elevated` | Cards, header, painéis | `#141820` |
| `bg-muted` | Hover de lista, fundo suave | `#1a2029` |
| `border-subtle` | Bordas | `#252d38` |
| `text-primary` | Texto principal | `#f0f3f7` |
| `text-secondary` | Metadados, nav inativa | `#8b96a8` |
| `accent-primary` | CTA principal, progresso, nav ativa | `#22c55e` |
| `accent-primary-hover` | Hover do CTA primário | `#16a34a` |
| `accent-primary-muted` | Fundo de destaque suave | `rgba(34, 197, 94, 0.15)` |
| `accent-secondary` | Links, foco de campo | `#06b6d4` |
| `accent-secondary-hover` | Hover de links | `#0891b2` |
| `state-success` | Presente, pago, ok | `#34d399` (+ muted em CSS) |
| `state-warning` | Atenção, lembrete | `#fbbf24` (+ muted) |
| `state-danger` | Erro, inadimplência grave | `#f87171` (+ muted) |
| `state-info` | Informativo | `#38bdf8` (+ muted) |

**Regra:** o verde evoca **campo e ação primária**, mas estados (sucesso/alerta/erro) têm **semântica própria**; não usar apenas “verde = clicável”.

### 5.2 Tipografia

- **Família:** **Inter** (400 / 600 / 700), com `system-ui` como fallback (`index.html` carrega Google Fonts).  
- **Escala CSS:** `--text-xs` … `--text-2xl` (12–32 px equivalentes).  
- **Pesos:** `--font-weight-body` 400; `--font-weight-semibold` 600 (títulos, botões, nav); `--font-weight-strong` 700 (destaque numérico em campo).  
- **Números:** classe `.tabular-nums` para contagens, valores e métricas.

### 5.3 Espaçamento e layout

- **Grid:** múltiplos de **4 px** (`--space-1` … `--space-8`).  
- **Largura máxima:** `--page-max-operational` 1200 px; `--page-max-portal` `min(36rem, 100% - 2rem)` em `.field-mode .page`.  
- **Login / fluxos estreitos:** `.page--narrow` (max-width 22 rem).  
- **Safe area:** padding da `.page` respeita `env(safe-area-inset-*)`.

### 5.4 Raio, sombra, foco e movimento

- **Raios:** `--radius-input` 8 px; `--radius-card` 12 px; `--radius-card-lg` 16 px; `--radius-pill` 9999 px.  
- **Sombras:** `--shadow-card`, `--shadow-header` (definidos em CSS).  
- **Foco:** `--focus-ring` (anel duplo base + `accent-secondary`).  
- **Duração:** `--duration-fast` 150 ms; `--duration-ui` 180 ms; easing `--ease-out`.

---

## 6. Biblioteca de componentes

### 6.1 Primitivos globais (CSS)

| Padrão | Classes / seletores | Notas |
|--------|---------------------|--------|
| **Botão** | `.btn` + `.btn-primary` \| `.btn-secondary` \| `.btn-ghost` \| `.btn-danger`; `.btn-block` | `min-height: 44px`; foco com `--focus-ring`. |
| **Campos** | `input`, `select`, `textarea` (exceto checkbox/radio) | Fundo `bg-base`, borda `border-subtle`, foco ciano. |
| **Label + stack** | `label.stack` + `.muted` ou `.field-label` | Padrão de formulário (ex.: [Login.tsx](../frontend/src/pages/Login.tsx)). |
| **Card** | `.card`, `.card--lg`, `.card--interactive`, `.card--list`, `.card-list-item` | Painéis e listas densas. |
| **Badge** | `.badge`, `.badge--neutral`, `--ok`, `--warning`, `--danger`, `--info` | Estados semânticos. |
| **Navegação** | `.nav-link`, `.nav-link--active` | `min-height: 44px` no app shell. |
| **Cabeçalho de página** | `.page-header`, `__title`, `__subtitle`, `--tight` | Título + subtítulo + ações. |
| **Campo (presença / avaliação)** | `.field-check`, `.field-check--state`, `.btn-field-cta` | Toques amplos em modo campo. |
| **Utilitários** | `.stack`, `.muted`, `.tabular-nums`, `.page`, `.page--narrow` | Layout e tipografia. |

### 6.2 Componentes React (implementados)

| Componente | Arquivo | Variantes / API resumida |
|------------|---------|---------------------------|
| **Banner** | `frontend/src/components/Banner.tsx` | `variant`: `info` \| `warning` \| `danger`; `onDismiss` opcional; roles `status` / `alert`. |
| **Modal** | `frontend/src/components/Modal.tsx` | Portal, foco preso, Tab trap, Escape e backdrop configuráveis. |
| **ConfirmDialog** | `frontend/src/components/ConfirmDialog.tsx` | Confirmação sobre `Modal`; `danger`, `busy`, `prompt` opcional. |
| **ToastProvider / useToast** | `frontend/src/components/ToastProvider.tsx`, `useToast.ts` | Toasts empilhados (`.toast-stack`, `.toast--success` etc.). |
| **ProgressBar** | `frontend/src/components/ProgressBar.tsx` | Metas e períodos (dashboard / turma). |
| **EvolutionList** | `frontend/src/components/EvolutionList.tsx` | Lista de evolução no portal. |

**Estilos associados:** `.banner`, `.toast*`, `.ds-modal*` em `index.css`.

### 6.3 Shell e marca

| Elemento | Implementação |
|----------|----------------|
| **App shell** | `frontend/src/layout/AppLayout.tsx` — header fixo, nav por papel, `.app-brand` com **link para `/`**, ícone `logo-mark.svg` + **Evolui ·** `tenantName` + `document.title` `Evolui — {tenant}`. |
| **Login** | `frontend/src/pages/Login.tsx` — wordmark *Evolui* (`logo-wordmark-on-dark.svg`), formulário em `.card.card--lg`. |

### 6.4 Componentes ainda sem arquivo dedicado

Padrões usados inline nas páginas que podem evoluir para componente compartilhado:

- **DataTable / ListRow** — tabelas e linhas em Financeiro, Turmas, Alunos (reutilizar classes de card/lista).  
- **EmptyState** — mensagem + CTA único quando lista vazia.  
- **Drawer** — não implementado; usar `Modal` até haver necessidade mobile específica.

---

## 7. Padrões de interação

- **Navegação operacional:** header + abas/rotas em `.app-nav`; item ativo com fundo `accent-primary-muted`.  
- **Navegação portal:** poucos itens; priorizar filho → avisos → mídia ([21](./21-opinioes-melhoria-ux-po.md)).  
- **Formulários longos:** seções com títulos; feedback após salvar.  
- **Destructivo:** `ConfirmDialog` com `danger` + `btn-danger` para reversões e exclusões críticas.  
- **Permissões:** não exibir ações que o papel não pode executar ([02](./02-papeis-e-permissoes.md)).

---

## 8. Acessibilidade (checklist)

- Contraste corpo ≥ **4.5:1** onde aplicável.  
- **Foco visível** em links, botões e nav (`.app-brand:focus-visible`).  
- **Labels** reais em formulários; erros com `aria-describedby` / `aria-invalid` quando aplicável.  
- **Ícones** decorativos: `alt=""` e `aria-hidden` em `<img>`; ícones com significado exigem texto visível ou `aria-label`.  
- **Modal:** foco inicial e ciclo Tab dentro do painel.

---

## 9. Íconografia e ilustração

- Preferir um set **outline** consistente (ex.: Lucide), sem misturar filled sem critério.  
- Empty states: ilustração **flat geométrica** opcional, alinhada a clube / escola esportiva.

---

## 10. Conteúdo e microcopy

- **Operacional:** linguagem de gestão (“Inadimplência”, “Sessão de presença”, “Publicar comunicado”).  
- **Responsável:** linguagem de acompanhamento (“Evolução”, “Próximo treino”, “Mensagem da escolinha”).  
- **Campo:** mensagens mínimas; confirmação rápida (“Presença salva”).  
- **Erros:** mensagem humana; detalhe técnico só em log (“Não foi possível salvar. Tente novamente.”).

---

## 11. Métricas de sucesso de design

- Tempo para **registro de presença** de uma turma ([07](./07-modulo-presenca.md)).  
- Tempo para **avaliação rápida** em lote ([08](./08-modulo-avaliacoes.md)).  
- Responsável entende **calendário** e **status financeiro** sem suporte.  
- Qualitativo: “parece profissional”, “confio nas informações” ([00](./00-visao-e-objetivos.md)).

---

## 12. Documentação relacionada

- [00-visao-e-objetivos.md](./00-visao-e-objetivos.md)  
- [02-papeis-e-permissoes.md](./02-papeis-e-permissoes.md)  
- [03-multi-tenant-e-lgpd.md](./03-multi-tenant-e-lgpd.md)  
- [16-requisitos-nao-funcionais.md](./16-requisitos-nao-funcionais.md)  
- [17-arquitetura-e-stack-sugerida.md](./17-arquitetura-e-stack-sugerida.md)  
- [18-indice-rotinas-e-aceite.md](./18-indice-rotinas-e-aceite.md)  
- [21-opinioes-melhoria-ux-po.md](./21-opinioes-melhoria-ux-po.md)  
- [23-design-system-brand-benchmark-mercado.md](./23-design-system-brand-benchmark-mercado.md)

---

*Campo Design System — alinhado ao código do monorepo; atualizar tabela de tokens se `:root` em `index.css` mudar.*
