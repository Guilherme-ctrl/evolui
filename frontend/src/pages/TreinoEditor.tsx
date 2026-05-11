import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FeedbackDimensionsEditor,
  validateDimensions,
  type FeedbackDimension as SharedDim,
} from '../components/FeedbackDimensionsEditor';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import { formatYmdToBR } from '../lib/format-date';

type WorkoutExercise = {
  id: string;
  order: number;
  libraryItemId: string;
  nameSnapshot: string;
  descriptionSnapshot: string | null;
  videoUrlSnapshot: string | null;
  sets: number | null;
  repetitions: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
};

type WorkoutAssignment = {
  id: string;
  scope: 'TURMA' | 'STUDENT';
  turma: { id: string; name: string } | null;
  student: { id: string; fullName: string; active: boolean } | null;
  notes: string | null;
  createdAt: string;
};

type FeedbackDimension = { key: string; label: string; order: number };

type Workout = {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  archived: boolean;
  createdByUser: { id: string; fullName: string; role: string };
  ownerStaff: { id: string; user: { id: string; fullName: string } } | null;
  exercises: WorkoutExercise[];
  assignments: WorkoutAssignment[];
  feedbackDimensions: FeedbackDimension[];
};

type FeedbackReport = {
  workoutId: string;
  dimensions: FeedbackDimension[];
  averages: Array<{
    key: string;
    label: string;
    count: number;
    average: number | null;
  }>;
  feedbacks: Array<{
    id: string;
    submittedDate: string;
    scores: Record<string, number>;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    student: { id: string; fullName: string; active: boolean };
    submittedByUser: { id: string; fullName: string; email: string };
  }>;
};

type LibraryItem = {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  defaultSets: number | null;
  defaultRepetitions: number | null;
  defaultDurationSeconds: number | null;
  defaultRestSeconds: number | null;
  archived: boolean;
};

type TurmaOption = { id: string; name: string };
type StudentOption = { id: string; fullName: string; active: boolean };

function formatSecs(secs: number | null): string | null {
  if (secs == null) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
}

function exerciseSummary(ex: WorkoutExercise): string[] {
  const parts: string[] = [];
  if (ex.sets != null) parts.push(`${ex.sets}x`);
  if (ex.repetitions != null) parts.push(`${ex.repetitions} reps`);
  const dur = formatSecs(ex.durationSeconds);
  if (dur) parts.push(`dur ${dur}`);
  const rest = formatSecs(ex.restSeconds);
  if (rest) parts.push(`descanso ${rest}`);
  return parts;
}

export default function TreinoEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const canSee =
    user?.role === 'ADMIN' ||
    (user?.role === 'TREINADOR' && user?.staffProfile?.active);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // edit header
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState('');
  const [headerDescription, setHeaderDescription] = useState('');
  const [headerNotes, setHeaderNotes] = useState('');
  const [headerBusy, setHeaderBusy] = useState(false);

  // add exercise modal
  const [adding, setAdding] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [picked, setPicked] = useState<LibraryItem | null>(null);
  const [pickedSets, setPickedSets] = useState('');
  const [pickedReps, setPickedReps] = useState('');
  const [pickedDur, setPickedDur] = useState('');
  const [pickedRest, setPickedRest] = useState('');
  const [pickedNotes, setPickedNotes] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  // delete exercise
  const [pendingDelete, setPendingDelete] = useState<WorkoutExercise | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  // assign modal
  const [assigning, setAssigning] = useState(false);
  const [turmaOptions, setTurmaOptions] = useState<TurmaOption[]>([]);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [assignScope, setAssignScope] = useState<'TURMA' | 'STUDENT'>('TURMA');
  const [assignTurma, setAssignTurma] = useState('');
  const [assignStudent, setAssignStudent] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);

  // feedback dimensions editor (modal)
  const [editingDims, setEditingDims] = useState(false);
  const [dimDraft, setDimDraft] = useState<FeedbackDimension[]>([]);
  const [dimsBusy, setDimsBusy] = useState(false);

  // feedback report (responses panel)
  const [feedbackReport, setFeedbackReport] = useState<FeedbackReport | null>(
    null,
  );
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  async function reload() {
    if (!id) return;
    setLoading(true);
    try {
      const w = await apiFetch<Workout>(`/workouts/${id}`);
      setWorkout(w);
      setHeaderName(w.name);
      setHeaderDescription(w.description ?? '');
      setHeaderNotes(w.notes ?? '');
      setErr(null);
    } catch (e) {
      const msg = errorMessageFromUnknown(e, 'Falha ao carregar treino.');
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const reloadFeedbackReport = useCallback(async () => {
    if (!id) return;
    setFeedbackLoading(true);
    try {
      const r = await apiFetch<FeedbackReport>(`/workouts/${id}/feedback`);
      setFeedbackReport(r);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, 'Falha ao carregar feedback.'));
    } finally {
      setFeedbackLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (!canSee) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee, id]);

  useEffect(() => {
    if (!canSee || !id) return;
    void reloadFeedbackReport();
  }, [canSee, id, reloadFeedbackReport]);

  useEffect(() => {
    if (!adding) return;
    const t = window.setTimeout(async () => {
      try {
        const qs = librarySearch.trim()
          ? `?search=${encodeURIComponent(librarySearch.trim())}`
          : '';
        const list = await apiFetch<LibraryItem[]>(
          `/exercise-library${qs}`,
        );
        setLibrary(list);
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, 'Falha ao carregar biblioteca.'));
      }
    }, librarySearch.trim() ? 200 : 0);
    return () => window.clearTimeout(t);
  }, [adding, librarySearch, toast]);

  useEffect(() => {
    if (!assigning) return;
    void (async () => {
      try {
        const [turmas, students] = await Promise.all([
          apiFetch<TurmaOption[]>('/turmas'),
          apiFetch<StudentOption[]>('/students'),
        ]);
        setTurmaOptions(turmas);
        setStudentOptions(students.filter((s) => s.active));
      } catch (e) {
        toast.error(
          errorMessageFromUnknown(e, 'Falha ao carregar alvos de atribuição.'),
        );
      }
    })();
  }, [assigning, toast]);

  const assignedTurmaIds = useMemo(
    () =>
      new Set(
        workout?.assignments
          .filter((a) => a.scope === 'TURMA' && a.turma?.id)
          .map((a) => a.turma!.id) ?? [],
      ),
    [workout],
  );
  const assignedStudentIds = useMemo(
    () =>
      new Set(
        workout?.assignments
          .filter((a) => a.scope === 'STUDENT' && a.student?.id)
          .map((a) => a.student!.id) ?? [],
      ),
    [workout],
  );

  if (!canSee) return <Navigate to="/" replace />;
  if (loading && !workout) {
    return (
      <div className="page stack">
        <p className="muted">Carregando…</p>
      </div>
    );
  }
  if (!workout) {
    return (
      <div className="page stack">
        {err ? <Banner variant="danger">{err}</Banner> : null}
      </div>
    );
  }

  async function submitHeader(e: FormEvent) {
    e.preventDefault();
    if (headerName.trim().length < 2) {
      toast.error('Nome do treino é obrigatório.');
      return;
    }
    setHeaderBusy(true);
    try {
      await apiFetch(`/workouts/${workout!.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: headerName.trim(),
          description: headerDescription.trim() || null,
          notes: headerNotes.trim() || null,
        }),
      });
      toast.success('Treino atualizado.');
      setEditingHeader(false);
      void reload();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao atualizar treino.'));
    } finally {
      setHeaderBusy(false);
    }
  }

  function startPickExercise(item: LibraryItem) {
    setPicked(item);
    setPickedSets(item.defaultSets?.toString() ?? '');
    setPickedReps(item.defaultRepetitions?.toString() ?? '');
    setPickedDur(item.defaultDurationSeconds?.toString() ?? '');
    setPickedRest(item.defaultRestSeconds?.toString() ?? '');
    setPickedNotes('');
  }

  async function submitAddExercise() {
    if (!picked) return;
    setAddBusy(true);
    try {
      const body: Record<string, unknown> = { libraryItemId: picked.id };
      if (pickedSets.trim()) body.sets = Number(pickedSets);
      if (pickedReps.trim()) body.repetitions = Number(pickedReps);
      if (pickedDur.trim()) body.durationSeconds = Number(pickedDur);
      if (pickedRest.trim()) body.restSeconds = Number(pickedRest);
      if (pickedNotes.trim()) body.notes = pickedNotes.trim();
      await apiFetch(`/workouts/${workout!.id}/exercises`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Exercício adicionado.');
      setAdding(false);
      setPicked(null);
      void reload();
    } catch (ex) {
      toast.error(
        errorMessageFromUnknown(ex, 'Falha ao adicionar exercício.'),
      );
    } finally {
      setAddBusy(false);
    }
  }

  async function confirmDeleteExercise() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    try {
      await apiFetch(
        `/workouts/${workout!.id}/exercises/${pendingDelete.id}`,
        { method: 'DELETE' },
      );
      toast.success('Exercício removido.');
      setPendingDelete(null);
      void reload();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao remover.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function moveExercise(index: number, dir: -1 | 1) {
    if (!workout) return;
    const target = index + dir;
    if (target < 0 || target >= workout.exercises.length) return;
    const order = workout.exercises.map((e) => e.id);
    [order[index], order[target]] = [order[target], order[index]];
    try {
      await apiFetch(`/workouts/${workout.id}/exercises/reorder`, {
        method: 'POST',
        body: JSON.stringify({ exerciseIds: order }),
      });
      void reload();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao reordenar.'));
    }
  }

  async function submitAssign() {
    setAssignBusy(true);
    try {
      const body: Record<string, unknown> = { scope: assignScope };
      if (assignScope === 'TURMA') body.turmaId = assignTurma;
      else body.studentId = assignStudent;
      if (assignNotes.trim()) body.notes = assignNotes.trim();
      await apiFetch(`/workouts/${workout!.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Atribuição criada.');
      setAssigning(false);
      setAssignTurma('');
      setAssignStudent('');
      setAssignNotes('');
      void reload();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao atribuir.'));
    } finally {
      setAssignBusy(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    try {
      await apiFetch(
        `/workouts/${workout!.id}/assignments/${assignmentId}`,
        { method: 'DELETE' },
      );
      toast.success('Atribuição removida.');
      void reload();
    } catch (ex) {
      toast.error(
        errorMessageFromUnknown(ex, 'Falha ao remover atribuição.'),
      );
    }
  }

  function openDimEditor() {
    setDimDraft(
      workout!.feedbackDimensions.length
        ? workout!.feedbackDimensions.map((d) => ({ ...d }))
        : [],
    );
    setEditingDims(true);
  }

  async function submitDims() {
    const err = validateDimensions(dimDraft);
    if (err) {
      toast.error(err);
      return;
    }
    setDimsBusy(true);
    try {
      const payload = dimDraft.map((d, i) => ({
        key: d.key,
        label: d.label.trim(),
        order: i,
      }));
      await apiFetch(`/workouts/${workout!.id}/feedback-dimensions`, {
        method: 'PATCH',
        body: JSON.stringify({ dimensions: payload }),
      });
      toast.success('Dimensões salvas.');
      setEditingDims(false);
      void reload();
      void reloadFeedbackReport();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao salvar dimensões.'));
    } finally {
      setDimsBusy(false);
    }
  }

  return (
    <>
      <div className="page stack">
        <header className="page-header">
          <div className="page-header__text">
            <Link to="/treinos" className="text-caption muted">
              ← Voltar para Treinos
            </Link>
            <h1 className="page-header__title">{workout.name}</h1>
            <p className="page-header__subtitle muted">
              {workout.description || 'Sem descrição.'}
            </p>
          </div>
          <div className="page-header__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingHeader(true)}
            >
              Editar
            </button>
          </div>
        </header>

        {err ? <Banner variant="danger">{err}</Banner> : null}

        <section className="card stack" style={{ padding: 'var(--space-3)' }}>
          <header
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <h2 className="text-h3" style={{ margin: 0 }}>
              Exercícios ({workout.exercises.length})
            </h2>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAdding(true)}
            >
              + Adicionar da biblioteca
            </button>
          </header>
          {workout.exercises.length === 0 ? (
            <p className="muted">
              Adicione exercícios da biblioteca. Cada item leva séries, reps e
              descanso próprios desse treino — mas a ficha do exercício
              (objetivo e vídeo) vem do snapshot do momento da adição.
            </p>
          ) : (
            <ol className="plain stack" style={{ gap: 'var(--space-2)' }}>
              {workout.exercises.map((ex, idx) => {
                const summary = exerciseSummary(ex);
                return (
                  <li key={ex.id}>
                    <article
                      className="card stack"
                      style={{
                        padding: 'var(--space-3)',
                        gap: 'var(--space-1)',
                      }}
                    >
                      <header
                        className="row"
                        style={{
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <div className="stack" style={{ flex: 1 }}>
                          <strong>
                            {idx + 1}. {ex.nameSnapshot}
                          </strong>
                          {summary.length ? (
                            <span className="text-caption muted">
                              {summary.join(' · ')}
                            </span>
                          ) : null}
                          {ex.descriptionSnapshot ? (
                            <span className="text-body">
                              {ex.descriptionSnapshot}
                            </span>
                          ) : null}
                          {ex.notes ? (
                            <span className="text-caption">
                              <em>Nota:</em> {ex.notes}
                            </span>
                          ) : null}
                          {ex.videoUrlSnapshot ? (
                            <a
                              href={ex.videoUrlSnapshot}
                              target="_blank"
                              rel="noreferrer"
                              className="text-caption"
                            >
                              ▶ Vídeo de referência
                            </a>
                          ) : null}
                        </div>
                        <div
                          className="row"
                          style={{ gap: 'var(--space-1)' }}
                        >
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => moveExercise(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Mover para cima"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => moveExercise(idx, 1)}
                            disabled={idx === workout.exercises.length - 1}
                            aria-label="Mover para baixo"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setPendingDelete(ex)}
                          >
                            Remover
                          </button>
                        </div>
                      </header>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="card stack" style={{ padding: 'var(--space-3)' }}>
          <header
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <h2 className="text-h3" style={{ margin: 0 }}>
              Atribuições ({workout.assignments.length})
            </h2>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAssigning(true)}
            >
              + Atribuir
            </button>
          </header>
          {workout.assignments.length === 0 ? (
            <p className="muted">
              Ainda não atribuído. Atribua a uma turma (alcança todos os alunos
              matriculados) ou a alunos específicos.
            </p>
          ) : (
            <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
              {workout.assignments.map((a) => (
                <li
                  key={a.id}
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-2)',
                    border: '1px solid var(--border-default, #eee)',
                    borderRadius: 'var(--radius-sm, 6px)',
                  }}
                >
                  <div className="stack" style={{ gap: 0 }}>
                    <span>
                      <strong>
                        {a.scope === 'TURMA'
                          ? `Turma: ${a.turma?.name ?? '—'}`
                          : `Aluno: ${a.student?.fullName ?? '—'}`}
                      </strong>
                    </span>
                    {a.notes ? (
                      <span className="text-caption muted">{a.notes}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => removeAssignment(a.id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Feedback físico: dimensões + relatório */}
        <section className="card stack">
          <header
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div className="stack" style={{ gap: 0 }}>
              <h2 className="text-h3" style={{ margin: 0 }}>
                Feedback físico pós-treino
              </h2>
              <span className="text-caption muted">
                Configure o que os alunos respondem (1–5) ao terminar o treino.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openDimEditor}
            >
              {workout.feedbackDimensions.length
                ? 'Editar dimensões'
                : '+ Configurar dimensões'}
            </button>
          </header>
          {workout.feedbackDimensions.length === 0 ? (
            <p className="muted">
              Sem feedback configurado. Os alunos não verão o botão "Finalizar e
              dar feedback" para este treino.
            </p>
          ) : (
            <ul
              className="row"
              style={{
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {workout.feedbackDimensions.map((d) => (
                <li
                  key={d.key}
                  className="badge"
                  style={{
                    border: '1px solid var(--border-default, #eee)',
                    padding: '4px 10px',
                    borderRadius: 9999,
                  }}
                >
                  {d.label}
                </li>
              ))}
            </ul>
          )}

          <header className="row" style={{ alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <h3 className="text-h4" style={{ margin: 0 }}>
              Respostas recebidas
            </h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void reloadFeedbackReport()}
              disabled={feedbackLoading}
            >
              {feedbackLoading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </header>
          {!feedbackReport ? (
            <p className="muted">Carregando…</p>
          ) : feedbackReport.feedbacks.length === 0 ? (
            <p className="muted">Nenhum aluno respondeu ainda.</p>
          ) : (
            <>
              <div
                className="row"
                style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
              >
                {feedbackReport.averages.map((a) => (
                  <div
                    key={a.key}
                    className="card"
                    style={{
                      padding: 'var(--space-2)',
                      minWidth: 160,
                      flex: '1 1 160px',
                    }}
                  >
                    <div className="text-caption muted">{a.label}</div>
                    <div className="text-h2" style={{ margin: 0 }}>
                      {a.average == null ? '—' : a.average.toFixed(2)}
                    </div>
                    <div className="text-caption muted">
                      {a.count} resposta{a.count === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
              </div>
              <table className="table" style={{ marginTop: 'var(--space-2)' }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Aluno</th>
                    {feedbackReport.dimensions.map((d) => (
                      <th key={d.key}>{d.label}</th>
                    ))}
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackReport.feedbacks.map((f) => (
                    <tr key={f.id}>
                      <td>{formatYmdToBR(f.submittedDate.slice(0, 10))}</td>
                      <td>{f.student.fullName}</td>
                      {feedbackReport.dimensions.map((d) => (
                        <td key={d.key}>
                          {typeof f.scores?.[d.key] === 'number'
                            ? f.scores[d.key]
                            : '—'}
                        </td>
                      ))}
                      <td className="text-caption muted">{f.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      {/* Editar dimensões de feedback */}
      {editingDims ? (
        <Modal
          open
          title="Dimensões do feedback pós-treino"
          onClose={() => setEditingDims(false)}
        >
          <div className="stack">
            <FeedbackDimensionsEditor
              value={dimDraft as SharedDim[]}
              onChange={(next) => setDimDraft(next)}
              helperText="Cada dimensão é respondida pelo aluno em escala 1–5. Até 5 por treino. O identificador (key) é interno e não muda mesmo se você renomear o rótulo."
            />
            <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditingDims(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitDims()}
                disabled={dimsBusy}
              >
                {dimsBusy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Editar cabeçalho */}
      {editingHeader ? (
        <Modal
          open
          title="Editar treino"
          onClose={() => setEditingHeader(false)}
        >
          <form className="stack" onSubmit={submitHeader}>
            <label className="stack">
              <span className="muted">Nome</span>
              <input
                className="input"
                value={headerName}
                onChange={(e) => setHeaderName(e.target.value)}
                required
                minLength={2}
                maxLength={140}
              />
            </label>
            <label className="stack">
              <span className="muted">Descrição</span>
              <textarea
                className="input"
                value={headerDescription}
                onChange={(e) => setHeaderDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </label>
            <label className="stack">
              <span className="muted">Notas internas</span>
              <textarea
                className="input"
                value={headerNotes}
                onChange={(e) => setHeaderNotes(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </label>
            <div
              className="row"
              style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditingHeader(false)}
                disabled={headerBusy}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={headerBusy}
              >
                {headerBusy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Adicionar exercício */}
      {adding ? (
        <Modal
          open
          title={picked ? `Configurar “${picked.name}”` : 'Adicionar exercício'}
          onClose={() => {
            setAdding(false);
            setPicked(null);
          }}
        >
          {!picked ? (
            <div className="stack">
              <input
                className="input"
                placeholder="Buscar na biblioteca…"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                autoFocus
              />
              {library.length === 0 ? (
                <p className="muted">
                  Nada encontrado.{' '}
                  <Link to="/biblioteca/exercicios">Cadastrar exercício</Link>?
                </p>
              ) : (
                <ul
                  className="plain stack"
                  style={{
                    gap: 'var(--space-1)',
                    maxHeight: '50vh',
                    overflow: 'auto',
                  }}
                >
                  {library.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{
                          width: '100%',
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                        }}
                        onClick={() => startPickExercise(item)}
                      >
                        <span className="stack" style={{ gap: 0 }}>
                          <strong>{item.name}</strong>
                          {item.description ? (
                            <span className="text-caption muted">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="stack">
              <div className="form-grid-2">
                <label className="stack">
                  <span className="muted">Séries</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={999}
                    value={pickedSets}
                    onChange={(e) => setPickedSets(e.target.value)}
                  />
                </label>
                <label className="stack">
                  <span className="muted">Repetições</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={9999}
                    value={pickedReps}
                    onChange={(e) => setPickedReps(e.target.value)}
                  />
                </label>
                <label className="stack">
                  <span className="muted">Duração (s)</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={86400}
                    value={pickedDur}
                    onChange={(e) => setPickedDur(e.target.value)}
                  />
                </label>
                <label className="stack">
                  <span className="muted">Descanso (s)</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={86400}
                    value={pickedRest}
                    onChange={(e) => setPickedRest(e.target.value)}
                  />
                </label>
              </div>
              <label className="stack">
                <span className="muted">Notas (opcional)</span>
                <textarea
                  className="input"
                  rows={2}
                  maxLength={280}
                  value={pickedNotes}
                  onChange={(e) => setPickedNotes(e.target.value)}
                />
              </label>
              <div
                className="row"
                style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPicked(null)}
                  disabled={addBusy}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void submitAddExercise()}
                  disabled={addBusy}
                >
                  {addBusy ? 'Adicionando…' : 'Adicionar ao treino'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}

      {/* Atribuir */}
      {assigning ? (
        <Modal
          open
          title="Atribuir treino"
          onClose={() => setAssigning(false)}
        >
          <div className="stack">
            <div
              className="row"
              role="tablist"
              aria-label="Escopo da atribuição"
              style={{ gap: 'var(--space-1)' }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={assignScope === 'TURMA'}
                className={`btn ${
                  assignScope === 'TURMA' ? 'btn-primary' : 'btn-ghost'
                }`}
                onClick={() => setAssignScope('TURMA')}
              >
                Turma inteira
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={assignScope === 'STUDENT'}
                className={`btn ${
                  assignScope === 'STUDENT' ? 'btn-primary' : 'btn-ghost'
                }`}
                onClick={() => setAssignScope('STUDENT')}
              >
                Aluno específico
              </button>
            </div>
            {assignScope === 'TURMA' ? (
              <label className="stack">
                <span className="muted">Turma</span>
                <select
                  className="input"
                  value={assignTurma}
                  onChange={(e) => setAssignTurma(e.target.value)}
                  required
                >
                  <option value="">Selecione…</option>
                  {turmaOptions.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      disabled={assignedTurmaIds.has(t.id)}
                    >
                      {t.name}
                      {assignedTurmaIds.has(t.id) ? ' (já atribuída)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="stack">
                <span className="muted">Aluno</span>
                <select
                  className="input"
                  value={assignStudent}
                  onChange={(e) => setAssignStudent(e.target.value)}
                  required
                >
                  <option value="">Selecione…</option>
                  {studentOptions.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={assignedStudentIds.has(s.id)}
                    >
                      {s.fullName}
                      {assignedStudentIds.has(s.id) ? ' (já atribuído)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="stack">
              <span className="muted">Notas (opcional)</span>
              <textarea
                className="input"
                rows={2}
                maxLength={280}
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Ex: foco na semana de jogo"
              />
            </label>
            <div
              className="row"
              style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAssigning(false)}
                disabled={assignBusy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitAssign()}
                disabled={
                  assignBusy ||
                  (assignScope === 'TURMA' ? !assignTurma : !assignStudent)
                }
              >
                {assignBusy ? 'Atribuindo…' : 'Atribuir'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remover exercício do treino?"
        description={
          pendingDelete
            ? `“${pendingDelete.nameSnapshot}” será removido. O exercício original permanece na biblioteca.`
            : ''
        }
        confirmLabel="Remover"
        danger
        busy={deleteBusy}
        onConfirm={() => void confirmDeleteExercise()}
      />
    </>
  );
}
