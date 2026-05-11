# Plano de ação — App Flutter (mobilidade) para o Evolui

## 1. Objetivo

Construir o app Flutter de mobilidade do Evolui com foco em:

- operação rápida em campo para ADMIN/TREINADOR;
- acompanhamento do ATLETA (conta que opera o app);
- aderência total às specs (`Docs/`) e ao `constitution.md` Flutter.

Princípio inegociável de produto: **não aumentar o trabalho operacional do treinador (RN-000)**.

---

## 2. Diretrizes de arquitetura (constitution)

- Organização **feature-first**.
- Camadas por feature: `presentation -> domain -> data`.
- Estado com `flutter_bloc`/`Cubit` e estados semânticos.
- DI/rotas com `flutter_modular`.
- HTTP com `dio` via cliente centralizado (`core/network`).
- Erros técnicos convertidos para `Failure` no `repository`.
- Testabilidade obrigatória com `flutter_test`, `bloc_test`, `mocktail`.

---

## 3. Premissas de domínio obrigatórias (specs)

1. Refator ATLETA vigente:
   - papel de usuário é `ATLETA` (não `RESPONSAVEL` legado);
   - `Student.accountUserId` obrigatório;
   - suporte a múltiplos alunos por conta (switcher RN-200);
   - aceite de termos no 1º login (RN-201).
2. Fluxos são governados por ROT/CA do índice mestre (Doc 18).
3. Não inventar endpoints/campos/regras fora da documentação.

---

## 4. Estrutura alvo do projeto Flutter

```txt
lib/
  main.dart
  app_widget.dart
  app_module.dart

  core/
    errors/
    network/
    config/
    constants/
    utils/

  shared/
    widgets/
    themes/
    layout/

  features/
    auth/
    home/
    calendar/
    attendance/
    communication/
    athlete_portal/
    notifications/
    evaluations/
    reports/
    media/
    finance/
    workouts/
    individual_plans/
```

Cada feature segue:

```txt
feature_name/
  feature_name_module.dart
  data/
  domain/
  presentation/
```

---

## 5. Fases de execução

## Fase M0 — Fundação técnica (Sprint 1)

### Entregas

- Bootstrap do app (`main`, `app_module`, `app_widget`).
- Sistema de tema e tokens do design system.
- `HttpClient` central com interceptors:
  - auth bearer;
  - tenant;
  - `X-Active-Student-Id`;
  - logging técnico.
- Base de falhas (`Failure`) e exceptions.
- Feature `auth` com login e guarda de sessão.
- Gate de aceite de termos no 1º login (RN-201).

### Critério de pronto

- App compila.
- Login funcional.
- Sessão persistida.
- Redirecionamento inicial por papel.

---

## Fase M1 — Núcleo operacional mobile (Sprints 2–3)

### Entregas

1. **Home por papel**
   - ADMIN
   - TREINADOR
   - ATLETA

2. **Calendário**
   - lista de eventos;
   - criação/edição/cancelamento (escopo permitido);
   - visualização por papel.

3. **Presença**
   - abrir sessão;
   - marcar presentes/ausentes;
   - correção/reabertura conforme regra.

4. **Comunicação**
   - envio por turma;
   - histórico/inbox;
   - marcação como lida.

### Critério de pronto

- Fluxos operacionais críticos funcionam em poucos passos.
- Estados loading/error/empty/success cobertos nos cubits.

---

## Fase M2 — Experiência ATLETA e percepção de valor (Sprints 4–5)

### Entregas

- Switcher de aluno ativo (RN-200).
- Home do ATLETA focada no aluno em contexto.
- Notificações in-app e central de avisos.
- Avaliações (consulta de evolução).
- Relatórios para família/atleta.
- Galeria de mídia por evento/aluno.
- Financeiro básico (status/extrato).

### Critério de pronto

- Jornada ATLETA ponta-a-ponta operando com escopo correto por aluno.

---

## Fase M3 — Módulos avançados já previstos (Sprints 6+)

### Entregas

- **Workouts (Doc 25)**:
  - listagem e detalhe de treinos;
  - atribuições por turma/aluno;
  - feedback físico pós-treino.

- **Feedback físico pós-evento (Calendário)**:
  - submissão ATLETA;
  - visualização agregada para staff.

- **Planos Individuais (Doc 24)**:
  - visualização no portal ATLETA;
  - operações de staff conforme escopo.

### Critério de pronto

- Fluxos avançados aderentes aos critérios de aceite dos Docs 24/25/06.

---

## 6. Backlog técnico transversal

- Componente de erro padrão (snackbar/banner).
- Estratégia de retry e timeout em rede.
- Observabilidade (feature/tela/ação/erro/tenant/versão).
- Empty states e UX de estados sem dados.
- Preparação para offline seletivo:
  - calendário (leitura cache);
  - presença (fila local com sync explícito).

---

## 7. Estratégia de testes

## 7.1 Pirâmide mínima por feature

1. `domain/usecases`;
2. `data/repositories` (mapeamento exception -> failure);
3. `presentation/cubit` (`bloc_test`);
4. widgets críticos;
5. smoke de navegação da feature.

## 7.2 Cenários obrigatórios

- success;
- loading;
- empty;
- erro de negócio (`Failure`);
- erro de rede.

## 7.3 Testes de integração por fluxo crítico

- login + termos;
- switcher de aluno;
- presença rápida;
- envio de comunicação;
- submissão de feedback físico.

---

## 8. Roadmap de módulos (ordem recomendada)

1. `auth`
2. `home`
3. `calendar`
4. `attendance`
5. `communication`
6. `athlete_portal` (switcher + visão aluno)
7. `notifications`
8. `evaluations`
9. `reports`
10. `media`
11. `finance`
12. `workouts`
13. `individual_plans`

---

## 9. Riscos e mitigação

1. **Drift com backend/spec**
   - Mitigação: cada feature começa com checklist de contratos (Doc 18 + Doc 20).

2. **Cubit inchado**
   - Mitigação: separar cubits por fluxo (lista, detalhe, ação).

3. **Vazamento técnico para UI**
   - Mitigação: revisão obrigatória de dependências por camada.

4. **Regressão de UX de campo**
   - Mitigação: KPI de toques/tempo por ação em presença e calendário.

---

## 10. Definition of Done por feature

- Compila e integra no módulo/rotas.
- Respeita `presentation -> domain -> data`.
- UI não depende de datasource/Dio/model externo.
- Repository converte exceptions em `Failure`.
- Cubit sem `BuildContext`, com estados claros.
- Side effects em listeners.
- Testes mínimos passantes (usecase/repository/cubit/widget crítico).
- Sem invenção de endpoint/regra/campo.
- Documentação atualizada em caso de alteração de contrato.

---

## 11. Próxima ação prática (execução imediata)

1. Scaffold inicial do app Flutter com estrutura base da Fase M0.
2. Implementar feature `auth` completa com termos (RN-201).
3. Implementar `home` por papel + switcher de aluno (RN-200).
4. Abrir PR pequeno por feature (fatias revisáveis).
