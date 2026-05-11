# 04 — Módulo: Alunos e responsáveis

> **Refator ATLETA (2026-05):** ver nota no [README de Docs](README.md). Resumindo o impacto neste módulo:
> - **Conta-atleta (login)** é representada por `User role=ATLETA`. Cada `Student` tem `accountUserId` obrigatório (FK para `User`). Um mesmo `User` pode ser `accountUserId` de N alunos (irmãos) → switcher RN-200.
> - **Guardian** é entidade de **contato puro** (sem login). Mantém `email`, `phone`, `whatsapp`, `kinship`, `cpf`, `address`, e vínculo N:N com `Student` via `StudentGuardian` + `isPrimaryForBilling`.
> - Rotinas legadas RN-1400–RN-1404 (portal autônomo, `selfManagedPortal`, `portalUserId`) foram **superadas** — toda conta-atleta é "portal" por definição. Para trocar a conta vinculada a um aluno (ex.: sair de conta individual para conta de família): `PATCH /students/:id/account-user` (admin).
> - RN-103 (proteção de "aluno sem responsável") foi **relaxada**: como `accountUserId` é obrigatório, o aluno nunca fica sem operador do app. A criação ainda permite cadastrar um `Guardian` opcional para canais externos/cobrança.

## 1. Objetivo

Cadastro e manutenção de alunos e responsáveis, vínculos N:N, dados de emergência e saúde, status ativo/inativo — sempre no escopo do tenant.

## 2. Regras de negócio

| ID | Regra |
|----|--------|
| RN-101 | Aluno possui: nome completo, foto (opcional mas recomendada), data de nascimento, idade (calculada ou armazenada), categoria, posição preferida, contato de emergência, observações médicas, restrições físicas, status ativo/inativo. |
| RN-102 | Responsável possui: nome, telefone, WhatsApp, e-mail, grau de parentesco, endereço, CPF opcional. |
| RN-103 | **Portal e notificações — dois casos:** **Caso A (padrão):** aluno deve ter **ao menos um** vínculo `StudentGuardian` (responsável cadastral) para habilitar portal e notificações como hoje. **Caso B (portal autônomo):** com `selfManagedPortal = true` e `portalUserId` apontando para `User` ativo com papel **RESPONSAVEL** no mesmo tenant (**RN-1401**), o aluno **não** precisa de `StudentGuardian` para esses fins; o titular da conta de portal é explicitamente o usuário associado. **Invariante:** não permitir `selfManagedPortal` sem `portalUserId` válido. |
| RN-1400 | A flag `selfManagedPortal` e o vínculo `portalUserId` só podem ser alterados por **ADMIN**. |
| RN-1401 | Se `selfManagedPortal`, então `portalUserId` é **obrigatório**; o usuário referenciado deve ter `role = RESPONSAVEL`, `tenantId` igual ao do aluno, `active = true`. |
| RN-1402 | Com a flag ativa e **RN-1401** satisfeita, o usuário em `portalUserId` tem o **mesmo escopo** de API, notificações e portal que um responsável teria via `StudentGuardian` **para aquele aluno** (sem novo papel). |
| RN-1403 | Desativar `selfManagedPortal` só é permitido se o aluno tiver **ao menos um** `StudentGuardian` (permanece um titular cadastral no Caso A). Não deixar aluno sem titular nem vínculo guardian nem portal válido. |
| RN-1404 | Notificações e destinatários definidos como “responsáveis do aluno” incluem o `portalUserId` quando `selfManagedPortal` estiver ativo, com **dedupe** se o mesmo `userId` já aparecer como responsável vinculado. |
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

> Inativação dispara **RN-1306**: planos individuais `PUBLISHED` do aluno são pausados automaticamente — ver [24-modulo-planos-individuais.md](24-modulo-planos-individuais.md).

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
**Regra:** não permitir se for o único responsável do aluno **no Caso A** (RN-103). **Exceção:** se o aluno estiver no **Caso B** (`selfManagedPortal` + `portalUserId` válido, **RN-1401**), é permitido desvincular o último `StudentGuardian`, desde que após a operação o aluno continue com titular de portal ou com ao menos um guardian, conforme **RN-1403**.

### ROT-ALU-07 — Configurar portal autônomo (titular = conta RESPONSAVEL)

**Ator:** ADMIN.  
**Pré-condição:** tenant ativo; existe `User` com papel **RESPONSAVEL** a associar (ou criação prévia do usuário).  
**Passos:** no cadastro do aluno, ativar opção de portal autônomo (produto: titular da conta é o próprio atleta / sem responsável terceiro no fluxo) e selecionar o usuário **RESPONSAVEL** titular (`portalUserId`). Opcionalmente vincular também responsáveis cadastrais (`StudentGuardian`).  
**Pós-condição:** se flag ativa, **RN-1401** garantida; APIs e notificações tratam o titular como responsável daquele aluno (**RN-1402**, **RN-1404**).  
**Exceções:** flag ativa sem usuário válido → rejeitar; desativar flag sem ao menos um guardian (**RN-1403**) → rejeitar; o mesmo `portalUserId` não deve ser titular autônomo de mais de um aluno no tenant (política v1 recomendada).  
**Referência técnica:** [exec/plano-implementacao-aluno-portal-autonomo.md](exec/plano-implementacao-aluno-portal-autonomo.md).

## 4. Critérios de aceite (resumo)

- CA-04.01 a CA-04.03 conforme acima.  
- **CA-25.01:** Com **Caso B** ativo, `GET` de alunos (escopo RESPONSAVEL) lista o aluno como se houvesse vínculo guardian.  
- **CA-25.02:** Rotas `/guardian/*` e equivalentes do portal funcionam para o `portalUserId` no `studentId` configurado.  
- **CA-25.03:** Lista de destinatários por aluno inclui `portalUserId` com dedupe em relação a guardians.  
- **CA-25.04:** Matrícula em turma permitida sem `StudentGuardian` quando **RN-1401** satisfeita (Caso B).  
- **CA-25.05:** Isolamento por `tenantId` (**CA-03.01**) inalterado.  
- Dados sensíveis não expostos em APIs públicas ou listagens desnecessárias.

## 5. Notificações relacionadas

Convite de responsável, alteração de dados críticos (opcional): ver [14-modulo-notificacoes.md](14-modulo-notificacoes.md).
