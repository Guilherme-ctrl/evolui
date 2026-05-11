import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EventFeedbackPanel } from '../components/EventFeedbackPanel';
import { Modal } from '../components/Modal';
import { TimeInput24 } from '../components/TimeInput24';
import { useToast } from '../components/useToast';
import { isAdmin as roleIsAdmin, isAthlete as roleIsAthlete } from '../domain/rbac';
import { runDeferredEffect } from '../lib/run-deferred';
import {
  addDays,
  addWeeks,
  combineDayKeyAndTime,
  endOfDay,
  getCalendarGrid,
  getHoursAxis,
  getWeekGrid,
  getWeekStart,
  layoutEventsInLanes,
  sameMonth,
  startOfDay,
  toDayKey,
  toTimeInputValue,
} from '../lib/calendar-grid';
import {
  formatDateBR,
  formatMonthYearBR,
  formatTimeBR,
  formatWeekdayLongBR,
  formatYmdToBR,
} from '../lib/format-date';
import { calendarApi } from '../services/calendar';
import { turmasApi } from '../services/turmas';
import {
  CALENDAR_EVENT_TYPES,
  type CalendarEvent as Ev,
  type TurmaLite as TurmaOpt,
} from '../services/types';

const EVENT_TYPES = CALENDAR_EVENT_TYPES;

type CalendarView = 'month' | 'week' | 'day';
const VIEW_STORAGE_KEY = 'calendar:view';

/** Janela horária mostrada nas visões Semana/Dia (06:00 → 22:00). */
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOUR_HEIGHT_PX = 48;
const HOURS = getHoursAxis(DAY_START_HOUR, DAY_END_HOUR);
const DAY_TOTAL_HEIGHT_PX = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT_PX;

const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function readStoredView(): CalendarView {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'month' || v === 'week' || v === 'day') return v;
  } catch {
    // localStorage indisponível — segue com default.
  }
  return 'month';
}

function eventBadgeClass(status: string) {
  if (status === 'CANCELLED') return 'badge badge--danger';
  if (status === 'SCHEDULED') return 'badge badge--info';
  return 'badge badge--neutral';
}

/**
 * Converte um Date em "minutos desde 00:00 do mesmo dia", **clampeado** à
 * janela horária visível. Útil para posicionar blocos quando um evento
 * começa antes/termina depois da janela.
 */
function minutesInDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export default function Calendar() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = roleIsAdmin(user);
  const isAthlete = roleIsAthlete(user);
  const [view, setView] = useState<CalendarView>(() => readStoredView());
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [rows, setRows] = useState<Ev[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [selectedDayKey, setSelectedDayKey] = useState(() => toDayKey(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [moreDayKey, setMoreDayKey] = useState<string | null>(null);

  const [formType, setFormType] = useState<string>('TREINO');
  const [formTitle, setFormTitle] = useState('');
  const [formTimeStart, setFormTimeStart] = useState('09:00');
  const [formTimeEnd, setFormTimeEnd] = useState('10:00');
  const [formLocation, setFormLocation] = useState('');
  const [formWholeSchool, setFormWholeSchool] = useState(false);
  const [formTurmaIds, setFormTurmaIds] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  /** Range de eventos a carregar, ajustado à visão. */
  const visibleRange = useMemo(() => {
    if (view === 'month') {
      const grid = getCalendarGrid(anchorDate);
      return { from: grid[0], to: endOfDay(grid[41]) };
    }
    if (view === 'week') {
      const start = getWeekStart(anchorDate);
      return { from: startOfDay(start), to: endOfDay(addDays(start, 6)) };
    }
    return { from: startOfDay(anchorDate), to: endOfDay(anchorDate) };
  }, [view, anchorDate]);

  const loadEvents = useCallback(async () => {
    const { from, to } = visibleRange;
    const list = await calendarApi.list({ from, to, take: 200 });
    setRows(list);
  }, [visibleRange]);

  useEffect(() => {
    return runDeferredEffect(() => {
      void loadEvents().catch(() => setRows([]));
    });
  }, [loadEvents]);

  useEffect(() => {
    if (!isAdmin) return;
    return runDeferredEffect(() => {
      void turmasApi
        .list()
        .then((t) => {
          setTurmas(t);
          const init: Record<string, boolean> = {};
          for (const x of t) init[x.id] = false;
          setFormTurmaIds(init);
        })
        .catch(() => setTurmas([]));
    });
  }, [isAdmin]);

  /** Eventos por dia (chave YYYY-MM-DD), ordenados por horário de início. */
  const eventsByDay = useMemo(() => {
    const m: Record<string, Ev[]> = {};
    for (const e of rows) {
      const k = toDayKey(new Date(e.startsAt));
      if (!m[k]) m[k] = [];
      m[k].push(e);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return m;
  }, [rows]);

  const selectedDayEvents = eventsByDay[selectedDayKey] ?? [];

  const selectedEvent = useMemo(
    () => rows.find((e) => e.id === selectedEventId) ?? null,
    [rows, selectedEventId],
  );

  useEffect(() => {
    if (!selectedEvent || !isAdmin) return;
    return runDeferredEffect(() => {
      setSelectedDayKey(toDayKey(new Date(selectedEvent.startsAt)));
      setFormType(selectedEvent.type);
      setFormTitle(selectedEvent.title);
      setFormTimeStart(toTimeInputValue(new Date(selectedEvent.startsAt)));
      setFormTimeEnd(toTimeInputValue(new Date(selectedEvent.endsAt)));
      setFormLocation(selectedEvent.location ?? '');
      setFormWholeSchool(selectedEvent.isWholeSchool);
      const init: Record<string, boolean> = {};
      for (const t of turmas) {
        init[t.id] = selectedEvent.turmas.some((x) => x.turmaId === t.id);
      }
      setFormTurmaIds(init);
    });
  }, [selectedEvent, isAdmin, turmas]);

  useEffect(() => {
    if (selectedEventId) return;
    return runDeferredEffect(() => {
      setFormTimeStart('09:00');
      setFormTimeEnd('10:00');
    });
  }, [selectedDayKey, selectedEventId]);

  function startNewEventDraft() {
    setSelectedEventId(null);
    setFormType('TREINO');
    setFormTitle('');
    setFormLocation('');
    setFormWholeSchool(false);
    const init: Record<string, boolean> = {};
    for (const t of turmas) init[t.id] = turmas.length === 1;
    setFormTurmaIds(init);
  }

  function toggleTurma(id: string) {
    setFormTurmaIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function pickDay(dayKey: string) {
    setSelectedDayKey(dayKey);
    // Em mês, manter o anchor (mês) onde está. Em semana/dia, mover anchor
    // para o dia clicado dá uma navegação mais previsível.
    if (view !== 'month') {
      const [y, m, d] = dayKey.split('-').map(Number);
      setAnchorDate(new Date(y, m - 1, d));
    }
  }

  function pickEvent(ev: Ev) {
    setSelectedDayKey(toDayKey(new Date(ev.startsAt)));
    setSelectedEventId(ev.id);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    const startsAt = combineDayKeyAndTime(selectedDayKey, formTimeStart);
    const endsAt = combineDayKeyAndTime(selectedDayKey, formTimeEnd);
    if (endsAt.getTime() <= startsAt.getTime()) {
      toast.error('O horário de término deve ser depois do início.');
      return;
    }
    const turmaIds = Object.entries(formTurmaIds)
      .filter(([, on]) => on)
      .map(([tid]) => tid);
    if (!formWholeSchool && turmaIds.length === 0) {
      toast.error('Selecione ao menos uma turma ou marque “toda a escolinha”.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: formType,
        title: formTitle.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: formLocation.trim() || undefined,
        isWholeSchool: formWholeSchool,
      } as const;
      if (selectedEventId) {
        await calendarApi.update(selectedEventId, {
          ...payload,
          turmaIds: formWholeSchool ? [] : turmaIds,
        });
        toast.success('Evento atualizado.');
      } else {
        await calendarApi.create({
          ...payload,
          turmaIds: formWholeSchool ? undefined : turmaIds,
        });
        toast.success('Evento criado.');
      }
      await loadEvents();
      setSelectedEventId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function onCancelEventConfirm(reason?: string) {
    if (!isAdmin || !selectedEventId) return;
    setSaving(true);
    try {
      await calendarApi.cancel(selectedEventId, reason);
      toast.success('Evento cancelado.');
      setCancelOpen(false);
      setSelectedEventId(null);
      await loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancelamento falhou.');
    } finally {
      setSaving(false);
    }
  }

  function navPrev() {
    if (view === 'month') {
      const d = new Date(anchorDate);
      d.setMonth(d.getMonth() - 1);
      setAnchorDate(d);
    } else if (view === 'week') {
      setAnchorDate(addWeeks(anchorDate, -1));
    } else {
      setAnchorDate(addDays(anchorDate, -1));
    }
  }
  function navNext() {
    if (view === 'month') {
      const d = new Date(anchorDate);
      d.setMonth(d.getMonth() + 1);
      setAnchorDate(d);
    } else if (view === 'week') {
      setAnchorDate(addWeeks(anchorDate, 1));
    } else {
      setAnchorDate(addDays(anchorDate, 1));
    }
  }
  function navToday() {
    const now = new Date();
    setAnchorDate(now);
    setSelectedDayKey(toDayKey(now));
  }

  const headerLabel = useMemo(() => {
    if (view === 'month') return formatMonthYearBR(anchorDate);
    if (view === 'week') {
      const start = getWeekStart(anchorDate);
      const end = addDays(start, 6);
      const sameMo = start.getMonth() === end.getMonth();
      const startTxt = sameMo
        ? String(start.getDate()).padStart(2, '0')
        : formatDateBR(start);
      const endTxt = formatDateBR(end);
      return `${startTxt} – ${endTxt}`;
    }
    return formatWeekdayLongBR(anchorDate);
  }, [view, anchorDate]);

  const selectedDateLabel = formatYmdToBR(selectedDayKey);

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Calendário</h1>
          <p className="page-header__subtitle">
            Alterne entre as visões mês, semana e dia. Administradores criam e editam eventos.
          </p>
        </div>
      </header>

      {!isAdmin ? (
        <p className="admin-hint">
          Somente <strong>ADMIN</strong> pode criar, alterar ou cancelar eventos. Treinadores e
          atletas veem os eventos das turmas permitidas e podem registrar feedback físico após
          cada evento.
        </p>
      ) : null}

      <div className="cal-layout">
        <div className="card card--lg stack">
          <div className="cal-toolbar">
            <div className="cal-toolbar__nav">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={navPrev}
                aria-label="Anterior"
              >
                ←
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={navToday}
                aria-label="Ir para hoje"
              >
                Hoje
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={navNext}
                aria-label="Próximo"
              >
                →
              </button>
            </div>
            <h2 className="cal-toolbar__label">{headerLabel}</h2>
            <div
              className="cal-toolbar__views"
              role="tablist"
              aria-label="Modo de visualização do calendário"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === 'month'}
                className={`cal-view-btn ${view === 'month' ? 'is-active' : ''}`}
                onClick={() => setView('month')}
              >
                Mês
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'week'}
                className={`cal-view-btn ${view === 'week' ? 'is-active' : ''}`}
                onClick={() => setView('week')}
              >
                Semana
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'day'}
                className={`cal-view-btn ${view === 'day' ? 'is-active' : ''}`}
                onClick={() => setView('day')}
              >
                Dia
              </button>
            </div>
          </div>

          {view === 'month' ? (
            <MonthView
              anchor={anchorDate}
              selectedDayKey={selectedDayKey}
              eventsByDay={eventsByDay}
              onPickDay={pickDay}
              onPickEvent={pickEvent}
              onShowMore={(k) => setMoreDayKey(k)}
            />
          ) : view === 'week' ? (
            <WeekView
              anchor={anchorDate}
              selectedDayKey={selectedDayKey}
              eventsByDay={eventsByDay}
              onPickDay={pickDay}
              onPickEvent={pickEvent}
            />
          ) : (
            <DayView
              anchor={anchorDate}
              eventsByDay={eventsByDay}
              onPickEvent={pickEvent}
            />
          )}
        </div>

        <div className="stack">
          <div className="card card--lg stack">
            <h3 className="cal-panel-title">{formatWeekdayLongBR(`${selectedDayKey}T12:00:00`)}</h3>
            <ul className="plain">
              {selectedDayEvents.length === 0 ? (
                <li className="muted">Nenhum evento neste dia.</li>
              ) : (
                selectedDayEvents.map((ev) => (
                  <li key={ev.id} className="list-row stack" style={{ gap: 'var(--space-2)' }}>
                    <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <strong>{ev.title}</strong>
                      <span className={eventBadgeClass(ev.status)}>{ev.status}</span>
                    </div>
                    <span className="text-caption tabular-nums">
                      {formatTimeBR(ev.startsAt)} – {formatTimeBR(ev.endsAt)}
                    </span>
                    {ev.turmas.length ? (
                      <span className="text-caption">
                        {ev.turmas.map((x) => x.turma.name).join(', ')}
                      </span>
                    ) : ev.isWholeSchool ? (
                      <span className="text-caption">Toda a escolinha</span>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ alignSelf: 'flex-start', minHeight: '36px' }}
                        onClick={() => setSelectedEventId(ev.id)}
                      >
                        Editar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={
                          isAthlete && (ev.effectiveFeedbackDimensions?.length ?? 0) > 0
                            ? 'btn btn-primary'
                            : 'btn btn-ghost'
                        }
                        style={{ alignSelf: 'flex-start', minHeight: '36px' }}
                        onClick={() => setSelectedEventId(ev.id)}
                      >
                        {isAthlete && (ev.effectiveFeedbackDimensions?.length ?? 0) > 0
                          ? 'Avaliar / detalhes'
                          : 'Detalhes'}
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>

          {selectedEvent ? (
            <EventFeedbackPanel
              event={selectedEvent}
              onChanged={() => void loadEvents()}
            />
          ) : null}

          {isAdmin ? (
            <form className="card card--lg stack" onSubmit={onSubmit}>
              <h3 className="cal-panel-title">{selectedEventId ? 'Editar evento' : 'Novo evento'}</h3>
              <p className="cal-day-selected-hint">
                Data do evento: <strong>{selectedDateLabel}</strong>
                <span className="muted"> — escolha o dia na grade acima; aqui informe só os horários.</span>
              </p>
              {selectedEventId ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => {
                    startNewEventDraft();
                  }}
                >
                  Criar outro neste dia
                </button>
              ) : null}
              <label className="stack">
                <span className="muted">Tipo</span>
                <select value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Título</span>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required minLength={2} />
              </label>
              <div className="form-grid-2">
                <label className="stack">
                  <span className="muted">Início (hora)</span>
                  <TimeInput24
                    value={formTimeStart}
                    onChange={setFormTimeStart}
                    required
                  />
                </label>
                <label className="stack">
                  <span className="muted">Término (hora)</span>
                  <TimeInput24
                    value={formTimeEnd}
                    onChange={setFormTimeEnd}
                    required
                  />
                </label>
              </div>
              <label className="stack">
                <span className="muted">Local (opcional)</span>
                <input value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
              </label>
              <label className="field-check">
                <input
                  type="checkbox"
                  checked={formWholeSchool}
                  onChange={(e) => setFormWholeSchool(e.target.checked)}
                />
                <span>Evento da escolinha inteira</span>
              </label>
              {!formWholeSchool ? (
                <div className="stack">
                  <span className="muted">Turmas</span>
                  <div className="turma-check-grid">
                    {turmas.map((t) => (
                      <label key={t.id}>
                        <input
                          type="checkbox"
                          checked={!!formTurmaIds[t.id]}
                          onChange={() => toggleTurma(t.id)}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="row" style={{ gap: 'var(--space-3)' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : selectedEventId ? 'Salvar alterações' : 'Criar evento'}
                </button>
                {selectedEventId && selectedEvent?.status === 'SCHEDULED' ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={saving}
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancelar evento
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar evento"
        description="O evento será marcado como cancelado. Esta ação pode ser vista por treinadores e responsáveis conforme permissões."
        confirmLabel="Confirmar cancelamento"
        danger
        busy={saving}
        prompt={{
          label: 'Motivo do cancelamento (opcional)',
          placeholder: 'Ex.: chuva, campo indisponível…',
          optional: true,
        }}
        onConfirm={(r) => void onCancelEventConfirm(r)}
      />

      <Modal
        open={moreDayKey !== null}
        onClose={() => setMoreDayKey(null)}
        title={moreDayKey ? formatWeekdayLongBR(`${moreDayKey}T12:00:00`) : ''}
      >
        {moreDayKey ? (
          <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
            {(eventsByDay[moreDayKey] ?? []).map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  className="cal-more-row"
                  onClick={() => {
                    pickEvent(ev);
                    setMoreDayKey(null);
                  }}
                >
                  <span className="cal-more-row__time tabular-nums">
                    {formatTimeBR(ev.startsAt)}
                  </span>
                  <span className="cal-more-row__title">{ev.title}</span>
                  <span className={eventBadgeClass(ev.status)}>{ev.status}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes de visualização
// ---------------------------------------------------------------------------

type MonthViewProps = {
  anchor: Date;
  selectedDayKey: string;
  eventsByDay: Record<string, Ev[]>;
  onPickDay: (dayKey: string) => void;
  onPickEvent: (ev: Ev) => void;
  onShowMore: (dayKey: string) => void;
};

function MonthView({
  anchor,
  selectedDayKey,
  eventsByDay,
  onPickDay,
  onPickEvent,
  onShowMore,
}: MonthViewProps) {
  const grid = useMemo(() => getCalendarGrid(anchor), [anchor]);
  const todayKey = useMemo(() => toDayKey(new Date()), []);
  return (
    <>
      <div className="cal-weekdays">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-grid">
        {grid.map((day) => {
          const key = toDayKey(day);
          const inMonth = sameMonth(day, anchor);
          const dayEvents = eventsByDay[key] ?? [];
          const isToday = key === todayKey;
          const isSel = key === selectedDayKey;
          const visible = dayEvents.slice(0, 3);
          const hidden = dayEvents.length - visible.length;
          return (
            <div
              key={key}
              className={`cal-day ${!inMonth ? 'cal-day--outside' : ''} ${isToday ? 'cal-day--today' : ''} ${isSel ? 'cal-day--selected' : ''}`}
              role="gridcell"
            >
              <button
                type="button"
                className="cal-day-num"
                onClick={() => onPickDay(key)}
              >
                {day.getDate()}
              </button>
              <div className="cal-day-events">
                {visible.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`cal-chip ${ev.status === 'CANCELLED' ? 'cal-chip--cancelled' : ''}`}
                    title={`${formatTimeBR(ev.startsAt)} — ${ev.title}`}
                    onClick={() => onPickEvent(ev)}
                  >
                    <span className="cal-chip__time tabular-nums">
                      {formatTimeBR(ev.startsAt)}
                    </span>{' '}
                    {ev.title}
                  </button>
                ))}
                {hidden > 0 ? (
                  <button
                    type="button"
                    className="cal-more"
                    onClick={() => onShowMore(key)}
                  >
                    +{hidden} mais
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

type TimeGridProps = {
  days: Date[];
  eventsByDay: Record<string, Ev[]>;
  onPickEvent: (ev: Ev) => void;
  onPickDay?: (dayKey: string) => void;
  selectedDayKey?: string;
};

/**
 * Motor de posicionamento dos eventos nas visões com eixo Y horário.
 * Renderiza:
 *  - Coluna 0: rótulos `06`, `07`… `22` (alinhados à hora).
 *  - Colunas 1..N: uma por dia. Eventos como blocos absolutos com
 *    posicionamento por lane (sobreposições viram colunas internas).
 */
function TimeGrid({
  days,
  eventsByDay,
  onPickEvent,
  onPickDay,
  selectedDayKey,
}: TimeGridProps) {
  const todayKey = useMemo(() => toDayKey(new Date()), []);
  const dayStartMin = DAY_START_HOUR * 60;
  const totalMin = (DAY_END_HOUR - DAY_START_HOUR) * 60;

  return (
    <div className="cal-time" style={{ ['--cal-day-cols' as string]: days.length }}>
      <div className="cal-time__head">
        <div className="cal-time__corner" aria-hidden />
        {days.map((d) => {
          const key = toDayKey(d);
          const isToday = key === todayKey;
          const isSel = key === selectedDayKey;
          return (
            <button
              type="button"
              key={key}
              className={`cal-time__dayhead ${isToday ? 'is-today' : ''} ${isSel ? 'is-selected' : ''}`}
              onClick={() => onPickDay?.(key)}
            >
              <span className="cal-time__weekday">
                {WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}
              </span>
              <span className="cal-time__daynum">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className="cal-time__body" style={{ height: DAY_TOTAL_HEIGHT_PX }}>
        <div className="cal-time__hours" aria-hidden>
          {HOURS.map((h) => (
            <div
              key={h}
              className="cal-time__hour"
              style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT_PX }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        <div className="cal-time__columns">
          {days.map((d) => {
            const key = toDayKey(d);
            const evs = eventsByDay[key] ?? [];
            const laidOut = layoutEventsInLanes(
              evs.map((ev) => ({
                ev,
                startsAt: new Date(ev.startsAt),
                endsAt: new Date(ev.endsAt),
              })),
            );
            return (
              <div key={key} className="cal-time__col">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="cal-time__slot"
                    style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT_PX }}
                    aria-hidden
                  />
                ))}
                {laidOut.map(({ ev, startsAt, endsAt, lane, groupSize }) => {
                  const startMin = Math.max(minutesInDay(startsAt), dayStartMin);
                  const endMin = Math.min(
                    minutesInDay(endsAt),
                    dayStartMin + totalMin,
                  );
                  if (endMin <= dayStartMin || startMin >= dayStartMin + totalMin) {
                    return null;
                  }
                  const top = ((startMin - dayStartMin) / 60) * HOUR_HEIGHT_PX;
                  const height = Math.max(
                    20,
                    ((endMin - startMin) / 60) * HOUR_HEIGHT_PX - 2,
                  );
                  const widthPct = 100 / Math.max(1, groupSize);
                  const leftPct = widthPct * lane;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`cal-event-block cal-event-block--${ev.type.toLowerCase()} ${ev.status === 'CANCELLED' ? 'is-cancelled' : ''}`}
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      onClick={() => onPickEvent(ev)}
                      title={`${formatTimeBR(ev.startsAt)} – ${formatTimeBR(ev.endsAt)} · ${ev.title}`}
                    >
                      <span className="cal-event-block__time tabular-nums">
                        {formatTimeBR(ev.startsAt)} – {formatTimeBR(ev.endsAt)}
                      </span>
                      <span className="cal-event-block__title">{ev.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type WeekViewProps = {
  anchor: Date;
  selectedDayKey: string;
  eventsByDay: Record<string, Ev[]>;
  onPickDay: (dayKey: string) => void;
  onPickEvent: (ev: Ev) => void;
};

function WeekView({
  anchor,
  selectedDayKey,
  eventsByDay,
  onPickDay,
  onPickEvent,
}: WeekViewProps) {
  const days = useMemo(() => getWeekGrid(anchor), [anchor]);
  return (
    <TimeGrid
      days={days}
      eventsByDay={eventsByDay}
      onPickDay={onPickDay}
      onPickEvent={onPickEvent}
      selectedDayKey={selectedDayKey}
    />
  );
}

type DayViewProps = {
  anchor: Date;
  eventsByDay: Record<string, Ev[]>;
  onPickEvent: (ev: Ev) => void;
};

function DayView({ anchor, eventsByDay, onPickEvent }: DayViewProps) {
  const days = useMemo(() => [new Date(anchor)], [anchor]);
  return (
    <TimeGrid
      days={days}
      eventsByDay={eventsByDay}
      onPickEvent={onPickEvent}
      selectedDayKey={toDayKey(anchor)}
    />
  );
}
