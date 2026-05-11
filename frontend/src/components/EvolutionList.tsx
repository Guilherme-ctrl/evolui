import { useEffect, useState } from 'react';
import { Banner } from './Banner';
import { apiFetch } from '../lib/api';
import { formatDateBR } from '../lib/format-date';

export type EvaluationRow = {
  id: string;
  evaluatedAt: string;
  autoFeedback: string;
  comment: string | null;
  scores: Record<string, unknown>;
  coach: { fullName: string };
};

type Props = {
  studentId: string;
};

export default function EvolutionList({ studentId }: Props) {
  const [rows, setRows] = useState<EvaluationRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    void apiFetch<EvaluationRow[]>(`/evaluations/students/${studentId}`)
      .then((data) => {
        setErr(null);
        setRows(data);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar evolução'));
  }, [studentId]);

  if (err) {
    return (
      <Banner variant="danger" onDismiss={() => setErr(null)}>
        {err}
      </Banner>
    );
  }

  if (!rows) {
    return <p className="muted">Carregando evolução…</p>;
  }

  if (rows.length === 0) {
    return <p className="muted">Nenhuma avaliação registrada ainda.</p>;
  }

  return (
    <ul className="plain stack" style={{ gap: 'var(--space-4)' }}>
      {rows.map((ev) => (
        <li key={ev.id} className="card stack card--lg">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <span className="text-caption tabular-nums">
              {formatDateBR(ev.evaluatedAt)}
            </span>
            <span className="text-caption muted">Técnico: {ev.coach.fullName}</span>
          </div>
          <div className="detail-kv" style={{ marginTop: 'var(--space-2)' }}>
            {Object.entries(ev.scores).map(([k, v]) => (
              <span key={k}>
                <span className="muted">{k}</span> {String(v)}
              </span>
            ))}
          </div>
          <p className="text-body" style={{ margin: 0 }}>
            {ev.autoFeedback}
          </p>
          {ev.comment ? (
            <p className="text-caption" style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Comentário: {ev.comment}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
