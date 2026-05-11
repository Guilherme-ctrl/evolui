import { useState } from 'react';
import type { FeedbackDimension } from '../domain/feedback-dimensions';
import { useEventFeedbackPanel } from '../hooks/useEventFeedbackPanel';
import { AthleteEventFeedbackForm } from './feedback/AthleteEventFeedbackForm';
import { EventDimensionsEditorModal } from './feedback/EventDimensionsEditorModal';
import { EventFeedbackReportModal } from './feedback/EventFeedbackReportModal';

type EventLite = {
  id: string;
  title: string;
  startsAt: string;
  /** `null` = herda do tenant. `[]` = desligado neste evento. */
  feedbackDimensions: FeedbackDimension[] | null;
  effectiveFeedbackDimensions: FeedbackDimension[];
};

type Props = {
  /** Evento selecionado (de `GET /calendar/events/:id` ou da lista). */
  event: EventLite;
  /** Hook para recarregar o evento depois de mudar overrides/respostas. */
  onChanged?: () => void;
};

/**
 * Cartão "Feedback físico" exibido no calendário. UI dependente do papel:
 * - ADMIN: configurar dimensões deste evento (override / desligar / herdar do
 *   tenant) e abrir modal de "Respostas recebidas".
 * - TREINADOR: somente leitura das dimensões e modal de respostas.
 * - ATLETA: botão "Dar feedback" / "Editar resposta" para o aluno ativo,
 *   abrindo um modal com botões 1–5 por dimensão + nota opcional.
 *
 * Toda a lógica (estado, RBAC derivado, chamadas de API) vive em
 * `useEventFeedbackPanel`. Os modais são componentes apresentacionais puros.
 * Aqui restou só a composição e a barra-resumo.
 */
export function EventFeedbackPanel({ event, onChanged }: Props) {
  const vm = useEventFeedbackPanel(event, onChanged);

  // Controle de abertura dos três modais possíveis (locais à composição;
  // não fazem parte do view-model porque são puramente UI).
  const [editorOpen, setEditorOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const dims = vm.dims;

  const overrideLabel =
    vm.overrideState === 'inherit'
      ? 'Usando as dimensões padrão do tenant.'
      : vm.overrideState === 'disabled'
        ? 'Feedback desligado para este evento.'
        : 'Dimensões personalizadas deste evento.';

  function openReport() {
    setReportOpen(true);
    void vm.loadReport();
  }

  /** Dimensões iniciais do modal de edição: custom atual ou efetivas. */
  const editorInitial =
    event.feedbackDimensions != null
      ? event.feedbackDimensions.map((d, i) => ({ ...d, order: i }))
      : dims.map((d, i) => ({ ...d, order: i }));

  return (
    <section
      className="card stack"
      style={{ padding: 'var(--space-3)', gap: 'var(--space-2)' }}
    >
      <header
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div className="stack" style={{ gap: 0 }}>
          <strong>Feedback físico</strong>
          {vm.isStaff ? (
            <span className="text-caption muted">{overrideLabel}</span>
          ) : null}
        </div>
        {vm.canConfigure ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEditorOpen(true)}
          >
            Configurar
          </button>
        ) : null}
      </header>

      {dims.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {vm.isAthlete ? (
            'Ainda não há dimensões de feedback configuradas para este evento.'
          ) : (
            <>
              Nenhuma dimensão ativa. Configure em{' '}
              <em>Preferências → Feedback físico padrão</em>
              {vm.canConfigure ? ' ou neste evento (botão "Configurar")' : ''}.
            </>
          )}
        </p>
      ) : (
        <ul
          className="row"
          style={{
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {dims.map((d) => (
            <li
              key={d.key}
              className="badge"
              style={{
                border: '1px solid var(--border-default, #eee)',
                padding: '4px 10px',
                borderRadius: 9999,
              }}
            >
              {d.label}
            </li>
          ))}
        </ul>
      )}

      <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {vm.canSeeReport ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openReport}
          >
            Ver respostas
          </button>
        ) : null}
        {vm.isAthlete && dims.length > 0 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFeedbackOpen(true)}
          >
            {vm.hasMyFeedback ? 'Editar minha resposta' : 'Dar feedback'}
          </button>
        ) : null}
        {vm.isAthlete && vm.hasMyFeedback ? (
          <span className="text-caption muted">
            Resposta enviada — você pode editar a qualquer momento.
          </span>
        ) : null}
      </div>

      <EventDimensionsEditorModal
        open={editorOpen && vm.canConfigure}
        eventTitle={event.title}
        initialDimensions={editorInitial}
        busy={false}
        onClose={() => setEditorOpen(false)}
        onSave={(draft) =>
          vm.setEventDimensions({ type: 'set', dimensions: draft })
        }
        onInherit={() => vm.setEventDimensions({ type: 'inherit' })}
        onDisable={() => vm.setEventDimensions({ type: 'disable' })}
      />

      <EventFeedbackReportModal
        open={reportOpen}
        eventTitle={event.title}
        eventStartsAt={event.startsAt}
        report={vm.report}
        loading={vm.reportLoading}
        onClose={() => setReportOpen(false)}
      />

      {/* Reabre com initialScores atualizados via key — evita estado preso. */}
      <AthleteEventFeedbackForm
        key={`${event.id}-${vm.hasMyFeedback ? 'edit' : 'new'}`}
        eventTitle={event.title}
        dims={dims}
        initialScores={vm.myScores}
        initialNotes={vm.myNotes}
        open={feedbackOpen && vm.isAthlete && dims.length > 0}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={(scores, notes) => vm.submitAthleteFeedback(scores, notes)}
      />
    </section>
  );
}
