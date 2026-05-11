import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';

type TurmaDetail = {
  id: string;
  name: string;
  capacity: number;
  ageRangeText: string | null;
  weekDaysText: string | null;
  scheduleText: string | null;
  location: string | null;
  categoryLabel: string | null;
  coach: { id: string; fullName: string; email: string };
  enrollments: { student: { id: string; fullName: string } }[];
};

export default function TurmaDetail() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TurmaDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void apiFetch<TurmaDetail>(`/turmas/${id}`)
      .then(setData)
      .catch((e) => {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar turma.');
        setErr(msg);
        toast.error(msg);
      });
  }, [id, toast]);

  if (err) {
    return (
      <div className="page stack">
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
        <Link to="/turmas">Voltar para turmas</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page muted" style={{ paddingTop: '2rem' }}>
        Carregando…
      </div>
    );
  }

  const n = data.enrollments.length;

  return (
    <div className="page stack">
      <nav className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
        <Link to="/turmas">← Turmas</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">{data.name}</h1>
          <p className="page-header__subtitle">
            {n} / {data.capacity} alunos · Técnico: {data.coach.fullName}
          </p>
        </div>
      </header>

      <div className="card card--lg stack">
        <h2 className="text-h3">Detalhes</h2>
        <div className="detail-kv">
          {data.ageRangeText ? (
            <span>
              <span className="muted">Faixa etária</span> {data.ageRangeText}
            </span>
          ) : null}
          {data.weekDaysText ? (
            <span>
              <span className="muted">Dias</span> {data.weekDaysText}
            </span>
          ) : null}
          {data.scheduleText ? (
            <span>
              <span className="muted">Horário</span> {data.scheduleText}
            </span>
          ) : null}
          {data.location ? (
            <span className="detail-kv__full">
              <span className="muted">Local</span> {data.location}
            </span>
          ) : null}
          {data.categoryLabel ? (
            <span>
              <span className="muted">Categoria</span> {data.categoryLabel}
            </span>
          ) : null}
          <span className="detail-kv__full">
            <span className="muted">E-mail do técnico</span> {data.coach.email}
          </span>
        </div>
      </div>

      <div className="card card--lg stack">
        <h2 className="text-h3">Alunos matriculados</h2>
        {data.enrollments.length === 0 ? (
          <p className="muted">Nenhum aluno nesta turma.</p>
        ) : (
          <ul className="plain">
            {data.enrollments.map((e) => (
              <li key={e.student.id} className="list-row">
                <Link to={`/alunos/${e.student.id}`}>{e.student.fullName}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
