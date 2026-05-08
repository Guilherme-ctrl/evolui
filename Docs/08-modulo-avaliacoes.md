# 08 — Módulo: Avaliações rápidas

## 1. Objetivo

Gerar **percepção de evolução** para os pais **sem** aumentar trabalho do treinador. **Não** substituir scout profissional nem estatísticas complexas.

## 2. Anti-objetivos (RN-500)

Não é objetivo do sistema:

- Contar gols ou passes.  
- Medir scout profissional.  
- Gerar análise tática avançada.

## 3. Dimensões de avaliação (catálogo sugerido)

Participação, disciplina, trabalho em equipe, evolução técnica, comprometimento, confiança, comunicação, dedicação.

**RN-501:** O tenant pode habilitar subconjunto de dimensões (configuração ADMIN).

## 4. Modelos de pontuação

### 4.1 Escala simples (RN-502)

Valores: **Excelente**, **Muito bom**, **Bom**, **Precisa melhorar** (ordem semântica fixa para relatórios).

### 4.2 Estrelas (RN-503)

Escala **1 a 5** por dimensão (ou global — política: recomendado por dimensão para granularidade).

## 5. Regras obrigatórias

| ID | Regra |
|----|--------|
| RN-504 | Treinador **não** deve escrever textos longos obrigatórios. |
| RN-505 | Processo deve ser **rápido** (mesma filosofia da presença). |
| RN-506 | Sistema deve **gerar feedbacks automaticamente** a partir das seleções (texto curto positivo/construtivo). |
| RN-507 | Evitar burocracia: poucos campos por avaliação. |

## 6. Rotinas

### ROT-AVA-01 — Configurar dimensões e modelo (ADMIN)

**Pós-condição:** turmas usam configuração vigente; alteração não apaga histórico (mapeamento legado).

### ROT-AVA-02 — Avaliar aluno (treinador)

**Ator:** TREINADOR.  
**Pré-condição:** aluno na turma do treinador; sessão de treino ou data de referência.  
**Passos:** para cada dimensão habilitada, selecionar escala ou estrelas; opcional **comentário curto** (limite de caracteres, ex.: 140).  
**Pós-condição:** registro salvo; texto automático RN-506 gerado; notificação opcional ao responsável.

### ROT-AVA-03 — Avaliar lote (turma)

**Passos:** mesma tela com navegação “próximo aluno” sem recarregar; ideal para reduzir tempo total.

### ROT-AVA-04 — Visualizar evolução (responsável)

**Conteúdo:** série temporal agregada **individual**; linguagem positiva; sem ranking.

## 7. Critérios de aceite

- **CA-08.01:** comentário livre, se existir, tem **limite máximo** enforced no backend.  
- **CA-08.02:** feedback automático é gerado para cada avaliação salva.  
- **CA-08.03:** avaliações não exibem comparação com outros alunos no portal do responsável.

## 8. IA (futuro)

Geração de feedback humanizado a partir de seleções — ver [17-arquitetura-e-stack-sugerida.md](17-arquitetura-e-stack-sugerida.md) e roadmap.
