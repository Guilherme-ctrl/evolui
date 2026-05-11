# 01 — Glossário e entidades

> **Refator ATLETA (2026-05):** ver nota no [README de Docs](README.md). Os termos abaixo refletem o vocabulário pós-refator.

## 1. Glossário

| Termo | Definição |
|-------|-----------|
| **Tenant / Escolinha** | Instância isolada da plataforma (uma escolinha ou unidade contratante). |
| **Administrador** | Usuário com gestão ampla da escolinha (cadastros, financeiro, configurações). |
| **Treinador** | Usuário que conduz turmas, presença, avaliações e mídia das suas turmas. |
| **Atleta / Conta-atleta** | `User role=ATLETA` — login que opera o app em nome do(s) aluno(s) (`Student.accountUserId`). Pode ser operada pelo próprio atleta ou por um adulto responsável (kinship declarado no aceite — RN-201). Pode ser titular de N alunos (irmãos — switcher RN-200). |
| **Guardian (contato)** | Pai/mãe/tutor cadastrado como **contato** (sem login no app), usado para cobrança, e-mail, SMS e WhatsApp. Vinculado N:N a alunos via `StudentGuardian` + `isPrimaryForBilling`. |
| **Aluno** | Criança/jovem matriculado na escolinha. Sempre tem um `accountUserId` (conta-atleta) e pode ter um ou mais `Guardian` de contato. |
| **Turma** | Agrupamento operacional (horários, dias, treinador, limite, local). |
| **Categoria** | Classificação etária ou modal (ex.: Sub 7, Feminino); pode estar associada à turma ou ao aluno. |
| **Evento (calendário)** | Ocorrência agendada: treino, jogo, amistoso, evento genérico, campeonato, avaliação, reunião. |
| **Sessão de presença** | Registro de presença/ausência ligado a um evento de treino (ou equivalente) e turma. |
| **Avaliação rápida** | Conjunto de notas em dimensões pedagógicas (escala ou estrelas), sem texto longo obrigatório. |
| **Relatório para pais** | Consolidação voltada ao responsável (frequência, evolução, mídia, feedback). |
| **Comunicado** | Mensagem da escolinha para turma, grupo ou indivíduo. |
| **Mensalidade / cobrança** | Valor recorrente associado ao aluno ou contrato; acompanhada por status de pagamento. |
| **Profissional (Staff)** | Usuário `TREINADOR` com perfil operacional (`StaffProfile`) que identifica tipo (professor, fisioterapeuta, preparador físico, outro); habilita prescrição de planos individuais sem nova role. Ver [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md). |
| **Plano individual** | Conjunto ordenado de sessões prescritas a um único aluno, com tipo, objetivo, período e status de publicação. |
| **Sessão de plano** | Item ordenado dentro de um plano individual (ex.: bloco de trabalho ou tema da sessão). |
| **Portal autônomo / titular da conta (atleta)** | Modo em que o aluno não depende de responsável terceiro no cadastro: um `User` com papel **RESPONSAVEL** é associado ao aluno como `portalUserId` e a flag `selfManagedPortal` está ativa; esse usuário recebe o mesmo escopo de portal e notificações que um guardian para aquele aluno (**RN-103** Caso B, **RN-1400–RN-1404**, Doc 04). |

## 2. Entidades centrais (conceitual)

### 2.1 Escolinha (Tenant)

- Identidade da escolinha (nome, branding opcional).  
- Usuários, alunos, turmas, calendário, relatórios e dados financeiros **pertencem** a um único tenant.  

### 2.2 Aluno

**Atributos previstos (RN-101):** nome completo, foto, data de nascimento, idade (derivada ou armazenada), categoria, posição preferida, responsáveis vinculados, contato de emergência, observações médicas, restrições físicas, status (ativo/inativo). **Portal autônomo (conceitual / modelo):** `selfManagedPortal` (boolean) e `portalUserId` (referência opcional a `User` RESPONSAVEL do mesmo tenant quando a flag está ativa) — ver Doc 04 (**RN-1400–RN-1403**).

### 2.3 Responsável

**Atributos (RN-102):** nome, telefone, WhatsApp, e-mail, grau de parentesco, endereço, CPF (opcional).

### 2.4 Turma

**Atributos (RN-201):** nome, faixa etária, dias da semana, horários, treinador responsável, limite de alunos, local do treino.

### 2.5 Evento de calendário

**Tipos:** treino, jogo, amistoso, evento, campeonato, avaliação, reunião.  
Associação típica: turma(s), horário, local, status (confirmado, cancelado, alterado).

### 2.6 Registro financeiro

Mensalidade/contrato, parcelas ou competências, status: **Pago**, **Pendente**, **Atrasado** (RN-601).

### 2.7 StaffProfile (profissional)

Extensão de **User** no tenant: `professionalType`, `registry` opcional (ex.: CREF/CREFITO), `bio`, `active`. Um usuário tem no máximo um `StaffProfile` por tenant. Relaciona-se a **IndividualPlan** como profissional atribuído. Detalhes: [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md).

### 2.8 IndividualPlan (plano individual)

Pertence ao **tenant** e a um **Student**; referencia `assignedProfessionalId` (`StaffProfile`), `type`, `title`, `goal` opcional, datas, `status` (`DRAFT` … `CANCELLED`), sessões e exercícios filhos, auditoria de transições. Detalhes: [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md).

## 3. Relacionamentos principais

- Um **aluno** possui **N responsáveis** cadastrais (`StudentGuardian`); para comunicação e portal, vale **RN-103** (Caso A: mínimo 1 vínculo; Caso B: portal autônomo com `portalUserId`, Doc 04).  
- Um **aluno** está em **uma ou mais turmas** (regra de matrícula a definir na implementação: default uma turma principal).  
- Uma **turma** tem **um treinador responsável** (primário); política de co-treinador é extensão futura opcional.  
- **Eventos** ligam-se a **turma(s)** ou à escolinha inteira (evento institucional).  
- **Presença** liga **aluno + sessão/evento + turma** (ou contexto equivalente).  
- **Avaliações** ligam **aluno + turma + período/data + treinador**.  
- **Mídia** pode ligar a **treino, evento ou turma**.

## 4. Identificadores de regra

Referências **RN-xxx** são detalhadas nos módulos correspondentes e listadas em [18-indice-rotinas-e-aceite.md](18-indice-rotinas-e-aceite.md).
