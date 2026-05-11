import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Banner } from '../../components/Banner';
import { EventFeedbackPanel } from '../../components/EventFeedbackPanel';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/useToast';
import { errorMessageFromUnknown } from '../../lib/api';
import {
  formatDateBR,
  formatDateTimeBR,
  formatTimeBR,
} from '../../lib/format-date';
import { calendarApi } from '../../services/calendar';
import { communicationsApi } from '../../services/communications';
import { financeApi } from '../../services/finance';
import { individualPlansApi } from '../../services/individual-plans';
import { notificationsApi } from '../../services/notifications';
import { studentsApi } from '../../services/students';
import { athleteWorkoutsApi } from '../../services/workouts';
import type {
  AthleteWorkoutAssignment,
  CalendarEventAthleteOverview as OverviewAthleteEvent,
  CommunicationInboxRow as InboxMsg,
  FinancialCharge as Charge,
  NotificationRow as NotifRow,
  PendingFeedbackResponse,
} from '../../services/types';
import { isActiveEvent, startOfLocalDay } from './calendar-utils';
import type { CalEventApi } from './types';

const MS_MIN = 60_000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;

/** "Em 2h30", "Em 3d", "Daqui a 35min", "Há 1h20" — formato compacto. */
function relativeFromNow(target: Date, now = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const future = diffMs >= 0;
  if (abs < MS_MIN) return future ? 'Em instantes' : 'Agora há pouco';
  if (abs < MS_HOUR) {
    const min = Math.round(abs / MS_MIN);
    return future ? `Em ${min}min` : `Há ${min}min`;
  }
  if (abs < MS_DAY) {
    const h = Math.floor(abs / MS_HOUR);
    const min = Math.round((abs % MS_HOUR) / MS_MIN);
    const txt = min ? `${h}h${String(min).padStart(2, '0')}` : `${h}h`;
    return future ? `Em ${txt}` : `Há ${txt}`;
  }
  const d = Math.round(abs / MS_DAY);
  return future ? `Em ${d}d` : `Há ${d}d`;
}

export function HomeGuardian() {
  const toast = useToast();
  const { activeStudentId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [inbox, setInbox] = useState<InboxMsg[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalEventApi[]>([]);
  const [pendingFeedback, setPendingFeedback] = useState<OverviewAthleteEvent[]>(
    [],
  );
  const [workouts, setWorkouts] = useState<AthleteWorkoutAssignment[]>([]);
  const [pendingFinance, setPendingFinance] = useState<{
    count: number;
    nextDueLabel: string | null;
    studentId: string | null;
  }>({ count: 0, nextDueLabel: null, studentId: null });
  const [publishedPlansByKid, setPublishedPlansByKid] = useState<
    { studentId: string; fullName: string }[]
  >([]);

  // Modal de feedback (dispara a partir do banner do agora ou da lista de
  // pendentes).
  const [feedbackEvent, setFeedbackEvent] =
    useState<OverviewAthleteEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const fromUpcoming = startOfLocalDay();
        const toUpcoming = new Date(fromUpcoming);
        toUpcoming.setDate(toUpcoming.getDate() + 14);

        const [inb, ntf, kids, upcomingRes] = await Promise.all([
          communicationsApi.inbox({ take: 25 }),
          notificationsApi.list({ take: 25 }),
          studentsApi.list(),
          calendarApi.list({
            from: fromUpcoming,
            to: toUpcoming,
            take: 30,
          }) as Promise<CalEventApi[]>,
        ]);
        if (cancelled) return;
        setInbox(inb);
        setNotifs(ntf);
        setUpcomingEvents(upcomingRes.filter(isActiveEvent));

        if (activeStudentId) {
          try {
            const [ws, pending] = await Promise.all([
              athleteWorkoutsApi.list(activeStudentId),
              calendarApi
                .getPendingFeedback(activeStudentId, { limit: 5, days: 14 })
                .catch(
                  () =>
                    ({
                      studentId: activeStudentId,
                      windowDays: 14,
                      events: [],
                    }) as PendingFeedbackResponse,
                ),
            ]);
            if (cancelled) return;
            setWorkouts(ws.slice(0, 3));
            // O endpoint já devolve apenas eventos com dims efetivas e sem
            // feedback do aluno, na ordem desejada — basta confiar.
            setPendingFeedback(pending.events);
          } catch {
            if (!cancelled) {
              setWorkouts([]);
              setPendingFeedback([]);
            }
          }
        } else {
          setWorkouts([]);
          setPendingFeedback([]);
        }

        const extratos = await Promise.all(
          kids.map((k) =>
            financeApi.extratoByStudent(k.id).then((rows) => ({
              kidId: k.id,
              rows,
            })),
          ),
        );
        if (cancelled) return;
        const open = extratos.flatMap(({ kidId, rows }) =>
          rows
            .filter((r: Charge) => r.status === 'PENDENTE' || r.status === 'ATRASADO')
            .map((r: Charge) => ({ ...r, kidId })),
        );
        open.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const next = open[0];
        setPendingFinance({
          count: open.length,
          nextDueLabel: next
            ? `${next.dueDate.slice(0, 10)} · R$ ${(next.amountCents / 100).toFixed(2)}`
            : null,
          studentId: next?.kidId ?? null,
        });

        const planRows = await Promise.all(
          kids.map(async (k) => {
            try {
              const rows = await individualPlansApi.listForGuardian(k.id);
              const hasPub = rows.some((r) => r.status === 'PUBLISHED');
              return hasPub ? { studentId: k.id, fullName: k.fullName } : null;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        setPublishedPlansByKid(planRows.filter((x): x is NonNullable<typeof x> => x != null));
      } catch (e) {
        if (!cancelled) {
          const msg = errorMessageFromUnknown(e, 'Não foi possível carregar sua página inicial.');
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
  }, [toast, activeStudentId]);

  // Próximo evento ou evento "acontecendo agora".
  const banner = useMemo(() => {
    const now = new Date();
    const ordered = [...upcomingEvents].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
    type WithEnd = CalEventApi & { endsAt?: string };
    // Em andamento? — a API de listagem não devolve endsAt no shape leve;
    // tratamos só por startsAt e janela de 2h como heurística para "agora".
    const live = ordered.find((e) => {
      const start = new Date(e.startsAt).getTime();
      const end = (e as WithEnd).endsAt
        ? new Date((e as WithEnd).endsAt as string).getTime()
        : start + 2 * MS_HOUR;
      return start <= now.getTime() && end > now.getTime();
    });
    const nextUp = ordered.find(
      (e) => new Date(e.startsAt).getTime() > now.getTime(),
    );
    return { live, nextUp };
  }, [upcomingEvents]);

  const inboxUnread = useMemo(
    () => inbox.filter((m) => !m.recipients[0]?.readAt).length,
    [inbox],
  );
  const notifUnread = useMemo(() => notifs.filter((n) => !n.readAt).length, [notifs]);
  const attentionTotal = inboxUnread + notifUnread;

  const notifPreview = useMemo(
    () => notifs.filter((n) => !n.readAt).slice(0, 2),
    [notifs],
  );

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      {err ? <Banner variant="danger">{err}</Banner> : null}

      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* 1) BANNER DO AGORA */}
          <NowBanner
            live={banner.live ?? null}
            nextUp={banner.nextUp ?? null}
          />

          {/* 2) AVALIAÇÕES PENDENTES */}
          <section className="card stack card--lg" aria-labelledby="home-pending-feedback">
            <h2 id="home-pending-feedback" className="text-h3" style={{ margin: 0 }}>
              Avaliações pendentes
            </h2>
            {pendingFeedback.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Tudo em dia — nenhum treino aguardando seu feedback.
              </p>
            ) : (
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {pendingFeedback.map((ev) => (
                  <li
                    key={ev.id}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div className="stack" style={{ gap: 0 }}>
                      <strong className="text-body">{ev.title}</strong>
                      <span className="text-caption muted tabular-nums">
                        {formatDateBR(ev.startsAt)} · {formatTimeBR(ev.startsAt)} ·{' '}
                        {ev.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setFeedbackEvent(ev)}
                    >
                      Avaliar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/treinos/historico?pending=1" className="text-caption">
              Ver pendências no histórico
            </Link>
          </section>

          {/* 3) MEUS TREINOS PARA FAZER */}
          <section className="card stack card--lg" aria-labelledby="home-meus-treinos">
            <h2 id="home-meus-treinos" className="text-h3" style={{ margin: 0 }}>
              Meus treinos
            </h2>
            {workouts.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Sem treinos atribuídos no momento.
              </p>
            ) : (
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {workouts.map((a) => (
                  <li
                    key={a.id}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div className="stack" style={{ gap: 0 }}>
                      <strong className="text-body">{a.workout.name}</strong>
                      {a.turma ? (
                        <span className="text-caption muted">via {a.turma.name}</span>
                      ) : (
                        <span className="text-caption muted">treino individual</span>
                      )}
                    </div>
                    <Link to="/meus-treinos" className="btn btn-secondary">
                      Abrir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/meus-treinos" className="text-caption">
              Ver todos meus treinos
            </Link>
          </section>

          {/* 4) ATENÇÃO (avisos + notificações compactos) */}
          <section className="card stack card--lg" aria-labelledby="home-guardian-attention">
            <h2 id="home-guardian-attention" className="text-h3" style={{ margin: 0 }}>
              Avisos e notificações
            </h2>
            <p className="text-body" style={{ margin: 0 }}>
              <strong className="tabular-nums">{attentionTotal}</strong> item(ns) não lido(s)
              {inboxUnread ? ` · ${inboxUnread} aviso(s)` : ''}
              {notifUnread ? ` · ${notifUnread} notificação(ões)` : ''}
              {attentionTotal === 0 ? ' — tudo em dia.' : '.'}
            </p>
            {notifPreview.length ? (
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {notifPreview.map((n) => (
                  <li key={n.id} className="text-caption">
                    <strong>{n.title}</strong>
                    <span className="muted"> — {n.body}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <Link to="/avisos" className="btn btn-ghost">
                Avisos
              </Link>
              <Link to="/notificacoes" className="btn btn-ghost">
                Notificações
              </Link>
            </div>
          </section>

          {/* 5) FINANCEIRO */}
          <section className="card stack card--lg" aria-labelledby="home-guardian-finance">
            <h2 id="home-guardian-finance" className="text-h3" style={{ margin: 0 }}>
              Financeiro
            </h2>
            {pendingFinance.count > 0 ? (
              <>
                <p className="text-body" style={{ margin: 0 }}>
                  <strong className="tabular-nums">{pendingFinance.count}</strong>{' '}
                  competência(s) em aberto
                  {pendingFinance.nextDueLabel ? (
                    <>
                      . Próximo vencimento:{' '}
                      <span className="tabular-nums">{pendingFinance.nextDueLabel}</span>
                    </>
                  ) : null}
                </p>
                <Link
                  to={pendingFinance.studentId ? `/filhos/${pendingFinance.studentId}` : '/filhos'}
                  className="btn btn-secondary"
                >
                  Ver extrato
                </Link>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Sem pendências visíveis no extrato.
              </p>
            )}
          </section>

          {/* 6) PLANOS PUBLICADOS (mantém pra quem tem) */}
          {publishedPlansByKid.length > 0 ? (
            <section className="card stack card--lg" aria-labelledby="home-guardian-plans">
              <h2 id="home-guardian-plans" className="text-h3" style={{ margin: 0 }}>
                Acompanhamentos
              </h2>
              <p className="text-body muted" style={{ margin: 0 }}>
                Há plano(s) publicado(s) para{' '}
                {publishedPlansByKid.map((x) => x.fullName).join(', ')}.
              </p>
              <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
                {publishedPlansByKid.map((x) => (
                  <li key={x.studentId}>
                    <Link to={`/filhos/${x.studentId}/planos`} className="btn btn-secondary">
                      Ver planos de {x.fullName}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {feedbackEvent ? (
        <Modal
          open
          title={`${feedbackEvent.title} — ${formatDateBR(feedbackEvent.startsAt)}`}
          onClose={() => setFeedbackEvent(null)}
        >
          <EventFeedbackPanel
            event={feedbackEvent}
            onChanged={() => {
              setFeedbackEvent(null);
              // remoção otimista: oculta o item depois de responder.
              setPendingFeedback((prev) =>
                prev.filter((e) => e.id !== feedbackEvent.id),
              );
            }}
          />
        </Modal>
      ) : null}
    </div>
  );

  function NowBanner({
    live,
    nextUp,
  }: {
    live: CalEventApi | null;
    nextUp: CalEventApi | null;
  }) {
    const target = live ?? nextUp;
    if (!target) {
      return (
        <section
          className="card card--lg stack"
          aria-labelledby="home-now-banner"
        >
          <h2 id="home-now-banner" className="text-h3" style={{ margin: 0 }}>
            Sem próximos treinos
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Você não tem treinos previstos para os próximos 14 dias.
          </p>
          <Link to="/calendario" className="btn btn-secondary">
            Ver calendário
          </Link>
        </section>
      );
    }
    const isLive = !!live;
    return (
      <section
        className="card card--lg stack"
        aria-labelledby="home-now-banner"
        style={{
          borderLeft: isLive
            ? '4px solid var(--state-success, #2bb673)'
            : '4px solid var(--color-brand, #1f6feb)',
        }}
      >
        <header className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <h2 id="home-now-banner" className="text-h3" style={{ margin: 0 }}>
            {isLive ? 'Acontecendo agora' : 'Próximo treino'}
          </h2>
          <span className="text-caption muted tabular-nums">
            {isLive ? 'agora' : relativeFromNow(new Date(target.startsAt))}
          </span>
        </header>
        <div className="stack" style={{ gap: 0 }}>
          <strong className="text-body">{target.title}</strong>
          <span className="text-caption muted">
            {formatDateTimeBR(target.startsAt)}
            {target.isWholeSchool
              ? ' · Toda a escolinha'
              : target.turmas.length
                ? ` · ${target.turmas.map((t) => t.turma.name).join(', ')}`
                : ''}
          </span>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Link to="/calendario" className="btn btn-primary">
            Ver no calendário
          </Link>
          <Link to="/treinos/historico" className="btn btn-ghost">
            Histórico de treinos
          </Link>
        </div>
      </section>
    );
  }
}

function HomeSkeleton() {
  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }} aria-busy="true">
      {['Próximo treino', 'Avaliações pendentes', 'Meus treinos'].map((title) => (
        <section key={title} className="card card--lg stack">
          <h2 className="text-h3" style={{ margin: 0 }}>
            {title}
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Carregando informações…
          </p>
        </section>
      ))}
    </div>
  );
}
