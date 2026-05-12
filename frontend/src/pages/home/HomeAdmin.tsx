import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  MessageSquare,
  TrendingUp,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { Banner } from '../../components/Banner';
import { useToast } from '../../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../../lib/api';
import { formatTimeBR, formatDayShortBR } from '../../lib/format-date';
import { notificationsApi } from '../../services/notifications';
import type { NotificationRow } from '../../services/types';
import type { DashboardHomeResponse, DashboardHomeEventItem } from './types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  TREINO: 'treino',
  JOGO: 'jogo',
  AMISTOSO: 'amistoso',
  EVENTO: 'evento',
  CAMPEONATO: 'campeonato',
  AVALIACAO: 'avaliação',
  REUNIAO: 'reunião',
};

function formatEventTypeCount(type: string, count: number): string {
  const base = EVENT_TYPE_LABELS[type] ?? type.toLowerCase();
  const word = count === 1 ? base : `${base}s`;
  return `${count} ${word}`;
}

function todayBreakdownText(byType: Record<string, number>): string {
  const parts = Object.entries(byType).map(([k, v]) =>
    formatEventTypeCount(k, v),
  );
  return parts.join(' · ') || 'sem agenda';
}

function formatRelativeNotif(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const h = Math.floor(diff / (60 * 60 * 1000));
  if (h < 1) return 'Há poucos minutos';
  if (h < 24) return `Há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ontem';
  return `Há ${d} dias`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function HomeAdmin() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [home, setHome] = useState<DashboardHomeResponse | null>(null);
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);

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
          const msg = errorMessageFromUnknown(e, 'Não foi possível carregar a visão geral.');
          setErr(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await notificationsApi.list({ take: 12 });
        if (!cancelled) setNotifs(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setNotifs([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const unreadNotifs = useMemo(() => notifs.filter((n) => n.readAt == null), [notifs]);
  const recentNotifs = useMemo(() => notifs.slice(0, 4), [notifs]);

  if (loading || !home) return <AdminHomeSkeleton />;

  const unevaluated =
    home.evaluations.activeStudents - home.evaluations.distinctStudentsEvaluated;
  const feedbackMissing =
    home.physicalFeedbackWeek.eligible - home.physicalFeedbackWeek.withFeedback;

  const hasUrgentPending =
    home.finance.delinquentCharges > 0 ||
    unevaluated > 0 ||
    feedbackMissing > 0;

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      {err ? <Banner variant="danger">{err}</Banner> : null}

      {/* Exception Board — 2 colunas: HOJE | PENDÊNCIAS */}
      <div className="exception-board">
        {/* Coluna HOJE */}
        <section className="stack" style={{ gap: 'var(--space-4)' }} aria-label="Hoje">
          <h2 className="exception-board__section-title">
            <Calendar size={16} strokeWidth={2} aria-hidden />
            Hoje · {formatDayShortBR(home.generatedAt)}
          </h2>

          {home.todayEvents.total === 0 ? (
            <div className="exception-card exception-card--neutral">
              <p className="exception-card__title">Nenhum evento programado</p>
              <Link to="/calendario" className="exception-card__action">
                Ver calendário <ArrowRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="exception-card exception-card--ok">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <p className="exception-card__title">
                  {home.todayEvents.total} evento{home.todayEvents.total !== 1 ? 's' : ''} hoje
                </p>
                <span className="text-caption muted">{todayBreakdownText(home.todayEvents.byType)}</span>
              </div>
              <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {home.todayEvents.items.slice(0, 3).map((ev) => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
                {home.todayEvents.items.length > 3 ? (
                  <span className="text-caption muted">
                    +{home.todayEvents.items.length - 3} mais…
                  </span>
                ) : null}
              </div>
              <Link to="/calendario" className="exception-card__action">
                Ver agenda completa <ArrowRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          )}

          {/* Mensagens não lidas */}
          {unreadNotifs.length > 0 ? (
            <div className="exception-card exception-card--info">
              <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                <MessageSquare size={16} strokeWidth={2} aria-hidden />
                <p className="exception-card__title" style={{ margin: 0 }}>
                  {unreadNotifs.length} notificaç{unreadNotifs.length === 1 ? 'ão' : 'ões'} não lida{unreadNotifs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Link to="/notificacoes" className="exception-card__action">
                Ver notificações <ArrowRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          ) : null}

          {/* Amanhã — compacto */}
          {home.tomorrowEvents.total > 0 ? (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <h3 className="exception-board__sub-title">
                Amanhã · {formatDayShortBR(addDaysIso(home.generatedAt, 1))}
              </h3>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {home.tomorrowEvents.items.slice(0, 2).map((ev) => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
                {home.tomorrowEvents.items.length > 2 ? (
                  <span className="text-caption muted">
                    +{home.tomorrowEvents.items.length - 2} mais…
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Resumo operacional */}
          <div className="exception-board__stats">
            <div className="exception-board__stat">
              <span className="exception-board__stat-value tabular-nums">{home.students.active}</span>
              <span className="exception-board__stat-label">alunos ativos</span>
            </div>
            <div className="exception-board__stat">
              <span className="exception-board__stat-value tabular-nums">{home.professionalsActive}</span>
              <span className="exception-board__stat-label">profissionais</span>
            </div>
            <div className="exception-board__stat">
              <span
                className="exception-board__stat-value tabular-nums"
                style={{ color: home.evaluations.percentage != null && home.evaluations.percentage >= 80 ? 'var(--state-success)' : 'var(--state-warning)' }}
              >
                {home.evaluations.percentage != null ? `${home.evaluations.percentage.toFixed(0)}%` : '—'}
              </span>
              <span className="exception-board__stat-label">avaliados</span>
            </div>
          </div>
        </section>

        {/* Coluna PENDÊNCIAS */}
        <section className="stack" style={{ gap: 'var(--space-4)' }} aria-label="Pendências">
          <h2 className="exception-board__section-title">
            {hasUrgentPending
              ? <AlertTriangle size={16} strokeWidth={2} aria-hidden />
              : <CheckCircle2 size={16} strokeWidth={2} aria-hidden />}
            Pendências
          </h2>

          {!hasUrgentPending ? (
            <div className="exception-card exception-card--ok">
              <p className="exception-card__title">Tudo em dia</p>
              <p className="text-caption muted" style={{ margin: 0 }}>
                Nenhuma ação urgente no momento.
              </p>
            </div>
          ) : null}

          {/* Inadimplência */}
          {home.finance.delinquentCharges > 0 ? (
            <div className="exception-card exception-card--danger">
              <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                <DollarSign size={16} strokeWidth={2} aria-hidden />
                <p className="exception-card__title" style={{ margin: 0 }}>
                  {home.finance.delinquentCharges} cobrança{home.finance.delinquentCharges !== 1 ? 's' : ''} vencida{home.finance.delinquentCharges !== 1 ? 's' : ''}
                </p>
              </div>
              {home.finance.delinquentAmountCents > 0 ? (
                <p className="tabular-nums text-caption" style={{ margin: '4px 0 0', color: 'var(--state-danger)' }}>
                  R$ {(home.finance.delinquentAmountCents / 100).toFixed(2)} acumulados
                </p>
              ) : null}
              {home.finance.topStudents.length > 0 ? (
                <p className="text-caption muted" style={{ margin: '4px 0 0' }}>
                  Maior devedor: <strong>{home.finance.topStudents[0].fullName}</strong>
                  {' '}· {home.finance.topStudents[0].daysOverdue}d em atraso
                </p>
              ) : null}
              <Link to="/financeiro/inadimplencia" className="exception-card__action">
                Ver cobranças <ArrowRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          ) : null}

          {/* Alunos sem avaliação */}
          {unevaluated > 0 ? (
            <div className="exception-card exception-card--warn">
              <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                <TrendingUp size={16} strokeWidth={2} aria-hidden />
                <p className="exception-card__title" style={{ margin: 0 }}>
                  {unevaluated} aluno{unevaluated !== 1 ? 's' : ''} sem avaliação no mês
                </p>
              </div>
              <p className="text-caption muted" style={{ margin: '4px 0 0' }}>
                {home.evaluations.distinctStudentsEvaluated}/{home.evaluations.activeStudents} avaliados
              </p>
              <Link to="/avaliacoes" className="exception-card__action">
                Avaliar agora <ArrowRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          ) : null}

          {/* Feedback físico faltando */}
          {feedbackMissing > 0 ? (
            <div className="exception-card exception-card--warn">
              <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                <ClipboardList size={16} strokeWidth={2} aria-hidden />
                <p className="exception-card__title" style={{ margin: 0 }}>
                  {feedbackMissing} evento{feedbackMissing !== 1 ? 's' : ''} sem feedback físico
                </p>
              </div>
              <p className="text-caption muted" style={{ margin: '4px 0 0' }}>
                Esta semana · {home.physicalFeedbackWeek.withFeedback}/{home.physicalFeedbackWeek.eligible} com resposta
              </p>
              <Link to="/treinos/historico" className="exception-card__action">
                Ver histórico <ArrowRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          ) : null}

          {/* Notificações recentes */}
          {recentNotifs.length > 0 ? (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <h3 className="exception-board__sub-title" style={{ marginBottom: 'var(--space-3)' }}>
                Atividade recente
              </h3>
              <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
                {recentNotifs.map((n) => (
                  <li key={n.id} className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                    <span
                      className="home-notif-dot"
                      aria-hidden
                      style={{
                        background: n.readAt == null ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      }}
                    />
                    <div className="stack" style={{ gap: '2px', minWidth: 0 }}>
                      <strong className="text-sm" style={{ margin: 0 }}>{n.title}</strong>
                      <span className="text-caption muted">{formatRelativeNotif(n.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <Link to="/notificacoes" className="text-caption" style={{ marginTop: 'var(--space-3)', display: 'block' }}>
                Ver todas →
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: DashboardHomeEventItem }) {
  return (
    <div className="home-event-row">
      <span className="tabular-nums text-caption" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
        {formatTimeBR(ev.startsAt)}
      </span>
      <div className="stack" style={{ gap: '2px', minWidth: 0 }}>
        <strong className="text-sm" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.title}
        </strong>
        <span className="text-caption muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.isWholeSchool
            ? 'Toda a escolinha'
            : ev.turmas.map((t) => t.turma.name).join(' · ') || '—'}
          {ev.location ? (
            <>
              {' '}
              <MapPin size={11} strokeWidth={2} aria-hidden style={{ display: 'inline', verticalAlign: 'middle' }} />
              {' '}{ev.location}
            </>
          ) : null}
        </span>
      </div>
      {ev.status === 'CANCELLED' ? (
        <span className="badge badge--danger" style={{ flexShrink: 0 }}>cancelado</span>
      ) : null}
    </div>
  );
}

function AdminHomeSkeleton() {
  return (
    <div className="exception-board" aria-busy="true">
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        <div className="exception-board__section-title" style={{ background: 'var(--bg-muted)', height: '1.2rem', width: '8rem', borderRadius: 4 }} />
        {[1, 2].map((i) => (
          <div key={i} className="exception-card exception-card--neutral" style={{ minHeight: '6rem' }} />
        ))}
      </div>
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        <div className="exception-board__section-title" style={{ background: 'var(--bg-muted)', height: '1.2rem', width: '8rem', borderRadius: 4 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="exception-card exception-card--neutral" style={{ minHeight: '5rem' }} />
        ))}
      </div>
    </div>
  );
}
