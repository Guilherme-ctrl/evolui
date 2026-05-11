import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Banner } from '../../components/Banner';
import { type FeedbackDimension } from '../../components/FeedbackDimensionsEditor';
import { PlanStatusBadge } from '../../components/PlanStatusBadge';
import { useToast } from '../../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../../lib/api';
import { formatDateBR, formatTimeBR } from '../../lib/format-date';
import {
  isActiveEvent,
  isSameLocalDay,
  startOfLocalDay,
} from './calendar-utils';
import type { CalEventApi } from './types';

type TurmaRow = {
  id: string;
  name: string;
  _count?: { enrollments: number };
};

type CoachRow = {
  eventId: string;
  title: string;
  type: string;
  startsAt: string;
  turmaId: string;
  turmaName: string;
  expectedStudents: number | null;
};

type RecentPlan = {
  id: string;
  status: string;
  title: string;
  student: { id: string; fullName: string };
};

type OverviewStaffEvent = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  isWholeSchool: boolean;
  turmas: { turmaId: string; turma: { name: string } }[];
  feedbackCount: number;
  averages: Array<{
    key: string;
    label: string;
    count: number;
    average: number | null;
  }>;
  effectiveFeedbackDimensions: FeedbackDimension[];
};

type OverviewStaffResponse = {
  events: OverviewStaffEvent[];
  nextCursor: string | null;
};

export function HomeCoach() {
  const toast = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [turmasById, setTurmasById] = useState<Map<string, TurmaRow>>(new Map());
  const [events, setEvents] = useState<CalEventApi[]>([]);
  const [recentPlans, setRecentPlans] = useState<RecentPlan[]>([]);
  const [lastFeedback, setLastFeedback] = useState<OverviewStaffEvent | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const from = startOfLocalDay();
        const to = new Date(from);
        to.setDate(to.getDate() + 7);

        const pastFrom = new Date(from);
        pastFrom.setDate(pastFrom.getDate() - 30);

        const [turmas, evs, plans, overview] = await Promise.all([
          apiFetch<TurmaRow[]>('/turmas?take=50'),
          apiFetch<CalEventApi[]>(
            `/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}&take=40`,
          ),
          user?.staffProfile?.active
            ? apiFetch<RecentPlan[]>('/individual-plans/recent').catch(
                () => [] as RecentPlan[],
              )
            : Promise.resolve([] as RecentPlan[]),
          apiFetch<OverviewStaffResponse>(
            `/calendar/events/feedback-overview?from=${pastFrom.toISOString()}&to=${new Date().toISOString()}&take=15`,
          ).catch(
            () =>
              ({ events: [], nextCursor: null }) as OverviewStaffResponse,
          ),
        ]);
        if (cancelled) return;
        const map = new Map<string, TurmaRow>();
        for (const t of turmas) map.set(t.id, t);
        setTurmasById(map);
        setEvents(evs.filter(isActiveEvent));
        setRecentPlans(plans.slice(0, 3));
        const withFeedback = overview.events
          .filter((e) => e.feedbackCount > 0)
          .sort(
            (a, b) =>
              new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
          );
        setLastFeedback(withFeedback[0] ?? null);
      } catch (e) {
        if (!cancelled) {
          const msg = errorMessageFromUnknown(e, 'Não foi possível carregar sua agenda.');
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
  }, [user?.staffProfile?.active, toast]);

  /**
   * Expande os eventos por turma do treinador. Inclui eventos da escola
   * inteira (uma linha "Toda a escolinha"). Mantém o tipo do evento para
   * podermos diferenciar o CTA (presença para TREINO, detalhes para o resto).
   */
  const expanded = useMemo((): CoachRow[] => {
    const rows: CoachRow[] = [];
    for (const ev of events) {
      if (ev.isWholeSchool || ev.turmas.length === 0) {
        rows.push({
          eventId: ev.id,
          title: ev.title,
          type: ev.type,
          startsAt: ev.startsAt,
          turmaId: '',
          turmaName: 'Toda a escolinha',
          expectedStudents: null,
        });
        continue;
      }
      for (const link of ev.turmas) {
        const t = turmasById.get(link.turmaId);
        if (!t) continue;
        rows.push({
          eventId: ev.id,
          title: ev.title,
          type: ev.type,
          startsAt: ev.startsAt,
          turmaId: link.turmaId,
          turmaName: link.turma.name,
          expectedStudents: t._count?.enrollments ?? null,
        });
      }
    }
    rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return rows;
  }, [events, turmasById]);

  const today = useMemo(() => {
    const now = new Date();
    return expanded.filter((r) => isSameLocalDay(new Date(r.startsAt), now));
  }, [expanded]);

  const later = useMemo(() => {
    const now = new Date();
    return expanded.filter((r) => !isSameLocalDay(new Date(r.startsAt), now));
  }, [expanded]);

  const todayShow = today.slice(0, 6);
  const laterShow = later.slice(0, 4);

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      {err ? <Banner variant="danger">{err}</Banner> : null}

      {loading ? (
        <CoachHomeSkeleton />
      ) : (
        <>
          {/* 1) COMPROMISSOS DO DIA */}
          <section
            className="card stack card--lg"
            aria-labelledby="home-coach-today"
          >
            <h2 id="home-coach-today" className="text-h3" style={{ margin: 0 }}>
              Compromissos de hoje
            </h2>
            {todayShow.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Nenhum compromisso seu agendado para hoje.
              </p>
            ) : (
              <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
                {todayShow.map((r) => (
                  <li
                    key={`${r.eventId}-${r.turmaId || 'all'}`}
                    className="stack"
                    style={{ gap: 'var(--space-2)' }}
                  >
                    <div
                      className="row"
                      style={{
                        gap: 'var(--space-2)',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <strong className="tabular-nums">
                        {formatTimeBR(r.startsAt)}
                      </strong>
                      <span className="badge badge--neutral">{r.type}</span>
                      <strong>{r.turmaName}</strong>
                      {r.expectedStudents != null ? (
                        <span className="text-caption muted">
                          · {r.expectedStudents} aluno
                          {r.expectedStudents === 1 ? '' : 's'}
                        </span>
                      ) : null}
                      <span className="muted">· {r.title}</span>
                    </div>
                    {r.turmaId && r.type === 'TREINO' ? (
                      <Link
                        className="btn btn-field-cta btn-block"
                        to={`/presenca?turmaId=${encodeURIComponent(r.turmaId)}&eventId=${encodeURIComponent(r.eventId)}`}
                      >
                        Abrir presença
                      </Link>
                    ) : (
                      <Link className="btn btn-secondary btn-block" to="/calendario">
                        Ver no calendário
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {today.length > todayShow.length ? (
              <Link to="/calendario" className="text-caption">
                Ver mais no calendário
              </Link>
            ) : null}
          </section>

          {/* 2) FEEDBACK DO ÚLTIMO TREINO */}
          {lastFeedback ? (
            <section
              className="card stack card--lg"
              aria-labelledby="home-coach-last-feedback"
            >
              <h2
                id="home-coach-last-feedback"
                className="text-h3"
                style={{ margin: 0 }}
              >
                Feedback do último treino
              </h2>
              <div className="stack" style={{ gap: 0 }}>
                <strong className="text-body">{lastFeedback.title}</strong>
                <span className="text-caption muted tabular-nums">
                  {formatDateBR(lastFeedback.startsAt)} ·{' '}
                  {formatTimeBR(lastFeedback.startsAt)} ·{' '}
                  {lastFeedback.feedbackCount} resposta
                  {lastFeedback.feedbackCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {lastFeedback.averages.slice(0, 4).map((a) => (
                  <span
                    key={a.key}
                    className="badge"
                    style={{
                      border: '1px solid var(--border-default, #eee)',
                      padding: '4px 10px',
                      borderRadius: 9999,
                    }}
                    title={`${a.count} resposta${a.count === 1 ? '' : 's'}`}
                  >
                    {a.label}:{' '}
                    <strong className="tabular-nums">
                      {a.average == null ? '—' : a.average.toFixed(2)}
                    </strong>
                  </span>
                ))}
              </div>
              <Link to="/treinos/historico" className="btn btn-secondary">
                Ver respostas
              </Link>
            </section>
          ) : null}

          {/* 3) PRÓXIMOS DA SEMANA */}
          <section
            className="card stack card--lg"
            aria-labelledby="home-coach-week"
          >
            <h2 id="home-coach-week" className="text-h3" style={{ margin: 0 }}>
              Próximos da semana
            </h2>
            {laterShow.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Sem outros eventos nos próximos dias.
              </p>
            ) : (
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {laterShow.map((r) => (
                  <li
                    key={`w-${r.eventId}-${r.turmaId || 'all'}`}
                    className="text-body"
                  >
                    <span className="tabular-nums">
                      {formatDateBR(r.startsAt)} {formatTimeBR(r.startsAt)}
                    </span>
                    <span className="muted">
                      {' '}
                      · {r.turmaName} · {r.type} · {r.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/calendario" className="text-caption">
              Calendário completo
            </Link>
          </section>

          {/* 4) PLANOS SOB MEUS CUIDADOS */}
          {user?.staffProfile?.active && recentPlans.length > 0 ? (
            <section
              className="card stack card--lg"
              aria-labelledby="home-coach-plans"
            >
              <h2 id="home-coach-plans" className="text-h3" style={{ margin: 0 }}>
                Planos sob meus cuidados
              </h2>
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {recentPlans.map((p) => (
                  <li
                    key={p.id}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <span>
                      <strong>{p.student.fullName}</strong>
                      <span className="muted"> · {p.title}</span>
                    </span>
                    <span
                      className="row"
                      style={{ gap: 'var(--space-2)', alignItems: 'center' }}
                    >
                      <PlanStatusBadge status={p.status} />
                      <Link
                        to={`/alunos/${p.student.id}/planos/${p.id}`}
                        className="btn btn-ghost"
                      >
                        Abrir
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/alunos" className="text-caption">
                Ver alunos
              </Link>
            </section>
          ) : null}

          {/* 5) ATALHOS */}
          <p className="text-caption muted" style={{ margin: 0 }}>
            Atalhos: <Link to="/treinos/historico">Histórico de treinos</Link> ·{' '}
            <Link to="/comunicacoes">Enviar comunicado</Link>
          </p>
        </>
      )}
    </div>
  );
}

function CoachHomeSkeleton() {
  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }} aria-busy="true">
      {['Compromissos de hoje', 'Feedback do último treino', 'Próximos da semana'].map(
        (title) => (
          <section key={title} className="card card--lg stack">
            <h2 className="text-h3" style={{ margin: 0 }}>
              {title}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Carregando informações…
            </p>
          </section>
        ),
      )}
    </div>
  );
}
