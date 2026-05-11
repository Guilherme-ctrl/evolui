import { formatDateBR, formatTimeBR } from '../../lib/format-date';
import { Modal } from '../Modal';
import type { EventFeedbackReport } from '../../services/types';

type Props = {
  open: boolean;
  eventTitle: string;
  eventStartsAt: string;
  report: EventFeedbackReport | null;
  loading: boolean;
  onClose: () => void;
};

/**
 * Modal apresentacional do relatório de feedback de um evento (visão staff).
 * Não conhece API: recebe o `report` já carregado pelo container.
 */
export function EventFeedbackReportModal({
  open,
  eventTitle,
  eventStartsAt,
  report,
  loading,
  onClose,
}: Props) {
  if (!open) return null;
  return (
    <Modal
      open
      title={`Respostas — ${eventTitle} (${formatDateBR(eventStartsAt)} ${formatTimeBR(eventStartsAt)})`}
      onClose={onClose}
    >
      {loading || !report ? (
        <p className="muted">Carregando…</p>
      ) : report.feedbacks.length === 0 ? (
        <p className="muted">Nenhum aluno respondeu ainda.</p>
      ) : (
        <div className="stack">
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {report.averages.map((a) => (
              <div
                key={a.key}
                className="card"
                style={{ padding: 'var(--space-2)', minWidth: 140, flex: '1 1 140px' }}
              >
                <div className="text-caption muted">{a.label}</div>
                <div className="text-h2" style={{ margin: 0 }}>
                  {a.average == null ? '—' : a.average.toFixed(2)}
                </div>
                <div className="text-caption muted">
                  {a.count} resposta{a.count === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Aluno</th>
                {report.effectiveFeedbackDimensions.map((d) => (
                  <th key={d.key}>{d.label}</th>
                ))}
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {report.feedbacks.map((f) => (
                <tr key={f.id}>
                  <td>{f.student.fullName}</td>
                  {report.effectiveFeedbackDimensions.map((d) => (
                    <td key={d.key}>
                      {typeof f.scores?.[d.key] === 'number' ? f.scores[d.key] : '—'}
                    </td>
                  ))}
                  <td className="text-caption muted">{f.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
