import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { errorMessageFromUnknown } from '../lib/api';
import { athleteWorkoutsApi } from '../services/workouts';
import type {
  AthleteWorkoutAssignment,
  AthleteWorkoutExercise,
  WorkoutTodayFeedback as TodayFeedback,
} from '../services/types';

function formatSecs(secs: number | null): string | null {
  if (secs == null) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
}

function exerciseSummary(ex: AthleteWorkoutExercise): string[] {
  const parts: string[] = [];
  if (ex.sets != null) parts.push(`${ex.sets}x`);
  if (ex.repetitions != null) parts.push(`${ex.repetitions} reps`);
  const dur = formatSecs(ex.durationSeconds);
  if (dur) parts.push(`dur ${dur}`);
  const rest = formatSecs(ex.restSeconds);
  if (rest) parts.push(`descanso ${rest}`);
  return parts;
}

export default function MeusTreinos() {
  const { user, activeStudentId } = useAuth();
  const toast = useToast();

  const [list, setList] = useState<AthleteWorkoutAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openExercise, setOpenExercise] =
    useState<AthleteWorkoutExercise | null>(null);

  const [feedbackWorkout, setFeedbackWorkout] =
    useState<AthleteWorkoutAssignment['workout'] | null>(null);
  const [feedbackScores, setFeedbackScores] = useState<Record<string, number>>(
    {},
  );
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [todayByWorkout, setTodayByWorkout] = useState<
    Record<string, TodayFeedback>
  >({});

  const activeStudent = useMemo(
    () => user?.students?.find((s) => s.id === activeStudentId) ?? null,
    [user, activeStudentId],
  );

  useEffect(() => {
    if (user?.role !== 'ATLETA') return;
    if (!activeStudentId) return;
    setLoading(true);
    void athleteWorkoutsApi
      .list(activeStudentId)
      .then(async (data) => {
        setList(data);
        setErr(null);
        // Carrega em paralelo o "feedback de hoje" para cada treino que pediu
        // feedback. Falhas individuais ficam silenciosas — a UI mostra como
        // "ainda não respondeu hoje".
        const withDims = data.filter(
          (a) => (a.workout.feedbackDimensions ?? []).length > 0,
        );
        const todayMap: Record<string, TodayFeedback> = {};
        await Promise.all(
          withDims.map(async (a) => {
            try {
              todayMap[a.workout.id] = await athleteWorkoutsApi.getTodayFeedback(
                activeStudentId,
                a.workout.id,
              );
            } catch {
              todayMap[a.workout.id] = null;
            }
          }),
        );
        setTodayByWorkout(todayMap);
      })
      .catch((e: unknown) => {
        const msg = errorMessageFromUnknown(e, 'Falha ao carregar treinos.');
        setErr(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [user, activeStudentId, toast]);

  function openFeedback(w: AthleteWorkoutAssignment['workout']) {
    const today = todayByWorkout[w.id];
    setFeedbackWorkout(w);
    setFeedbackScores(today?.scores ? { ...today.scores } : {});
    setFeedbackNotes(today?.notes ?? '');
  }

  async function submitFeedback() {
    if (!feedbackWorkout || !activeStudentId) return;
    if (Object.keys(feedbackScores).length === 0) {
      toast.error('Responda ao menos uma dimensão antes de enviar.');
      return;
    }
    setFeedbackBusy(true);
    try {
      const saved = await athleteWorkoutsApi.submitFeedback(
        activeStudentId,
        feedbackWorkout.id,
        { scores: feedbackScores, notes: feedbackNotes },
      );
      setTodayByWorkout((prev) => ({
        ...prev,
        [feedbackWorkout.id]: saved,
      }));
      toast.success('Feedback enviado, obrigado!');
      setFeedbackWorkout(null);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, 'Falha ao enviar feedback.'));
    } finally {
      setFeedbackBusy(false);
    }
  }

  if (user?.role !== 'ATLETA') return <Navigate to="/" replace />;

  return (
    <>
      <div className="page stack">
        <header className="page-header">
          <div className="page-header__text">
            <h1 className="page-header__title">Meus treinos</h1>
            <p className="page-header__subtitle muted">
              {activeStudent
                ? `Treinos atribuídos a ${activeStudent.fullName}.`
                : 'Selecione um aluno na barra superior para ver os treinos.'}
            </p>
          </div>
        </header>

        {err ? <Banner variant="danger">{err}</Banner> : null}

        {!activeStudentId ? (
          <p className="muted">Aguardando seleção do aluno…</p>
        ) : loading ? (
          <p className="muted">Carregando…</p>
        ) : list.length === 0 ? (
          <div className="card stack" style={{ padding: 'var(--space-4)' }}>
            <p className="muted">
              Nenhum treino atribuído no momento. Quando o(a) professor(a) ou a
              turma receber um treino, ele aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
            {list.map((a) => {
              const author =
                a.workout.ownerStaff?.user.fullName ??
                a.workout.createdByUser.fullName;
              return (
                <li key={a.id}>
                  <article
                    className="card stack"
                    style={{ padding: 'var(--space-3)', gap: 'var(--space-2)' }}
                  >
                    <header className="stack" style={{ gap: 'var(--space-1)' }}>
                      <strong className="text-h3" style={{ margin: 0 }}>
                        {a.workout.name}
                      </strong>
                      <span className="text-caption muted">
                        {a.scope === 'TURMA'
                          ? `Da turma ${a.turma?.name ?? ''}`
                          : 'Treino individual'}{' '}
                        · por {author}
                      </span>
                      {a.workout.description ? (
                        <p className="text-body" style={{ margin: 0 }}>
                          {a.workout.description}
                        </p>
                      ) : null}
                      {a.notes ? (
                        <p className="text-caption">
                          <em>Nota da atribuição:</em> {a.notes}
                        </p>
                      ) : null}
                    </header>
                    {(a.workout.feedbackDimensions?.length ?? 0) > 0 ? (
                      <div
                        className="row"
                        style={{
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => openFeedback(a.workout)}
                        >
                          {todayByWorkout[a.workout.id]
                            ? 'Editar feedback de hoje'
                            : 'Finalizar e dar feedback'}
                        </button>
                        {todayByWorkout[a.workout.id] ? (
                          <span className="text-caption muted">
                            Respondido hoje · você pode editar
                          </span>
                        ) : (
                          <span className="text-caption muted">
                            Após o treino, registre como se sentiu.
                          </span>
                        )}
                      </div>
                    ) : null}
                    <ol className="plain stack" style={{ gap: 'var(--space-2)' }}>
                      {a.workout.exercises.map((ex, idx) => {
                        const summary = exerciseSummary(ex);
                        return (
                          <li key={ex.id}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{
                                width: '100%',
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                padding: 'var(--space-2)',
                                border:
                                  '1px solid var(--border-default, #eee)',
                                borderRadius: 'var(--radius-sm, 6px)',
                              }}
                              onClick={() => setOpenExercise(ex)}
                            >
                              <span
                                className="stack"
                                style={{ gap: 0, width: '100%' }}
                              >
                                <strong>
                                  {idx + 1}. {ex.nameSnapshot}
                                </strong>
                                {summary.length ? (
                                  <span className="text-caption muted">
                                    {summary.join(' · ')}
                                  </span>
                                ) : null}
                                {ex.videoUrlSnapshot ? (
                                  <span className="text-caption">
                                    ▶ Tem vídeo de referência
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {openExercise ? (
        <Modal
          open
          title={openExercise.nameSnapshot}
          onClose={() => setOpenExercise(null)}
        >
          <div className="stack">
            {exerciseSummary(openExercise).length ? (
              <p className="text-caption muted">
                {exerciseSummary(openExercise).join(' · ')}
              </p>
            ) : null}
            {openExercise.descriptionSnapshot ? (
              <p>
                <strong>Objetivo:</strong> {openExercise.descriptionSnapshot}
              </p>
            ) : (
              <p className="muted">Sem descrição.</p>
            )}
            {openExercise.notes ? (
              <p className="text-caption">
                <em>Nota do treino:</em> {openExercise.notes}
              </p>
            ) : null}
            {openExercise.videoUrlSnapshot ? (
              <p>
                <a
                  href={openExercise.videoUrlSnapshot}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  ▶ Assistir vídeo de referência
                </a>
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {feedbackWorkout ? (
        <Modal
          open
          title={`Como foi ${feedbackWorkout.name}?`}
          onClose={() => setFeedbackWorkout(null)}
        >
          <div className="stack">
            <p className="text-caption muted">
              Avalie de 1 (muito leve) a 5 (muito intenso) cada item abaixo. Você
              pode reabrir e ajustar até o final do dia.
            </p>
            {feedbackWorkout.feedbackDimensions.map((d) => {
              const value = feedbackScores[d.key];
              return (
                <div key={d.key} className="stack" style={{ gap: 'var(--space-1)' }}>
                  <div
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <strong>{d.label}</strong>
                    <span className="text-caption muted">
                      {value ?? '—'}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={
                          value === n ? 'btn btn-primary' : 'btn btn-ghost'
                        }
                        style={{ flex: 1 }}
                        onClick={() =>
                          setFeedbackScores((s) => ({ ...s, [d.key]: n }))
                        }
                      >
                        {n}
                      </button>
                    ))}
                    {value != null ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Limpar resposta"
                        onClick={() =>
                          setFeedbackScores((s) => {
                            const next = { ...s };
                            delete next[d.key];
                            return next;
                          })
                        }
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <label className="stack">
              <span className="muted">Comentário (opcional)</span>
              <textarea
                className="input"
                rows={3}
                maxLength={280}
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="Ex: dor no joelho, gostei da intensidade…"
              />
            </label>
            <div
              className="row"
              style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setFeedbackWorkout(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitFeedback()}
                disabled={feedbackBusy}
              >
                {feedbackBusy ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
