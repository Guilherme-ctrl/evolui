import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { formatDateTimeBR } from '../lib/format-date';
import { runDeferredEffect } from '../lib/run-deferred';

type Msg = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  recipients: { readAt: string | null }[];
};

export default function Avisos() {
  const [rows, setRows] = useState<Msg[]>([]);

  useEffect(() => {
    return runDeferredEffect(() => {
      void apiFetch<Msg[]>('/communications/inbox').then(setRows);
    });
  }, []);

  async function read(id: string) {
    await apiFetch(`/communications/messages/${id}/read`, { method: 'POST' });
    setRows((r) =>
      r.map((m) =>
        m.id === id
          ? {
              ...m,
              recipients: m.recipients.map((rec, i) =>
                i === 0 ? { ...rec, readAt: new Date().toISOString() } : rec,
              ),
            }
          : m,
      ),
    );
  }

  return (
    <div className="page stack field-mode">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Avisos</h1>
          <p className="page-header__subtitle">Mensagens da escolinha.</p>
        </div>
      </header>
      <ul className="plain card card--lg">
        {rows.length === 0 ? (
          <li className="muted" style={{ padding: 'var(--space-4)' }}>
            Por enquanto não há avisos. Quando a escolinha enviar uma mensagem, ela aparece aqui.
          </li>
        ) : null}
        {rows.map((m) => (
          <li key={m.id} className="list-row stack" style={{ gap: 'var(--space-3)' }}>
            <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
              <strong>{m.title}</strong>
              {m.recipients[0]?.readAt ? (
                <span className="badge badge--ok">Lida</span>
              ) : (
                <span className="badge badge--info">Nova</span>
              )}
            </div>
            <span className="text-caption">{formatDateTimeBR(m.createdAt)}</span>
            <p className="text-body">{m.body}</p>
            {!m.recipients[0]?.readAt ? (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => void read(m.id)}>
                Marcar como lida
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
