import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banner } from '../components/Banner';
import { PlanStatusBadge } from '../components/PlanStatusBadge';
import { apiFetch } from '../lib/api';

type Exercise = {
  id: string;
  name: string;
  description: string | null;
  sets: number | null;
  repetitions: number | null;
};

type Session = {
  id: string;
  title: string;
  instructions: string | null;
  exercises: Exercise[];
};

type PlanDetail = {
  id: string;
  title: string;
  type: string;
  goal: string | null;
  status: string;
  startDate: string;
  completionNote: string | null;
  student: { fullName: string };
  assignedProfessional: { user: { fullName: string }; professionalType: string };
  sessions: Session[];
};

export default function FilhoPlanoDetail() {
  const { studentId, planId } = useParams<{ studentId: string; planId: string }>();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    void apiFetch<PlanDetail>(`/guardian/individual-plans/${planId}`)
      .then(setPlan)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [planId]);

  if (err) {
    return (
      <div className="page stack">
        <Banner variant="danger">{err}</Banner>
        <Link to={`/filhos/${studentId}/planos`}>Voltar</Link>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="page muted" style={{ paddingTop: '2rem' }}>
        Carregando…
      </div>
    );
  }

  return (
    <div className="page stack">
      <nav className="text-caption">
        <Link to={`/filhos/${studentId}/planos`}>← Acompanhamentos · {plan.student.fullName}</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">{plan.title}</h1>
          <p className="page-header__subtitle">
            <PlanStatusBadge status={plan.status} /> · Prescrito por{' '}
            {plan.assignedProfessional.user.fullName}
          </p>
        </div>
      </header>

      <div className="card card--lg stack">
        {plan.goal ? (
          <div>
            <h2 className="text-h3">Objetivo</h2>
            <p className="text-body" style={{ margin: 0 }}>
              {plan.goal}
            </p>
          </div>
        ) : null}
        <p className="text-caption muted" style={{ margin: 0 }}>
          Período a partir de {plan.startDate.slice(0, 10)}. Este conteúdo é voltado à evolução do atleta,
          sem comparação com outros alunos.
        </p>
      </div>

      {plan.sessions.length ? (
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          {plan.sessions.map((s) => (
            <div key={s.id} className="card stack card--lg">
              <h2 className="text-h3">{s.title}</h2>
              {s.instructions ? <p className="text-body">{s.instructions}</p> : null}
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {s.exercises.map((ex) => (
                  <li key={ex.id} className="text-body">
                    <strong>{ex.name}</strong>
                    {ex.description ? <span className="muted"> — {ex.description}</span> : null}
                    {ex.sets != null || ex.repetitions != null ? (
                      <div className="text-caption muted">
                        {ex.sets != null ? `${ex.sets} séries` : ''}
                        {ex.repetitions != null ? ` · ${ex.repetitions} reps` : ''}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {plan.completionNote ? (
        <div className="card card--lg stack">
          <h2 className="text-h3">Encerramento</h2>
          <p className="text-body" style={{ margin: 0 }}>
            {plan.completionNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}
