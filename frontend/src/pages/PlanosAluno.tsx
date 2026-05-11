import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { PlanStatusBadge } from '../components/PlanStatusBadge';
import { apiFetch } from '../lib/api';

type PlanRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  goal: string | null;
  _count?: { sessions: number };
};

export default function PlanosAluno() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [studentName, setStudentName] = useState('');
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const canPrescribe =
    user?.role === 'ADMIN' || (user?.role === 'TREINADOR' && user?.staffProfile?.active);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [st, list] = await Promise.all([
          apiFetch<{ fullName: string }>(`/students/${id}`),
          apiFetch<PlanRow[]>(`/students/${id}/individual-plans`),
        ]);
        setStudentName(st.fullName);
        setPlans(list);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro');
      }
    })();
  }, [id]);

  if (user?.role === 'ATLETA') return <Navigate to="/" replace />;
  if (!canPrescribe) return <Navigate to={`/alunos/${id}`} replace />;

  if (err) {
    return (
      <div className="page stack">
        <Banner variant="danger">{err}</Banner>
        <Link to={`/alunos/${id}`}>Voltar</Link>
      </div>
    );
  }

  return (
    <div className="page stack">
      <nav className="text-caption">
        <Link to={`/alunos/${id}`}>← {studentName || 'Aluno'}</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Planos individuais</h1>
          <p className="page-header__subtitle">{studentName}</p>
        </div>
        <Link to={`/alunos/${id}/planos/novo`} className="btn btn-primary">
          Novo plano
        </Link>
      </header>

      {plans.length === 0 ? (
        <div className="card card--lg stack">
          <p className="muted">Nenhum plano ainda. Crie um rascunho e publique quando estiver pronto.</p>
        </div>
      ) : (
        <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
          {plans.map((p) => (
            <li key={p.id} className="card stack" style={{ padding: 'var(--space-4)' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                  <strong>{p.title}</strong>
                  <span className="muted"> · {p.type}</span>
                  <div className="text-caption muted">
                    {p._count != null ? `${p._count.sessions} sessão(ões)` : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                  <PlanStatusBadge status={p.status} />
                  <Link to={`/alunos/${id}/planos/${p.id}`} className="btn btn-secondary">
                    Abrir
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
