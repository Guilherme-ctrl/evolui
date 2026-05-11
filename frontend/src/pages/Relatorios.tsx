import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateBR } from '../lib/format-date';

type ReportRow = {
  id: string;
  title: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  student: { id: string; fullName: string };
};

type StudentOpt = { id: string; fullName: string };

export default function Relatorios() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [studentId, setStudentId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [title, setTitle] = useState('Relatório do período');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([
      apiFetch<ReportRow[]>('/reports?take=50'),
      apiFetch<StudentOpt[]>('/students?take=200'),
    ]);
    setRows(r);
    setStudents(s);
    setStudentId((cur) => cur || (s[0]?.id ?? ''));
  }, []);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    return runDeferredEffect(() => {
      void load().catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
    });
  }, [user?.role, load]);

  if (!user) return null;
  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const gerar = async () => {
    setErr(null);
    if (!studentId || !periodStart || !periodEnd) {
      setErr('Preencha aluno e período.');
      return;
    }
    setLoading(true);
    try {
      const rep = await apiFetch<{ id: string }>('/reports/aggregate', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          periodStart,
          periodEnd,
          title: title.trim() || 'Relatório do período',
        }),
      });
      toast.success('Rascunho criado com agregado.');
      await load();
      navigate(`/relatorios/${rep.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Relatórios para famílias</h1>
          <p className="page-header__subtitle">
            Gere rascunhos com presença, avaliações, mídias e eventos — revise e publique.
          </p>
        </div>
      </header>

      <div className="card card--lg stack">
        <h2 className="text-h3">Gerar agregado</h2>
        <label className="stack">
          <span className="muted">Aluno</span>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </label>
        <div className="row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <label className="stack" style={{ flex: '1 1 12rem' }}>
            <span className="muted">Início</span>
            <input
              type="date"
              lang="pt-BR"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </label>
          <label className="stack" style={{ flex: '1 1 12rem' }}>
            <span className="muted">Fim</span>
            <input
              type="date"
              lang="pt-BR"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </label>
        </div>
        <label className="stack">
          <span className="muted">Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {err ? (
          <Banner variant="danger" onDismiss={() => setErr(null)}>
            {err}
          </Banner>
        ) : null}
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => void gerar()}
        >
          {loading ? 'Gerando…' : 'Gerar agregado'}
        </button>
      </div>

      <div className="card card--lg stack">
        <h2 className="text-h3">Últimos relatórios</h2>
        <ul className="plain">
          {rows.map((r) => (
            <li key={r.id} className="list-row stack" style={{ gap: 'var(--space-2)' }}>
              <Link to={`/relatorios/${r.id}`} className="list-row__title">
                {r.title}
              </Link>
              <p className="text-caption muted" style={{ margin: 0 }}>
                {r.student.fullName} · {formatDateBR(r.periodStart)} — {formatDateBR(r.periodEnd)} ·{' '}
                <span
                  className={`badge ${r.status === 'PUBLISHED' ? 'badge--ok' : 'badge--warning'}`}
                >
                  {r.status}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
