import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../../components/Banner';
import { useToast } from '../../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../../lib/api';
import { formatTimeBR } from '../../lib/format-date';

type DashboardHomeResponse = {
  generatedAt: string;
  students: { active: number; inactive: number };
  professionalsActive: number;
  finance: {
    delinquentCharges: number;
    delinquentAmountCents: number;
    topStudents: Array<{
      studentId: string;
      fullName: string;
      charges: number;
      totalCents: number;
      oldestDueDate: string;
      daysOverdue: number;
    }>;
  };
  todayEvents: {
    total: number;
    byType: Record<string, number>;
    items: Array<{
      id: string;
      title: string;
      type: string;
      startsAt: string;
      endsAt: string;
      status: string;
      isWholeSchool: boolean;
      turmas: Array<{ turmaId: string; turma: { id: string; name: string } }>;
    }>;
  };
  physicalFeedbackWeek: {
    eligible: number;
    withFeedback: number;
    pct: number | null;
    windowFrom: string;
    windowTo: string;
  };
  evaluations: {
    periodFrom: string;
    periodTo: string;
    activeStudents: number;
    distinctStudentsEvaluated: number;
    totalEvaluations: number;
    percentage: number | null;
  };
};

export function HomeAdmin() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [home, setHome] = useState<DashboardHomeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiFetch<DashboardHomeResponse>('/dashboard/home');
        if (!cancelled) setHome(data);
      } catch (e) {
        if (!cancelled) {
          const msg = errorMessageFromUnknown(
            e,
            'Não foi possível carregar a visão geral.',
          );
          setErr(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const todayBreakdownText = home
    ? Object.entries(home.todayEvents.byType)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ') || 'sem agenda'
    : '—';

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      {err ? <Banner variant="danger">{err}</Banner> : null}

      {loading || !home ? (
        <AdminHomeSkeleton />
      ) : (
        <>
          {/* 1) KPIS DO TOPO */}
          <section className="card stack card--lg" aria-labelledby="home-admin-kpis">
            <h2 id="home-admin-kpis" className="text-h3" style={{ margin: 0 }}>
              Resumo do dia
            </h2>
            <div
              className="row"
              style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}
            >
              <Kpi
                label="Pagamentos atrasados"
                value={String(home.finance.delinquentCharges)}
                hint={
                  home.finance.delinquentAmountCents > 0
                    ? `R$ ${(home.finance.delinquentAmountCents / 100).toFixed(2)} acumulados`
                    : undefined
                }
                href="/financeiro"
              />
              <Kpi
                label="Eventos hoje"
                value={String(home.todayEvents.total)}
                hint={todayBreakdownText}
                href="/calendario"
              />
              <Kpi
                label="Avaliações do mês"
                value={
                  home.evaluations.percentage != null
                    ? `${home.evaluations.percentage.toFixed(1)}%`
                    : '—'
                }
                hint={`${home.evaluations.distinctStudentsEvaluated}/${home.evaluations.activeStudents} alunos`}
                href="/avaliacoes"
              />
              <Kpi
                label="Feedback físico (semana)"
                value={
                  home.physicalFeedbackWeek.pct != null
                    ? `${home.physicalFeedbackWeek.pct.toFixed(1)}%`
                    : '—'
                }
                hint={
                  home.physicalFeedbackWeek.eligible > 0
                    ? `${home.physicalFeedbackWeek.withFeedback}/${home.physicalFeedbackWeek.eligible} eventos com resposta`
                    : 'sem eventos elegíveis na semana'
                }
                href="/treinos/historico"
              />
            </div>
            <div
              className="row"
              style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}
            >
              <span className="text-caption muted">
                Alunos ativos:{' '}
                <strong className="tabular-nums">{home.students.active}</strong>
              </span>
              <span className="text-caption muted">
                Profissionais ativos:{' '}
                <strong className="tabular-nums">{home.professionalsActive}</strong>{' '}
                · <Link to="/gestao/profissionais">gerenciar</Link>
              </span>
            </div>
          </section>

          {/* 2) EVENTOS DE HOJE */}
          <section
            className="card stack card--lg"
            aria-labelledby="home-admin-today"
          >
            <h2 id="home-admin-today" className="text-h3" style={{ margin: 0 }}>
              Eventos de hoje
            </h2>
            {home.todayEvents.items.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Nenhum evento programado para hoje.
              </p>
            ) : (
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {home.todayEvents.items.map((ev) => (
                  <li
                    key={ev.id}
                    className="row"
                    style={{
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <strong className="tabular-nums">
                      {formatTimeBR(ev.startsAt)}
                    </strong>
                    <span className="badge badge--neutral">{ev.type}</span>
                    <strong>{ev.title}</strong>
                    <span className="text-caption muted">
                      ·{' '}
                      {ev.isWholeSchool
                        ? 'Toda a escolinha'
                        : ev.turmas.map((t) => t.turma.name).join(', ') || '—'}
                    </span>
                    {ev.status === 'CANCELLED' ? (
                      <span className="badge badge--danger">CANCELADO</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/calendario" className="text-caption">
              Abrir calendário
            </Link>
          </section>

          {/* 3) TOP 3 INADIMPLENTES */}
          {home.finance.topStudents.length > 0 ? (
            <section
              className="card stack card--lg"
              aria-labelledby="home-admin-top-delinq"
            >
              <h2
                id="home-admin-top-delinq"
                className="text-h3"
                style={{ margin: 0 }}
              >
                Inadimplência — atenção prioritária
              </h2>
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {home.finance.topStudents.map((d) => (
                  <li
                    key={d.studentId}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      <strong>{d.fullName}</strong>
                      <span className="text-caption muted">
                        {' '}
                        · {d.charges} cobrança
                        {d.charges === 1 ? '' : 's'} · {d.daysOverdue} dia
                        {d.daysOverdue === 1 ? '' : 's'} desde a mais antiga
                      </span>
                    </span>
                    <span
                      className="row"
                      style={{ gap: 'var(--space-2)', alignItems: 'center' }}
                    >
                      <span className="tabular-nums">
                        <strong>R$ {(d.totalCents / 100).toFixed(2)}</strong>
                      </span>
                      <Link
                        to={`/alunos/${d.studentId}`}
                        className="btn btn-ghost"
                      >
                        Extrato
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/financeiro" className="text-caption">
                Ver toda a inadimplência
              </Link>
            </section>
          ) : null}

          {/* 4) AÇÕES SUGERIDAS */}
          <section
            className="card stack card--lg"
            aria-labelledby="home-admin-actions"
          >
            <h2 id="home-admin-actions" className="text-h3" style={{ margin: 0 }}>
              Ações sugeridas
            </h2>
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <Link to="/comunicacoes" className="btn btn-secondary">
                Enviar comunicado
              </Link>
              <Link to="/financeiro" className="btn btn-secondary">
                Inadimplência
              </Link>
              <Link to="/relatorios" className="btn btn-secondary">
                Relatórios
              </Link>
              <Link to="/dashboard" className="btn btn-ghost">
                Dashboard completo
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AdminHomeSkeleton() {
  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }} aria-busy="true">
      <section className="card stack card--lg">
        <h2 className="text-h3" style={{ margin: 0 }}>
          Resumo do dia
        </h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          {['Pagamentos', 'Eventos', 'Avaliações', 'Feedback'].map((label) => (
            <div
              key={label}
              className="card stack"
              style={{
                flex: '1 1 12rem',
                padding: 'var(--space-4)',
                border: '1px solid var(--color-border-subtle, #e5e5e5)',
                borderRadius: 'var(--radius-md, 8px)',
              }}
            >
              <span className="text-caption muted">{label}</span>
              <strong className="tabular-nums" style={{ fontSize: '1.5rem' }}>
                …
              </strong>
            </div>
          ))}
        </div>
      </section>
      <section className="card card--lg stack">
        <h2 className="text-h3" style={{ margin: 0 }}>
          Eventos de hoje
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Carregando agenda…
        </p>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="text-caption muted">{label}</span>
      <strong className="tabular-nums" style={{ fontSize: '1.5rem' }}>
        {value}
      </strong>
      {hint ? <span className="text-caption muted">{hint}</span> : null}
    </>
  );
  const style = {
    flex: '1 1 12rem',
    padding: 'var(--space-4)',
    border: '1px solid var(--color-border-subtle, #e5e5e5)',
    borderRadius: 'var(--radius-md, 8px)',
    textDecoration: 'none',
    color: 'inherit',
  } as const;
  if (href) {
    return (
      <Link to={href} className="card stack" style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div className="card stack" style={style}>
      {content}
    </div>
  );
}
