# 11 — Módulo: Fotos e vídeos

## 1. Objetivo

Engajamento, profissionalismo percebido, aproximação dos pais, valor percebido do serviço.

## 2. Funcionalidades

- Upload **múltiplo**.  
- Organização por **treino**, **evento** ou **turma**.  
- Visualização **mobile** otimizada.

## 3. Regras de negócio

| ID | Regra |
|----|--------|
| RN-800 | Upload deve ser **simples** (poucos passos). |
| RN-801 | Fluxo deve funcionar bem no **celular** (câmera e galeria). |
| RN-802 | Permitir **múltiplas imagens** em um único envio. |
| RN-803 | Vídeos: limites de tamanho/duração por política do tenant/plano (detalhe técnico). |
| RN-804 | Apenas ADMIN e TREINADOR (turma) fazem upload; responsáveis apenas visualizam (salvo feature futura de envio). |

## 4. Rotinas

### ROT-MID-01 — Upload em lote após treino

**Ator:** TREINADOR.  
**Pré-condição:** sessão de treino ou evento selecionado.  
**Passos:** selecionar arquivos → associar turma/alunos opcionalmente (tags) → enviar.  
**Pós-condição:** mídia indexada; notificação “Fotos adicionadas” opcional.

### ROT-MID-02 — Organizar por evento

**Passos:** escolher evento do calendário como pasta lógica.

### ROT-MID-03 — Moderar / remover mídia

**Ator:** ADMIN.  
**Motivo:** LGPD, conteúdo inadequado, solicitação do responsável.

### ROT-MID-04 — Visualizar galeria (responsável)

**Filtro:** apenas mídia onde o filho está **tagado** ou turma do filho (política: default por turma).

## 5. Critérios de aceite

- **CA-11.01:** progresso de upload visível; falha com retry.  
- **CA-11.02:** imagens otimizadas para exibição (thumbnail) sem bloquear UI — ver [16-requisitos-nao-funcionais.md](16-requisitos-nao-funcionais.md).  
- **CA-11.03:** exclusão remove objeto de storage e referência no banco (transação consistente).

## 6. Armazenamento

Objeto em bucket (S3-compatível, Supabase, Firebase, etc.) — [17-arquitetura-e-stack-sugerida.md](17-arquitetura-e-stack-sugerida.md).
