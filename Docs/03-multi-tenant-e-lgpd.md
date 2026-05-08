# 03 — Multi-tenant e LGPD

## 1. Multi-tenant (RN-020)

Cada escolinha é um **tenant** com:

- Usuários próprios  
- Alunos próprios  
- Turmas próprias  
- Calendário próprio  
- Relatórios próprios  
- Dados isolados  

**RN-021:** Nenhum usuário ou processo de um tenant pode ler, alterar ou apagar dados de outro tenant.

## 2. Estratégia de isolamento (especificação de engenharia)

Todas as entidades de negócio devem carregar `tenantId` (ou equivalente). Consultas e comandos devem filtrar **sempre** por tenant derivado do contexto de autenticação (JWT/sessão), nunca aceitar `tenantId` arbitrário do cliente sem validação de super-admin de plataforma (fora do escopo do tenant).

**CA-03.01:** Testes automatizados devem incluir tentativa de acesso cruzado (403/404).

## 3. Dados pessoais e sensíveis

### 3.1 Categorias

- **Identificação:** nome, CPF (opcional), contatos, endereço.  
- **Saúde (sensível):** observações médicas, restrições físicas — **minimização** e acesso restrito (ADMIN + treinadores das turmas do aluno; responsável vê o que for política da escolinha).  
- **Imagem:** foto do aluno, mídia de treinos.  

### 3.2 LGPD — princípios aplicáveis (RN-022)

- Finalidade: uso para operação da escolinha e comunicação com responsáveis.  
- Acesso por perfil; auditoria em ações sensíveis (ex.: exportação, exclusão).  
- Consentimento/base legal: fluxo de cadastro e termos por tenant (detalhe legal a validar com jurídico).  
- Direitos do titular: canal para correção/exclusão mediada pelo ADMIN da escolinha (processo operacional).

**CA-03.02:** Dados de saúde não aparecem em relatórios públicos nem em notificações push sem necessidade.

## 4. Retenção e exclusão

**RN-023:** Ao inativar aluno, preservar histórico conforme política do tenant (retention); opção de anonimização após prazo deve ser prevista em roadmap.

## 5. Rotinas

### ROT-TENANT-01 — Resolver tenant na requisição

**Passos:** autenticação → extrair `tenantId` do usuário → injetar em repositórios.  
**Exceção:** usuário sem tenant → 403.

### ROT-TENANT-02 — Criar escolinha (onboarding SaaS)

**Atores:** operação da plataforma ou self-service (futuro).  
**Pós-condição:** tenant criado + primeiro ADMIN convidado.  
*Documentação detalhada pode evoluir em doc de “plataforma”; aqui define isolamento pós-criação.*
