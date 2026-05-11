import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banner } from '../components/Banner';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateBR } from '../lib/format-date';

type Pub = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string | null;
};

export default function FilhoRelatorios() {
  const { studentId } = useParams<{ studentId: string }>();
  const [rows, setRows] = useState<Pub[]>([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    return runDeferredEffect(() => {
      void (async () => {
        try {
          setErr(null);
          const [s, r] = await Promise.all([
            apiFetch<{ fullName: string }>(`/students/${studentId}`),
            apiFetch<Pub[]>(`/reports/students/${studentId}`),
          ]);
          setName(s.fullName);
          setRows(r);
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Erro');
        }
      })();
    });
  }, [studentId]);

  return (
    <div className="page stack field-mode">
      <nav className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
        <Link to={`/filhos/${studentId ?? ''}`}>← {name || 'Atleta'}</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Relatórios · {name || '…'}</h1>
          <p className="page-header__subtitle">Somente relatórios já publicados pela escolinha.</p>
        </div>
      </header>

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      <ul className="plain card card--lg">
        {rows.length === 0 ? (
          <li className="muted">Nenhum relatório publicado ainda.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="list-row stack" style={{ gap: 'var(--space-2)' }}>
              <Link to={`/relatorios/${r.id}`} className="list-row__title">
                {r.title}
              </Link>
              <p className="text-caption muted" style={{ margin: 0 }}>
                {formatDateBR(r.periodStart)} — {formatDateBR(r.periodEnd)}
                {r.publishedAt ? ` · publicado ${formatDateBR(r.publishedAt)}` : null}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
