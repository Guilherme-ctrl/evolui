import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';

type Row = {
  id: string;
  name: string;
  capacity: number;
  coach: { fullName: string };
  _count?: { enrollments: number };
};

export default function Turmas() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const loadTurmas = useCallback(async () => {
    setErr(null);
    const data = await apiFetch<Row[]>('/turmas');
    setRows(data);
  }, []);

  useEffect(() => {
    return runDeferredEffect(() => {
      void loadTurmas().catch((e) => {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar turmas.');
        setErr(msg);
        toast.error(msg);
      });
    });
  }, [loadTurmas, toast]);

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Turmas</h1>
          <p className="page-header__subtitle">Capacidade, técnico e matrículas.</p>
        </div>
      </header>

      {isAdmin ? (
        <p className="admin-hint">
          Para <strong>criar turma</strong> ou <strong>matricular</strong> alunos, use{' '}
          <Link to="/gestao">Gestão</Link>. Toque em uma turma para ver detalhes e alunos.
        </p>
      ) : (
        <p className="admin-hint">Turmas em que você é o técnico responsável.</p>
      )}

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      <ul className="plain card card--lg card--list">
        {rows.map((t) => (
          <li key={t.id} className="card-list-item">
            <Link className="interactive-row" to={`/turmas/${t.id}`}>
              <strong className="list-row__title">{t.name}</strong>
              <p className="text-caption list-row__meta">Técnico: {t.coach.fullName}</p>
              <p className="text-caption tabular-nums list-row__meta">
                {t._count?.enrollments ?? 0} / {t.capacity} alunos
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
