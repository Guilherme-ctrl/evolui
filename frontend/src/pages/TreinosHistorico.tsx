import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { EventFeedbackPanel } from '../components/EventFeedbackPanel';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { errorMessageFromUnknown } from '../lib/api';
import { formatDateBR, formatTimeBR } from '../lib/format-date';
import { calendarApi } from '../services/calendar';
import {
  CALENDAR_EVENT_TYPES,
  type CalendarEventAthleteOverview as AthleteEvent,
  type CalendarEventStaffOverview as StaffEvent,
} from '../services/types';

const EVENT_TYPES = CALENDAR_EVENT_TYPES;

type AnyEvent = StaffEvent | AthleteEvent;

function isAthleteRow(ev: AnyEvent): ev is AthleteEvent {
  return 'myFeedback' in ev;
}

function isStaffRow(ev: AnyEvent): ev is StaffEvent {
  return 'feedbackCount' in ev;
}

/**
 * Default: últimos 90 dias até daqui a 30 dias.
 * Para deep-link de pendências, usamos uma janela menor e focada: últimos 14
 * dias até hoje, igual à Home do ATLETA.
 */
function defaultRange(pendingMode = false): { fromYmd: string; toYmd: string } {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - (pendingMode ? 14 : 90));
  const future = new Date(now);
  future.setDate(future.getDate() + (pendingMode ? 0 : 30));
  return {
    fromYmd: toYmd(past),
    toYmd: toYmd(future),
  };
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function ymdToIso(ymd: string, end: boolean): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = end
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return dt.toISOString();
}

function statusBadgeClass(status: string) {
  if (status === 'CANCELLED') return 'badge badge--danger';
  if (status === 'SCHEDULED') return 'badge badge--info';
  return 'badge badge--neutral';
}

export default function TreinosHistorico() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = user?.role;
  const isAthlete = role === 'ATLETA';
  const isStaff = role === 'ADMIN' || role === 'TREINADOR';
  const initialPendingOnly = isAthlete && searchParams.get('pending') === '1';

  const initialRange = useMemo(
    () => defaultRange(initialPendingOnly),
    [initialPendingOnly],
  );
  const [fromYmd, setFromYmd] = useState(initialRange.fromYmd);
  const [toYmdState, setToYmdState] = useState(initialRange.toYmd);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [pendingOnly, setPendingOnly] = useState(initialPendingOnly);

  const [rows, setRows] = useState<AnyEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'reset' | 'append') => {
      setLoading(true);
      try {
        const cursor = mode === 'append' ? nextCursor : undefined;
        const fromIso = ymdToIso(fromYmd, false) ?? undefined;
        const toIso = ymdToIso(toYmdState, true) ?? undefined;
        const data = await calendarApi.feedbackOverview({
          from: fromIso,
          to: toIso,
          type: typeFilter || undefined,
          cursor: cursor ?? undefined,
          take: 25,
        });
        const events = data.events as AnyEvent[];
        setRows((prev) => (mode === 'append' ? [...prev, ...events] : events));
        setNextCursor(data.nextCursor);
      } catch (e) {
        toast.error(
          errorMessageFromUnknown(e, 'Não foi possível carregar o histórico.'),
        );
      } finally {
        setLoading(false);
      }
    },
    [fromYmd, toYmdState, typeFilter, nextCursor, toast],
  );

  useEffect(() => {
    void load('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onApplyFilters() {
    void load('reset');
  }

  function togglePendingOnly(on: boolean) {
    setPendingOnly(on);
    const next = new URLSearchParams(searchParams);
    if (on) next.set('pending', '1');
    else next.delete('pending');
    setSearchParams(next, { replace: true });
  }

  const selectedEvent = useMemo(
    () => rows.find((r) => r.id === selectedEventId) ?? null,
    [rows, selectedEventId],
  );

  const visibleRows = useMemo(() => {
    if (!pendingOnly || !isAthlete) return rows;
    const now = Date.now();
    return rows.filter(
      (ev) =>
        isAthleteRow(ev) &&
        (ev.effectiveFeedbackDimensions?.length ?? 0) > 0 &&
        ev.myFeedback == null &&
        new Date(ev.startsAt).getTime() <= now &&
        ev.status !== 'CANCELLED',
    );
  }, [rows, pendingOnly, isAthlete]);

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Histórico de treinos</h1>
          <p className="page-header__subtitle">
            Todos os eventos do calendário com os feedbacks físicos coletados.
            {isStaff
              ? ' Você vê as médias do grupo e pode abrir as respostas individuais.'
              : ' Você vê seus próprios feedbacks e pode editar a qualquer momento.'}
          </p>
        </div>
      </header>

      <section
        className="card card--lg stack"
        aria-labelledby="treinos-historico-filtros"
      >
        <h2 id="treinos-historico-filtros" className="sr-only">
          Filtros
        </h2>
        <div
          className="row"
          style={{ gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <label className="stack" style={{ minWidth: 160 }}>
            <span className="muted">Início</span>
            <input
              type="date"
              lang="pt-BR"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
            />
          </label>
          <label className="stack" style={{ minWidth: 160 }}>
            <span className="muted">Término</span>
            <input
              type="date"
              lang="pt-BR"
              value={toYmdState}
              onChange={(e) => setToYmdState(e.target.value)}
            />
          </label>
          <label className="stack" style={{ minWidth: 180 }}>
            <span className="muted">Tipo</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onApplyFilters}
            disabled={loading}
          >
            {loading ? 'Carregando…' : 'Aplicar'}
          </button>
          {isAthlete ? (
            <label className="field-check" style={{ alignSelf: 'center' }}>
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => togglePendingOnly(e.target.checked)}
              />
              <span>Só avaliações pendentes</span>
            </label>
          ) : null}
        </div>
      </section>

      <section className="stack">
        {visibleRows.length === 0 && !loading ? (
          <div className="card stack" style={{ padding: 'var(--space-3)' }}>
            <strong>
              {pendingOnly ? 'Nenhuma avaliação pendente.' : 'Nenhum evento encontrado.'}
            </strong>
            <p className="muted" style={{ margin: 0 }}>
              {pendingOnly
                ? 'Tudo certo por aqui. Se quiser revisar respostas antigas, desmarque “Só avaliações pendentes”.'
                : 'Ajuste o período ou o tipo para encontrar mais eventos.'}
            </p>
          </div>
        ) : (
          <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
            {visibleRows.map((ev) => (
              <li key={ev.id}>
                <EventCard
                  ev={ev}
                  onOpen={() => setSelectedEventId(ev.id)}
                  isAthlete={isAthlete}
                />
              </li>
            ))}
          </ul>
        )}

        {nextCursor ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void load('append')}
            disabled={loading}
            style={{ alignSelf: 'flex-start' }}
          >
            {loading ? 'Carregando…' : 'Carregar mais'}
          </button>
        ) : null}
      </section>

      {selectedEvent ? (
        <Modal
          open
          title={`${selectedEvent.title} — ${formatDateBR(selectedEvent.startsAt)} ${formatTimeBR(selectedEvent.startsAt)}`}
          onClose={() => setSelectedEventId(null)}
        >
          <EventFeedbackPanel
            event={selectedEvent}
            onChanged={() => void load('reset')}
          />
        </Modal>
      ) : null}
    </div>
  );
}

type EventCardProps = {
  ev: AnyEvent;
  onOpen: () => void;
  isAthlete: boolean;
};

function EventCard({ ev, onOpen, isAthlete }: EventCardProps) {
  const dims = ev.effectiveFeedbackDimensions ?? [];
  const turmaLabel = ev.isWholeSchool
    ? 'Toda a escolinha'
    : ev.turmas.map((t) => t.turma.name).join(', ') || '—';

  return (
    <article className="card stack" style={{ padding: 'var(--space-3)', gap: 'var(--space-2)' }}>
      <header
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div className="stack" style={{ gap: 2 }}>
          <span className="text-caption muted tabular-nums">
            {formatDateBR(ev.startsAt)} · {formatTimeBR(ev.startsAt)}–{formatTimeBR(ev.endsAt)}
          </span>
          <strong className="text-body">{ev.title}</strong>
          <span className="text-caption muted">{turmaLabel}</span>
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge--neutral">{ev.type}</span>
          <span className={statusBadgeClass(ev.status)}>{ev.status}</span>
        </div>
      </header>

      {dims.length === 0 ? (
        <p className="text-caption muted" style={{ margin: 0 }}>
          Sem dimensões de feedback configuradas para este evento.
        </p>
      ) : isAthleteRow(ev) ? (
        <AthleteSummary ev={ev} />
      ) : isStaffRow(ev) ? (
        <StaffSummary ev={ev} />
      ) : null}

      <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={
            isAthlete && dims.length > 0
              ? 'btn btn-primary'
              : 'btn btn-secondary'
          }
          onClick={onOpen}
        >
          {isAthlete
            ? dims.length === 0
              ? 'Ver detalhes'
              : isAthleteRow(ev) && ev.myFeedback
                ? 'Editar minha resposta'
                : 'Avaliar'
            : 'Ver detalhes / respostas'}
        </button>
      </div>
    </article>
  );
}

function StaffSummary({ ev }: { ev: StaffEvent }) {
  if (ev.feedbackCount === 0) {
    return (
      <p className="text-caption muted" style={{ margin: 0 }}>
        Ainda sem respostas.
      </p>
    );
  }
  const visible = ev.averages.slice(0, 4);
  return (
    <div className="stack" style={{ gap: 'var(--space-1)' }}>
      <span className="text-caption muted">
        {ev.feedbackCount} resposta{ev.feedbackCount === 1 ? '' : 's'} · médias:
      </span>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {visible.map((a) => (
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
            {a.label}: <strong className="tabular-nums">
              {a.average == null ? '—' : a.average.toFixed(2)}
            </strong>
          </span>
        ))}
        {ev.averages.length > visible.length ? (
          <span className="text-caption muted">
            +{ev.averages.length - visible.length} dim.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AthleteSummary({ ev }: { ev: AthleteEvent }) {
  if (!ev.myFeedback) {
    return (
      <span className="badge badge--warning" style={{ alignSelf: 'flex-start' }}>
        Sem feedback
      </span>
    );
  }
  const dims = ev.effectiveFeedbackDimensions;
  return (
    <div className="stack" style={{ gap: 'var(--space-1)' }}>
      <span className="badge badge--ok" style={{ alignSelf: 'flex-start' }}>
        Avaliado
      </span>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {dims.map((d) => {
          const v = ev.myFeedback?.scores?.[d.key];
          return (
            <span
              key={d.key}
              className="badge"
              style={{
                border: '1px solid var(--border-default, #eee)',
                padding: '4px 10px',
                borderRadius: 9999,
              }}
            >
              {d.label}: <strong className="tabular-nums">{typeof v === 'number' ? v : '—'}</strong>
            </span>
          );
        })}
      </div>
      {ev.myFeedback.notes ? (
        <span className="text-caption muted">"{ev.myFeedback.notes}"</span>
      ) : null}
    </div>
  );
}
