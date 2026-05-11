import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch } from '../lib/api';
import { formatDateBR } from '../lib/format-date';

type Turma = { id: string; name: string };
type Ev = { id: string; title: string; startsAt: string };
type Enr = { student: { id: string; fullName: string } };

export default function Attendance() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const prefTurma = searchParams.get('turmaId') ?? '';
  const prefEvent = searchParams.get('eventId') ?? '';
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [eventId, setEventId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enr[]>([]);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBootLoading(true);
      setBootError(null);
      try {
        const from = new Date();
        from.setDate(from.getDate() - 7);
        const to = new Date();
        to.setDate(to.getDate() + 30);
        const [t, evs] = await Promise.all([
          apiFetch<Turma[]>('/turmas'),
          apiFetch<Ev[]>(
            `/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
          ),
        ]);
        if (cancelled) return;
        setTurmas(t);
        setEvents(evs);
        const turmaOk = prefTurma && t.some((x) => x.id === prefTurma);
        const eventOk = prefEvent && evs.some((x) => x.id === prefEvent);
        setTurmaId(turmaOk ? prefTurma : (t[0]?.id ?? ''));
        setEventId(eventOk ? prefEvent : (evs[0]?.id ?? ''));
      } catch (e) {
        if (!cancelled) {
          setBootError(
            e instanceof Error ? e.message : 'Não foi possível carregar turmas e eventos.',
          );
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefTurma, prefEvent]);

  async function openSession() {
    setOpenError(null);
    try {
      const s = await apiFetch<{ id: string }>('/attendance/sessions', {
        method: 'POST',
        body: JSON.stringify({
          turmaId,
          eventId,
          mode: 'MARK_PRESENT',
        }),
      });
      setSessionId(s.id);
      const pack = await apiFetch<{ enrollments: Enr[] }>(
        `/attendance/sessions/${s.id}`,
      );
      setEnrollments(pack.enrollments);
      const init: Record<string, boolean> = {};
      for (const r of pack.enrollments) init[r.student.id] = true;
      setPresent(init);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir a lista.');
      setOpenError(
        e instanceof Error ? e.message : 'Não foi possível abrir a lista. Verifique a conexão.',
      );
    }
  }

  async function finalize() {
    if (!sessionId) return;
    setFinalizeError(null);
    try {
      const records = enrollments.map((r) => ({
        studentId: r.student.id,
        present: !!present[r.student.id],
      }));
      await apiFetch(`/attendance/sessions/${sessionId}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ records }),
      });
      toast.success('Presença salva.');
      setSessionId(null);
      setEnrollments([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir a presença.');
      setFinalizeError(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar. Você pode tentar de novo sem perder as marcações.',
      );
    }
  }

  function onSubmitOpen(e: FormEvent) {
    e.preventDefault();
    void openSession();
  }

  const showTurmasEmpty = !bootLoading && !bootError && turmas.length === 0;
  const showEventsEmpty =
    !bootLoading && !bootError && turmas.length > 0 && events.length === 0;

  return (
    <div className="page stack field-mode">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Presença</h1>
          <p className="page-header__subtitle">Desmarque quem faltou (modo “presentes”). Toques amplos.</p>
        </div>
      </header>

      {bootLoading ? (
        <p className="muted">Carregando turmas e eventos…</p>
      ) : bootError ? (
        <Banner variant="danger">
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <span>{bootError}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setBootError(null);
                setBootLoading(true);
                void (async () => {
                  try {
                    const from = new Date();
                    from.setDate(from.getDate() - 7);
                    const to = new Date();
                    to.setDate(to.getDate() + 30);
                    const [t, evs] = await Promise.all([
                      apiFetch<Turma[]>('/turmas'),
                      apiFetch<Ev[]>(
                        `/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
                      ),
                    ]);
                    setTurmas(t);
                    if (t[0]) setTurmaId(t[0].id);
                    setEvents(evs);
                    if (evs[0]) setEventId(evs[0].id);
                  } catch (e) {
                    setBootError(
                      e instanceof Error
                        ? e.message
                        : 'Não foi possível carregar turmas e eventos.',
                    );
                  } finally {
                    setBootLoading(false);
                  }
                })();
              }}
            >
              Tentar carregar de novo
            </button>
          </div>
        </Banner>
      ) : showTurmasEmpty ? (
        <div className="card stack card--lg" style={{ gap: 'var(--space-4)' }}>
          <h2 className="page-header__title" style={{ fontSize: '1.125rem' }}>
            Nenhuma turma disponível
          </h2>
          <p className="text-body muted" style={{ margin: 0 }}>
            Para registrar presença, é preciso ter pelo menos uma turma cadastrada e alunos matriculados.
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <Link to="/turmas" className="btn btn-primary">
              Ir para turmas
            </Link>
            <Link to="/gestao" className="btn btn-secondary">
              Gestão
            </Link>
          </div>
        </div>
      ) : showEventsEmpty ? (
        <div className="card stack card--lg" style={{ gap: 'var(--space-4)' }}>
          <h2 className="page-header__title" style={{ fontSize: '1.125rem' }}>
            Nenhum evento no período
          </h2>
          <p className="text-body muted" style={{ margin: 0 }}>
            Não há treinos ou eventos agendados nas próximas semanas para vincular à lista de presença.
          </p>
          <Link to="/calendario" className="btn btn-primary">
            Abrir calendário
          </Link>
        </div>
      ) : (
        <>
          {openError ? (
            <Banner variant="danger">
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <span>{openError}</span>
                <button type="button" className="btn btn-secondary" onClick={() => void openSession()}>
                  Tentar abrir a lista de novo
                </button>
              </div>
            </Banner>
          ) : null}
          <form className="card stack card--lg" onSubmit={onSubmitOpen}>
            <label className="stack" htmlFor="attendance-turma">
              <span className="muted" id="attendance-turma-lbl">
                Turma
              </span>
              <select
                id="attendance-turma"
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
                required
                aria-describedby="attendance-turma-lbl"
              >
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack" htmlFor="attendance-evento">
              <span className="muted" id="attendance-evento-lbl">
                Evento
              </span>
              <select
                id="attendance-evento"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                required
                aria-describedby="attendance-evento-lbl"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} — {formatDateBR(ev.startsAt)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-field-cta btn-block">
              Abrir lista
            </button>
          </form>
        </>
      )}
      {enrollments.length ? (
        <div className="card stack card--lg">
          <h2>Atletas</h2>
          {finalizeError ? (
            <Banner variant="danger">
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <span>{finalizeError}</span>
                <button type="button" className="btn btn-secondary" onClick={() => void finalize()}>
                  Tentar salvar de novo
                </button>
              </div>
            </Banner>
          ) : null}
          {enrollments.map((r) => (
            <label
              key={r.student.id}
              className={`field-check field-check--state ${present[r.student.id] ? 'field-check--present' : 'field-check--absent'}`}
            >
              <input
                type="checkbox"
                checked={!!present[r.student.id]}
                onChange={(e) =>
                  setPresent((p) => ({ ...p, [r.student.id]: e.target.checked }))
                }
              />
              <span>{r.student.fullName}</span>
            </label>
          ))}
          <button type="button" className="btn btn-field-cta btn-block" onClick={() => void finalize()}>
            Concluir presença
          </button>
        </div>
      ) : null}
    </div>
  );
}
