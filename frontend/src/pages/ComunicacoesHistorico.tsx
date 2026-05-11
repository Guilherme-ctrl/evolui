import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateTimeBR } from '../lib/format-date';

type Row = {
  id: string;
  scope: string;
  title: string;
  body: string;
  createdAt: string;
  turma: { id: string; name: string } | null;
  calendarEvent: { id: string; title: string; startsAt: string } | null;
};

type TurmaOpt = { id: string; name: string };

const SCOPES = [
  { value: '', label: 'Todos os escopos' },
  { value: 'GLOBAL', label: 'Global' },
  { value: 'TURMA', label: 'Turma' },
  { value: 'DIRECT', label: 'Direto' },
];

export default function ComunicacoesHistorico() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [filterScope, setFilterScope] = useState('');
  const [filterTurma, setFilterTurma] = useState('');
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isTreinador = user?.role === 'TREINADOR';

  const loadTurmas = useCallback(async () => {
    const t = await apiFetch<TurmaOpt[]>('/turmas');
    setTurmas(t);
  }, []);

  const loadPage = useCallback(
    async (c?: string, append = false) => {
      setErr(null);
      const params = new URLSearchParams();
      params.set('take', '20');
      if (c) params.set('cursor', c);
      if (filterScope) params.set('scope', filterScope);
      if (filterTurma) params.set('turmaId', filterTurma);
      const list = await apiFetch<Row[]>(
        `/communications/messages/authored?${params.toString()}`,
      );
      const cap = 20;
      const hasMore = list.length > cap;
      const page = hasMore ? list.slice(0, cap) : list;
      setNextCursor(hasMore ? page[page.length - 1]?.id : undefined);
      if (append) {
        setRows((prev) => [...prev, ...page]);
      } else {
        setRows(page);
      }
    },
    [filterScope, filterTurma],
  );

  useEffect(() => {
    if (!isAdmin && !isTreinador) return;
    return runDeferredEffect(() => {
      void loadTurmas().catch(() => {
        /* ignore */
      });
    });
  }, [isAdmin, isTreinador, loadTurmas]);

  useEffect(() => {
    if (!isAdmin && !isTreinador) return;
    return runDeferredEffect(() => {
      void loadPage(undefined, false).catch((e) =>
        setErr(e instanceof Error ? e.message : 'Erro ao carregar'),
      );
    });
  }, [isAdmin, isTreinador, loadPage, filterScope, filterTurma]);

  if (!user) return null;
  if (!isAdmin && !isTreinador) return <Navigate to="/" replace />;

  const loadMore = () => {
    if (!nextCursor) return;
    void loadPage(nextCursor, true).catch((e) =>
      setErr(e instanceof Error ? e.message : 'Erro'),
    );
  };

  return (
    <div className="page stack">
      <nav className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
        <Link to="/comunicacoes">← Nova mensagem</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Histórico de envios</h1>
          <p className="page-header__subtitle">
            Somente mensagens que você mesmo enviou. Use os filtros para refinar.
          </p>
        </div>
      </header>

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      <div className="row stack" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <label className="stack" style={{ flex: '1 1 12rem' }}>
          <span className="muted">Escopo</span>
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
          >
            {SCOPES.map((s) => (
              <option key={s.value || 'all'} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ flex: '1 1 12rem' }}>
          <span className="muted">Turma (opcional)</span>
          <select
            value={filterTurma}
            onChange={(e) => setFilterTurma(e.target.value)}
          >
            <option value="">Qualquer</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="muted card card--lg">
          Você ainda não enviou mensagens com esses filtros. Que tal{' '}
          <Link to="/comunicacoes">escrever o primeiro aviso</Link>?
        </p>
      ) : (
        <ul className="plain card card--lg stack" style={{ gap: 'var(--space-4)' }}>
          {rows.map((m) => (
            <li key={m.id} className="stack" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-4)' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <strong>{m.title}</strong>
                <span className="badge badge--neutral">{m.scope}</span>
              </div>
              <span className="text-caption">{formatDateTimeBR(m.createdAt)}</span>
              {m.turma ? (
                <span className="text-caption muted">Turma: {m.turma.name}</span>
              ) : null}
              {m.calendarEvent ? (
                <span className="text-caption muted">
                  Evento: {m.calendarEvent.title}
                </span>
              ) : null}
              <p className="text-body" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {m.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <button type="button" className="btn btn-secondary" onClick={() => loadMore()}>
          Carregar mais
        </button>
      ) : null}
    </div>
  );
}
