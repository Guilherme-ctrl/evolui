# 12 — Módulo: Financeiro (simplificado)

## 1. Objetivo

Controle **simples** de mensalidades, pagamentos, inadimplência e histórico, com **visão para responsáveis**.

## 2. Funcionalidades

- Cadastro de mensalidades (valor, periodicidade, vencimento).  
- Controle de pagamentos.  
- Inadimplência (lista e alertas).  
- Histórico financeiro por aluno/contrato.  
- Visualização para responsáveis (o que diz respeito a eles).

## 3. Status de pagamento (RN-900)

**Pago**, **Pendente**, **Atrasado**.

**RN-901:** Transição para **Atrasado** automática após vencimento + tolerância configurável (ex.: D+1).

## 4. Rotinas

### ROT-FIN-01 — Cadastrar plano de mensalidade do aluno

**Ator:** ADMIN.  
**Passos:** valor, dia de vencimento, início; opcional desconto/irmão.  
**Pós-condição:** parcelas ou competências geradas (modelo mensal simplificado).

### ROT-FIN-02 — Registrar pagamento manual

**Ator:** ADMIN.  
**Passos:** selecionar competência; data; método (dinheiro, PIX manual, etc.).  
**Pós-condição:** status Pago; recibo opcional.

### ROT-FIN-03 — Listar inadimplência

**Ator:** ADMIN.  
**Saída:** aluno, responsável principal, valor, dias em atraso.

### ROT-FIN-04 — Notificar pagamento pendente

**Gatilho:** próximo ao vencimento ou após atraso — [14-modulo-notificacoes.md](14-modulo-notificacoes.md).

### ROT-FIN-05 — Visualizar extrato (responsável)

**Conteúdo:** competências, status, comprovantes se houver upload futuro.

## 5. Integrações futuras

PIX, cartão, cobrança recorrente, boletos, gateways — **fora do MVP** salvo decisão explícita; documentar como extensão.

## 6. Critérios de aceite

- **CA-12.01:** responsável não vê dados financeiros de outro responsável.  
- **CA-12.02:** ADMIN pode exportar CSV da inadimplência (opcional).  
- **CA-12.03:** valores monetários em centavos no backend; arredondamento explícito na UI.

## 7. Auditoria

Alteração de status de pago → pendente exige permissão elevada e log.
