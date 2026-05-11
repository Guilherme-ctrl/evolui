import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { formatDateTimeBR } from '../lib/format-date';

type N = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  COMMS: 'Comunicados',
  BILLING: 'Cobranças',
  MEDIA: 'Mídia',
  EVALUATION: 'Avaliações',
  REPORT: 'Relatórios',
  CAL_NEW: 'Calendário — novos eventos',
  CAL_UPDATE: 'Calendário — alterações',
  SCHEDULE_CHANGE: 'Horário da turma',
  CAL_CANCEL: 'Cancelamento de treino',
};

export default function Notificacoes() {
  const [rows, setRows] = useState<N[]>([]);

  useEffect(() => {
    void apiFetch<N[]>('/notifications').then(setRows);
  }, []);

  return (
    <div className="page stack field-mode">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Notificações</h1>
          <p className="page-header__subtitle">
            Resumo seguro (CA-03.02): o texto completo de comunicados e mensagens está em Comunicações e nos
            módulos correspondentes.
          </p>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="muted card card--lg">Nenhuma notificação por enquanto.</p>
      ) : (
        <ul className="plain card card--lg">
          {rows.map((n) => (
            <li key={n.id} className="list-row stack" style={{ gap: 'var(--space-2)' }}>
              <div className="row" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="badge badge--neutral">{TYPE_LABELS[n.type] ?? n.type}</span>
                  <strong>{n.title}</strong>
                </div>
                {n.readAt ? (
                  <span className="badge badge--neutral">Lida</span>
                ) : (
                  <span className="badge badge--info">Nova</span>
                )}
              </div>
              <p className="text-body">{n.body}</p>
              <span className="text-caption muted">{formatDateTimeBR(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
