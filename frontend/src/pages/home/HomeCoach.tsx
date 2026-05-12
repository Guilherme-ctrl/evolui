import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Star,
  MessageSquare,
  Image,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Banner } from '../../components/Banner';
import { useToast } from '../../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../../lib/api';
import { formatDateBR, formatTimeBR } from '../../lib/format-date';
import {
  isActiveEvent,
  isSameLocalDay,
  startOfLocalDay,
} from './calendar-utils';
import type { CalEventApi } from './types';

const MS_MIN = 60_000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;

function relativeFromNow(target: Date, now = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const future = diffMs >= 0;
  if (abs < MS_MIN) return future ? 'Em instantes' : 'Agora';
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

export function HomeCoach() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [turmasById, setTurmasById] = useState<Map<string, TurmaRow>>(new Map());
  const [events, setEvents] = useState<CalEventApi[]>([]);
  const [now, setNow] = useState(new Date());

  // Atualiza "agora" a cada minuto para manter o countdown vivo
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const from = startOfLocalDay();
        const to = new Date(from);
        to.setDate(to.getDate() + 7);

        const [turmas, evs] = await Promise.all([
          apiFetch<TurmaRow[]>('/turmas?take=50'),
          apiFetch<CalEventApi[]>(
            `/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}&take=40`,
          ),
        ]);
        if (cancelled) return;
        const map = new Map<string, TurmaRow>();
        for (const t of turmas) map.set(t.id, t);
        setTurmasById(map);
        setEvents(evs.filter(isActiveEvent));
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
    return () => { cancelled = true; };
  }, [toast]);

  const expanded = useMemo((): CoachRow[] => {
    const rows: CoachRow[] = [];
    for (const ev of events) {
      if (ev.isWholeSchool || ev.turmas.length === 0) {
        rows.push({
          eventId: ev.id, title: ev.title, type: ev.type,
          startsAt: ev.startsAt, turmaId: '', turmaName: 'Toda a escolinha',
          expectedStudents: null,
        });
        continue;
      }
      for (const link of ev.turmas) {
        const t = turmasById.get(link.turmaId);
        if (!t) continue;
        rows.push({
          eventId: ev.id, title: ev.title, type: ev.type,
          startsAt: ev.startsAt, turmaId: link.turmaId,
          turmaName: link.turma.name,
          expectedStudents: t._count?.enrollments ?? null,
        });
      }
    }
    return rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [events, turmasById]);

  const today = useMemo(
    () => expanded.filter((r) => isSameLocalDay(new Date(r.startsAt), now)),
    [expanded, now],
  );

  const upcoming = useMemo(
    () => expanded.filter((r) => !isSameLocalDay(new Date(r.startsAt), now)),
    [expanded, now],
  );

  // Próximo treino (futuro ou em andamento de hoje, TREINO prioritário)
  const nextTreino = useMemo(() => {
    const future = today.filter((r) => new Date(r.startsAt).getTime() >= now.getTime() - MS_HOUR);
    return future.find((r) => r.type === 'TREINO') ?? future[0] ?? null;
  }, [today, now]);

  // Outros eventos de hoje (excluindo o próximo)
  const restToday = useMemo(
    () => today.filter((r) => r !== nextTreino),
    [today, nextTreino],
  );

  if (loading) return <CoachHomeSkeleton />;

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      {err ? <Banner variant="danger">{err}</Banner> : null}

      {/* ── PRÓXIMO TREINO — hero card ──────────────────────────────── */}
      {nextTreino ? (
        <section className="coach-hero-treino" aria-label="Próximo treino">
          <div className="coach-hero-treino__head">
            <div className="stack" style={{ gap: 4 }}>
              <span className="coach-hero-treino__label">
                {nextTreino.type === 'TREINO' ? 'Próximo treino' : 'Próximo evento'}
              </span>
              <strong className="coach-hero-treino__turma">{nextTreino.turmaName}</strong>
              <span className="coach-hero-treino__title">{nextTreino.title}</span>
            </div>
            <div className="stack" style={{ gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
              <span className="coach-hero-treino__time tabular-nums">
                {formatTimeBR(nextTreino.startsAt)}
              </span>
              <span className="coach-hero-treino__countdown">
                <Clock size={12} strokeWidth={2} aria-hidden />
                {relativeFromNow(new Date(nextTreino.startsAt), now)}
              </span>
            </div>
          </div>
          {nextTreino.expectedStudents != null ? (
            <p className="coach-hero-treino__meta">
              {nextTreino.expectedStudents} aluno{nextTreino.expectedStudents !== 1 ? 's' : ''} esperados
            </p>
          ) : null}
          {nextTreino.turmaId && nextTreino.type === 'TREINO' ? (
            <Link
              className="coach-hero-treino__cta"
              to={`/presenca?turmaId=${encodeURIComponent(nextTreino.turmaId)}&eventId=${encodeURIComponent(nextTreino.eventId)}`}
            >
              <ClipboardCheck size={18} strokeWidth={2} aria-hidden />
              Abrir presença
            </Link>
          ) : (
            <Link className="coach-hero-treino__cta" to="/calendario">
              Ver no calendário
            </Link>
          )}
        </section>
      ) : (
        <div className="exception-card exception-card--neutral">
          <p className="exception-card__title">Sem treinos hoje</p>
          <Link to="/calendario" className="exception-card__action">
            Ver próximos eventos <ChevronRight size={13} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      )}

      {/* ── QUICK ACTIONS ───────────────────────────────────────────── */}
      <div className="coach-quick-actions" aria-label="Ações rápidas">
        <Link to="/presenca" className="coach-quick-action">
          <ClipboardCheck size={22} strokeWidth={2} aria-hidden />
          <span>Presença</span>
        </Link>
        <Link to="/avaliacoes" className="coach-quick-action">
          <Star size={22} strokeWidth={2} aria-hidden />
          <span>Avaliar</span>
        </Link>
        <Link to="/midia" className="coach-quick-action">
          <Image size={22} strokeWidth={2} aria-hidden />
          <span>Galeria</span>
        </Link>
        <Link to="/comunicacoes" className="coach-quick-action">
          <MessageSquare size={22} strokeWidth={2} aria-hidden />
          <span>Mensagem</span>
        </Link>
      </div>

      {/* ── MAIS HOJE ───────────────────────────────────────────────── */}
      {restToday.length > 0 ? (
        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h2 className="exception-board__section-title">
            Mais hoje
          </h2>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {restToday.map((r) => (
              <div key={`${r.eventId}-${r.turmaId}`} className="coach-event-row">
                <span className="tabular-nums text-caption" style={{ color: 'var(--text-secondary)', flexShrink: 0, minWidth: '3.5rem' }}>
                  {formatTimeBR(r.startsAt)}
                </span>
                <div className="stack" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 'var(--text-sm)' }}>{r.turmaName}</strong>
                  <span className="text-caption muted">{r.title}</span>
                </div>
                {r.turmaId && r.type === 'TREINO' ? (
                  <Link
                    to={`/presenca?turmaId=${encodeURIComponent(r.turmaId)}&eventId=${encodeURIComponent(r.eventId)}`}
                    className="text-caption"
                    style={{ color: 'var(--accent-secondary)', flexShrink: 0 }}
                  >
                    Presença →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── PENDÊNCIAS ─────────────────────────────────────────────── */}
      <section className="stack" style={{ gap: 'var(--space-3)' }}>
        <h2 className="exception-board__section-title">
          {today.length === 0
            ? <CheckCircle2 size={15} strokeWidth={2} aria-hidden />
            : <AlertTriangle size={15} strokeWidth={2} aria-hidden />}
          Pendências
        </h2>
        <div className="exception-card exception-card--neutral">
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <Link to="/avaliacoes" className="coach-pending-row">
              <Star size={15} strokeWidth={2} style={{ color: 'var(--state-warning)' }} aria-hidden />
              <span>Registrar avaliações pendentes</span>
              <ChevronRight size={14} strokeWidth={2} style={{ marginLeft: 'auto', opacity: 0.4 }} aria-hidden />
            </Link>
            <Link to="/treinos/historico" className="coach-pending-row">
              <ClipboardCheck size={15} strokeWidth={2} style={{ color: 'var(--accent-secondary)' }} aria-hidden />
              <span>Histórico de treinos e feedback</span>
              <ChevronRight size={14} strokeWidth={2} style={{ marginLeft: 'auto', opacity: 0.4 }} aria-hidden />
            </Link>
            <Link to="/comunicacoes" className="coach-pending-row">
              <MessageSquare size={15} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} aria-hidden />
              <span>Mensagens</span>
              <ChevronRight size={14} strokeWidth={2} style={{ marginLeft: 'auto', opacity: 0.4 }} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRÓXIMOS DA SEMANA ─────────────────────────────────────── */}
      {upcoming.length > 0 ? (
        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h2 className="exception-board__section-title">Esta semana</h2>
          <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {upcoming.slice(0, 5).map((r) => (
                <div key={`w-${r.eventId}-${r.turmaId}`} className="coach-event-row">
                  <span className="tabular-nums text-caption" style={{ color: 'var(--text-secondary)', flexShrink: 0, minWidth: '6.5rem' }}>
                    {formatDateBR(r.startsAt)} {formatTimeBR(r.startsAt)}
                  </span>
                  <div className="stack" style={{ gap: '2px', flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 'var(--text-sm)' }}>{r.turmaName}</strong>
                    <span className="text-caption muted">{r.type}</span>
                  </div>
                </div>
              ))}
              {upcoming.length > 5 ? (
                <span className="text-caption muted">
                  +{upcoming.length - 5} mais eventos…
                </span>
              ) : null}
            </div>
            <Link to="/calendario" className="text-caption" style={{ marginTop: 'var(--space-3)', display: 'block', color: 'var(--accent-secondary)' }}>
              Ver calendário completo →
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CoachHomeSkeleton() {
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }} aria-busy="true">
      <div className="coach-hero-treino" style={{ opacity: 0.4, minHeight: '8rem' }} />
      <div className="coach-quick-actions">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="coach-quick-action" style={{ opacity: 0.3, pointerEvents: 'none' }}>
            <div style={{ width: 22, height: 22, background: 'var(--bg-muted)', borderRadius: 4 }} />
            <span style={{ width: '3rem', height: '0.75rem', background: 'var(--bg-muted)', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
