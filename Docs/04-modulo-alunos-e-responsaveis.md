# 04 — Módulo: Alunos e responsáveis

## 1. Objetivo

Cadastro e manutenção de alunos e responsáveis, vínculos N:N, dados de emergência e saúde, status ativo/inativo — sempre no escopo do tenant.

## 2. Regras de negócio

| ID | Regra |
|----|--------|
| RN-101 | Aluno possui: nome completo, foto (opcional mas recomendada), data de nascimento, idade (calculada ou armazenada), categoria, posição preferida, contato de emergência, observações médicas, restrições físicas, status ativo/inativo. |
| RN-102 | Responsável possui: nome, telefone, WhatsApp, e-mail, grau de parentesco, endereço, CPF opcional. |
| RN-103 | Aluno deve ter **ao menos um** responsável vinculado para habilitar portal e notificações. |
| RN-104 | Inativar aluno impede nova presença/avaliação; histórico permanece conforme política de retenção. |
| RN-105 | Exclusão definitiva apenas ADMIN; pode exigir confirmação e log de auditoria. |

## 3. Rotinas

### ROT-ALU-01 — Cadastrar aluno

**Ator:** ADMIN (treinador apenas se política permitir — default: não).  
**Pré-condição:** tenant ativo.  
**Passos:** informar dados obrigatórios; opcional upload de foto; associar categoria/turma em passo próprio ou aqui.  
**Pós-condição:** aluno criado com status ativo.  
**Exceções:** validação de datas; limite de turma ([05-modulo-turmas-e-categorias.md](05-modulo-turmas-e-categorias.md)).  
**CA-04.01:** sem responsável, sistema alerta e bloqueia “concluir matrícula digital” até RN-103.

### ROT-ALU-02 — Editar aluno

**Ator:** ADMIN.  
**Passos:** atualizar campos; versionar foto se substituída.  
**CA-04.02:** alterações em dados de saúde registradas em log (mínimo: quem/quando).

### ROT-ALU-03 — Inativar / reativar aluno

**Ator:** ADMIN.  
**Pós-condição:** inativo → treinador não vê em listas de presença do dia (ou vê como “inativo” conforme UX); reativação restaura nas turmas ainda válidas.

### ROT-ALU-04 — Cadastrar responsável

**Ator:** ADMIN.  
**Passos:** dados RN-102; convite por e-mail/SMS (futuro).  
**CA-04.03:** e-mail ou telefone único por tenant opcional (evitar duplicidade).

### ROT-ALU-05 — Vincular responsável ↔ aluno

**Ator:** ADMIN.  
**Passos:** selecionar aluno e responsável; definir se é principal para cobrança/comunicação.  
**Pós-condição:** RN-103 atendida.

### ROT-ALU-06 — Desvincular responsável

**Ator:** ADMIN.  
**Regra:** não permitir se for o único responsável do aluno (RN-103).

## 4. Critérios de aceite (resumo)

- CA-04.01 a CA-04.03 conforme acima.  
- Dados sensíveis não expostos em APIs públicas ou listagens desnecessárias.

## 5. Notificações relacionadas

Convite de responsável, alteração de dados críticos (opcional): ver [14-modulo-notificacoes.md](14-modulo-notificacoes.md).
