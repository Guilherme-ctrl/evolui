# 01 — Glossário e entidades

## 1. Glossário

| Termo | Definição |
|-------|-----------|
| **Tenant / Escolinha** | Instância isolada da plataforma (uma escolinha ou unidade contratante). |
| **Administrador** | Usuário com gestão ampla da escolinha (cadastros, financeiro, configurações). |
| **Treinador** | Usuário que conduz turmas, presença, avaliações e mídia das suas turmas. |
| **Responsável** | Pai/mãe ou responsável legal vinculado a um ou mais alunos. |
| **Aluno / Atleta** | Criança ou praticante matriculado na escolinha. |
| **Turma** | Agrupamento operacional (horários, dias, treinador, limite, local). |
| **Categoria** | Classificação etária ou modal (ex.: Sub 7, Feminino); pode estar associada à turma ou ao aluno. |
| **Evento (calendário)** | Ocorrência agendada: treino, jogo, amistoso, evento genérico, campeonato, avaliação, reunião. |
| **Sessão de presença** | Registro de presença/ausência ligado a um evento de treino (ou equivalente) e turma. |
| **Avaliação rápida** | Conjunto de notas em dimensões pedagógicas (escala ou estrelas), sem texto longo obrigatório. |
| **Relatório para pais** | Consolidação voltada ao responsável (frequência, evolução, mídia, feedback). |
| **Comunicado** | Mensagem da escolinha para turma, grupo ou indivíduo. |
| **Mensalidade / cobrança** | Valor recorrente associado ao aluno ou contrato; acompanhada por status de pagamento. |

## 2. Entidades centrais (conceitual)

### 2.1 Escolinha (Tenant)

- Identidade da escolinha (nome, branding opcional).  
- Usuários, alunos, turmas, calendário, relatórios e dados financeiros **pertencem** a um único tenant.  

### 2.2 Aluno

**Atributos previstos (RN-101):** nome completo, foto, data de nascimento, idade (derivada ou armazenada), categoria, posição preferida, responsáveis vinculados, contato de emergência, observações médicas, restrições físicas, status (ativo/inativo).

### 2.3 Responsável

**Atributos (RN-102):** nome, telefone, WhatsApp, e-mail, grau de parentesco, endereço, CPF (opcional).

### 2.4 Turma

**Atributos (RN-201):** nome, faixa etária, dias da semana, horários, treinador responsável, limite de alunos, local do treino.

### 2.5 Evento de calendário

**Tipos:** treino, jogo, amistoso, evento, campeonato, avaliação, reunião.  
Associação típica: turma(s), horário, local, status (confirmado, cancelado, alterado).

### 2.6 Registro financeiro

Mensalidade/contrato, parcelas ou competências, status: **Pago**, **Pendente**, **Atrasado** (RN-601).

## 3. Relacionamentos principais

- Um **aluno** possui **N responsáveis** (mínimo 1 para comunicação e portal).  
- Um **aluno** está em **uma ou mais turmas** (regra de matrícula a definir na implementação: default uma turma principal).  
- Uma **turma** tem **um treinador responsável** (primário); política de co-treinador é extensão futura opcional.  
- **Eventos** ligam-se a **turma(s)** ou à escolinha inteira (evento institucional).  
- **Presença** liga **aluno + sessão/evento + turma** (ou contexto equivalente).  
- **Avaliações** ligam **aluno + turma + período/data + treinador**.  
- **Mídia** pode ligar a **treino, evento ou turma**.

## 4. Identificadores de regra

Referências **RN-xxx** são detalhadas nos módulos correspondentes e listadas em [18-indice-rotinas-e-aceite.md](18-indice-rotinas-e-aceite.md).
