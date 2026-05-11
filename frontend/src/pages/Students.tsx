import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';

type Row = {
  id: string;
  fullName: string;
  active: boolean;
  _count?: { enrollments: number };
};

export default function Students() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const data = await apiFetch<Row[]>('/students');
    setRows(data);
  }, []);

  useEffect(() => {
    return runDeferredEffect(() => {
      void load().catch((e) => {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar alunos.');
        setErr(msg);
        toast.error(msg);
      });
    });
  }, [load, toast]);

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Alunos</h1>
          <p className="page-header__subtitle">Lista de atletas do tenant e turmas vinculadas.</p>
        </div>
      </header>

      {isAdmin ? (
        <p className="admin-hint">
          Para <strong>cadastrar</strong> aluno, responsável ou vínculo, use{' '}
          <Link to="/gestao">Gestão</Link>. Toque em um aluno para ver responsáveis e turmas.
        </p>
      ) : (
        <p className="admin-hint">
          Como treinador, você vê apenas alunos das suas turmas. Cadastros são feitos pelo admin.
        </p>
      )}

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      <ul className="plain card card--lg card--list">
        {rows.map((s) => (
          <li key={s.id} className="card-list-item">
            <Link className="interactive-row" to={`/alunos/${s.id}`}>
              <div className="row list-row__head">
                <strong className="list-row__title">{s.fullName}</strong>
                <span
                  className={`badge ${s.active ? 'badge--ok' : 'badge--neutral'}`}
                  aria-label={s.active ? 'Ativo' : 'Inativo'}
                >
                  {s.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {s._count ? (
                <p className="text-caption tabular-nums list-row__meta">{s._count.enrollments} turma(s)</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
