# 21 — Opiniões de melhoria: experiência do usuário e produto (PO / UX)

Documento de **análise qualitativa** com base nas specs `Docs/00–19`, no [estado da implementação](20-estado-implementacao-mvp.md), no [índice de rotinas e aceite](18-indice-rotinas-e-aceite.md) e no [guia de design system](19-design-system-brand-guide.md). Objetivo: apontar **oportunidades de UX e de produto** alinhadas à visão ([00-visao-e-objetivos.md](00-visao-e-objetivos.md)) e à regra RN-000 (não aumentar trabalho operacional do treinador).

Este arquivo **não** substitui critérios de aceite; complementa com direção de experiência e priorização sugerida.

---

## 1. Contexto sintético

- **Produto:** SaaS multi-tenant para escolinhas — organização, comunicação com pais, percepção de evolução do atleta, retenção, profissionalismo percebido.
- **Valor central vendido:** confiança, organização, evolução individual, transparência — não “tecnologia” como fim ([00](00-visao-e-objetivos.md)).
- **Três experiências distintas** (reforçadas no [19](19-design-system-brand-guide.md)): **operacional** (ADMIN), **campo** (TREINADOR em sessão), **portal familiar** (RESPONSÁVEL). Melhorias que misturam densidade de backoffice com simplicidade de campo tendem a degradar ambos os lados.

---

## 2. O que as especificações já acertam (manter como north star)

| Tema | Por que importa para UX |
|------|-------------------------|
| RN-000 + filosofia mobile-first em presença/avaliação | Evita que o produto vire fardo no treino; é diferencial competitivo explícito. |
| Dois modos de presença (presentes vs. ausências) | Reduz erro cognitivo e tempo; a spec já antecipa ambiguidade real de uso. |
| Feedback automático em avaliações + limite de comentário | Equilibra “percepção de valor para pais” com “pouco esforço do treinador”. |
| RN-602 (relatórios sem ranking humilhante / sem comparação pública negativa) | Protege marca da escolinha e bem-estar infantil; deve transparecer na **copy** e nos **layouts**, não só no motor de template. |
| Comunicação integrada ao calendário (CA-10.03) | Reduz “onde foi parar aquele aviso?” — narrativa única para a família. |
| Preferências de notificação com exceções não desligáveis (segurança / cancelamento) | Evita culpar o usuário por “não vi”; equilibra controle e duty of care. |

---

## 3. Personas implícitas e tensões de produto

| Persona | Necessidade emocional + operacional | Tensão a monitorar |
|---------|-------------------------------------|---------------------|
| **Treinador em campo** | Concluir presença/avaliação com uma mão, rápido, sem medo de errar | Toda feature nova na mesma área compete com RN-000 |
| **ADMIN** | Visão global, cadastro correto, financeiro e comunicação em massa | Risco de espelhar ERP; listas longas sem “próxima ação” geram abandono |
| **Responsável** | Tranquilidade (“meu filho está bem / evoluindo”), poucos apps para checar | Fragmentação entre avisos, notificações, calendário e financeiro |

**Opinião de PO:** tratar **“próxima ação sugerida”** por papel (ex.: treinador: “Treino hoje — abrir presença”; responsável: “Novo relatório / mensagem não lida”) como backlog de valor alto e baixo risco, desde que não polua o modo operacional do ADMIN.

---

## 4. Melhorias transversais (informação, navegação, confiança)

### 4.1 Arquitetura de informação

- **Problema provável:** muitos módulos (calendário, comunicações, avisos/inbox, notificações) podem soar redundantes para o responsável.
- **Sugestão:** definir mental model único na UI — por exemplo **“Acontecimentos”** (timeline) que agrega alteração de treino, aviso da turma e lembrete financeiro, mantendo **inbox de mensagens** para conteúdo redigido. A spec já aproxima isso (integração calendário ↔ comunicação); a melhoria é **reduzir silos visuais**, não novos domínios de dados.

### 4.2 Onboarding e cadastro (ROT-TENANT-02, ROT-ALU-01–06)

- **Convite ao responsável** está como “futuro” no doc de alunos; sem ele, o portal fica dependente de fluxo manual opaco para a família.
- **Sugestão UX:** checklist pós-criação de aluno (“falta responsável”, “falta turma”, “falta e-mail para convite”) com estado persistente na ficha — transforma RN-103 em **orientação**, não só bloqueio.

### 4.3 Estados vazios e erros

- RNF já pede feedback e retry ([16](16-requisitos-nao-funcionais.md)); para **upload de mídia** e **sessão de presença**, empty states devem explicar **pré-condição** (“não há evento de treino hoje para esta turma”) com CTA para calendário ou criação — reduz suporte.

### 4.4 Acessibilidade e uso ao sol

- Doc 16 e 19 citam contraste e alvos ≥ 44px em fluxos críticos; **priorizar** em telas de presença, avaliação em lote e confirmações financeiras. “Modo campo” pode evoluir para **brilho alto / alto contraste** opcional sem trocar identidade inteira.

### 4.5 Dados sensíveis como UX

- CA-03.02 e RN-602 exigem cuidado em **pré-visualizações** (push futuro, e-mail, centro de notificações): mostrar **tipo de alerta** + nome do filho, evitando trecho de observação médica no preview. Isso é produto + compliance unificados.

---

## 5. Por família de rotinas (opiniões objetivas)

### 5.1 Turmas e calendário (ROT-TUR-*, ROT-CAL-*)

- Alteração de horário dispara notificação (RN-301, CA-05.03); **melhoria UX:** diff humanizado na mensagem (“antes 17h → agora 18h, mesmo local”) e **uma confirmação** de leitura ou “adicionar ao calendário pessoal” (link ICS futuro) aumenta adesão dos pais sem custo para o treinador.

### 5.2 Presença (ROT-PRE-*)

- CA-07.01 (até 3 interações principais) é excelente métrica; sugerir **instrumentação** no produto (contagem de toques até “sessão fechada”) para não degradar com o tempo.
- **Modo A vs. B:** a spec permite “escolha na primeira versão ou inferir”; **opinião:** preferir **seleção explícita persistente** (toggle lembrado por turma ou por usuário) — inferência errada gera erro silencioso de frequência, muito grave para confiança.

### 5.3 Avaliações (ROT-AVA-*)

- ROT-AVA-03 (lote sem recarregar) é decisão correta; complementar com **barra de progresso** (“12/20 alunos”) e **salvamento incremental** visível reduz ansiedade de perda de dados em 4G instável.
- Para o responsável (ROT-AVA-04), **curva temporal** com anotações curtas já entrega “evolução”; evitar excesso de dimensões na configuração do tenant — muitas colunas cognitivas para o treinador violam RN-507.

### 5.4 Relatórios (ROT-REL-*)

- Função **emocional** central ([09](09-modulo-relatorios-pais.md)); **melhoria:** microcopy de publicação (“O responsável verá X, Y, Z”) e **pré-visualização** alinhada ao que o pai vê (não preview administrativo diferente do portal).
- Link compartilhável com expiração (CA-09.03): UX deve deixar claro **o que não** está no link (outros alunos, dados de saúde) para segurança psicológica e LGPD.

### 5.5 Comunicação (ROT-COM-*)

- ROT-COM-04 (lida/arquivar) como opcional — **recomendação forte** para inbox utilizável; sem isso, histórico vira lista infinita stressante.
- Agendar envio (mencionado em ROT-COM-01): para ADMIN, reduz erro de “enviei às 23h”; mostrar **fuso** explícito na UI.

### 5.6 Mídia (ROT-MID-*)

- RN-800–802 alinhados a uso real; **tagging opcional por aluno** vs. “por turma” deve ser explicado ao treinador (“quem aparece na galeria do pai”) — impacto direto em privacidade percebida.
- Galeria do responsável: filtros por **filho** e por **mês** reduzem sensação de arquivo morto.

### 5.7 Financeiro (ROT-FIN-*)

- Três status (Pago / Pendente / Atrasado) são claros; **semântica visual** consistente com doc 19 (estados de atenção).
- Para o responsável (ROT-FIN-05): **próximo vencimento** em destaque + linha do tempo de competências costuma ser mais compreensível que só tabela.
- Inadimplência (ROT-FIN-03): ações secundárias (“enviar lembrete”, “registrar contato”) desde que auditáveis melhoram fluxo do ADMIN sem automatizar cobrança agressiva.

### 5.8 Dashboard (ROT-DAS-*)

- RN-1002: treinador sem dashboard completo — **oportunidade:** mini-resumo mobile (“suas turmas hoje”, “sessões abertas”) cumpre função motivacional sem expor KPIs financeiros.
- CA-13.02: a **definição de retenção** deve aparecer como **tooltip ou “como calculamos”** no próprio dashboard — evita desconfiança dos sócios da escolinha.

### 5.9 Notificações (ROT-NOT-*)

- Com MVP in-app apenas ([20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md)), o risco é **sobrecarga** no centro de notificações.
- **Sugestão:** agrupamento por **filho + dia** para responsáveis com múltiplos vínculos; digest opcional (“seu resumo de hoje”) como evolução, respeitando RN-1101.

---

## 6. Lacunas conscientes × impacto na experiência

Conforme [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md):

| Lacuna | Impacto UX |
|--------|------------|
| Sem push / e-mail transacional | Pais e treinadores dependem de hábito de abrir o app; alteração de treino e financeiro perdem urgência — compensar com **copy** de canal e lembretes in-app até canais externos existirem. |
| Sem offline-first na presença (CA-07.02 desejável) | Campo com sinal fraco gera frustração; mensagem clara + fila local futura ou “tente novamente” com preservação de rascunho são mitigações. |
| Storage local de mídia no MVP | Upload pode parecer “lento”; progresso e retry (CA-11.01) são ainda mais críticos para satisfação. |

---

## 7. Priorização sugerida (visão PO)

Ordem **subjetiva** valor × risco para experiência, compatível com a priorização de MVP em [18](18-indice-rotinas-e-aceite.md):

1. **Alta:** clareza presença (modo explícito + métricas de toque), estados vazios e erros nos fluxos críticos, coerência “notificação vs. inbox vs. calendário” para o responsável.  
2. **Média:** onboarding checklist aluno/responsável, mini-dashboard treinador, agrupamento de notificações, tooltips de KPIs admin.  
3. **Estratégica (pós-canal externo):** push/e-mail com previews seguros, ICS, digest diário, offline onde fizer sentido técnico.

---

## 8. Métricas de validação (além dos CA)

| Métrica | Objetivo |
|---------|----------|
| Tempo mediano até “sessão de presença fechada” | Proxificar CA-07.01 |
| Taxa de erro “sessão sem evento” / abandono no meio do fluxo | Detectar UX de pré-condição fraca |
| Abertura de relatório / tempo até primeira interação | Medir valor emocional ([09](09-modulo-relatorios-pais.md)) |
| Responsáveis com ≥2 filhos: tempo para achar informação do filho certo | IA e navegação |
| NPS ou CSAT por papel (treinador vs. responsável) | Evita otimizar só um lado |

---

## 9. Conclusão

As especificações já embutem **bons trade-offs** (velocidade do treinador, tom positivo para famílias, ética em relatórios). As maiores oportunidades de UX não são “mais features”, e sim **coesão narrativa** entre calendário, comunicados e notificações; **redução de ambiguidade** em presença e cadastro; e **transparência de cálculo e de privacidade** onde o produto pede confiança (financeiro, relatórios, saúde). Qualquer roadmap deve ser filtrado pela RN-000 antes de entrar na fila de desenvolvimento.

---

*Documento gerado para apoio a decisões de produto e design; revisar periodicamente junto com [18-indice-rotinas-e-aceite.md](18-indice-rotinas-e-aceite.md) e [20-estado-implementacao-mvp.md](20-estado-implementacao-mvp.md).*
