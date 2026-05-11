import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banner } from '../components/Banner';
import { PlanStatusBadge } from '../components/PlanStatusBadge';
import { apiFetch } from '../lib/api';

type PlanRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: string;
};

type StudentMini = { fullName: string };

export default function FilhoPlanos() {
  const { studentId } = useParams<{ studentId: string }>();
  const [name, setName] = useState('');
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    void (async () => {
      try {
        const [st, list] = await Promise.all([
          apiFetch<StudentMini>(`/students/${studentId}`),
          apiFetch<PlanRow[]>(`/guardian/children/${studentId}/individual-plans`),
        ]);
        setName(st.fullName);
        setPlans(list);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro');
      }
    })();
  }, [studentId]);

  if (err) {
    return (
      <div className="page stack">
        <Banner variant="danger">{err}</Banner>
        <Link to={`/filhos/${studentId}`}>Voltar</Link>
      </div>
    );
  }

  return (
    <div className="page stack">
      <nav className="text-caption">
        <Link to={`/filhos/${studentId}`}>← {name || 'Atleta'}</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Acompanhamentos</h1>
          <p className="page-header__subtitle">{name}</p>
        </div>
      </header>

      {plans.length === 0 ? (
        <div className="card card--lg stack">
          <p className="muted">
            Quando houver um acompanhamento individual para {name || 'seu filho'}, ele aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
          {plans.map((p) => (
            <li key={p.id} className="card stack" style={{ padding: 'var(--space-4)' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                  <strong>{p.title}</strong>
                  <span className="muted"> · {p.type}</span>
                  <div className="text-caption muted">Início {p.startDate.slice(0, 10)}</div>
                </div>
                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                  <PlanStatusBadge status={p.status} />
                  <Link to={`/filhos/${studentId}/planos/${p.id}`} className="btn btn-secondary">
                    Ver detalhe
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
