import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateBR } from '../lib/format-date';
import { Banner } from '../components/Banner';
import EvolutionList from '../components/EvolutionList';

type StudentMini = { id: string; fullName: string };
type Ch = {
  id: string;
  amountCents: number;
  dueDate: string;
  status: string;
};

export default function Filho() {
  const { studentId } = useParams<{ studentId: string }>();
  const [name, setName] = useState<string>('');
  const [charges, setCharges] = useState<Ch[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    return runDeferredEffect(() => {
      void apiFetch<StudentMini>(`/students/${studentId}`)
        .then((s) => {
          setErr(null);
          setName(s.fullName);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
    });
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    return runDeferredEffect(() => {
      void apiFetch<Ch[]>(`/finance/students/${studentId}/extrato`).then(setCharges);
    });
  }, [studentId]);

  return (
    <div className="page stack field-mode">
      <nav className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
        <Link to="/filhos">← Meus filhos</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">{name || 'Atleta'}</h1>
          <p className="page-header__subtitle">Extrato e evolução no treino.</p>
        </div>
      </header>

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      <div className="card stack card--lg">
        <h2 className="text-h3">Extrato</h2>
        <ul className="plain">
          {charges.map((c) => (
            <li key={c.id} className="list-row">
              <p className="tabular-nums text-body" style={{ margin: 0 }}>
                R$ {(c.amountCents / 100).toFixed(2)} · venc. {formatDateBR(c.dueDate)}
              </p>
              <span
                className={`badge ${c.status === 'PAGO' ? 'badge--ok' : c.status === 'ATRASADO' ? 'badge--danger' : 'badge--warning'}`}
                style={{ marginTop: 'var(--space-2)' }}
              >
                {c.status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card stack card--lg">
        <h2 className="text-h3">Evolução</h2>
        {studentId ? <EvolutionList studentId={studentId} /> : null}
      </div>

      {studentId ? (
        <div className="card stack card--lg">
          <h2 className="text-h3">Planos individuais</h2>
          <p className="text-caption muted" style={{ marginTop: 0 }}>
            Acompanhamentos prescritos pela equipe.
          </p>
          <Link to={`/filhos/${studentId}/planos`} className="btn btn-secondary">
            Ver acompanhamentos
          </Link>
        </div>
      ) : null}

      {studentId ? (
        <p className="text-caption">
          <Link to={`/filhos/${studentId}/relatorios`}>Relatórios publicados</Link>
        </p>
      ) : null}
    </div>
  );
}
