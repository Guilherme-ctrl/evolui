import { type FormEvent, useState, useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { PlanStatusBadge } from '../components/PlanStatusBadge';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';

type StaffOpt = { id: string; user: { fullName: string } };

type Exercise = {
  id: string;
  order: number;
  name: string;
  description: string | null;
  videoUrl: string | null;
  sets: number | null;
  repetitions: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
};

type Session = {
  id: string;
  order: number;
  title: string;
  instructions: string | null;
  estimatedDurationMinutes: number | null;
  exercises: Exercise[];
};

type PlanDetail = {
  id: string;
  studentId: string;
  type: string;
  title: string;
  goal: string | null;
  startDate: string;
  endDate: string | null;
  weeklyFrequency: number | null;
  status: string;
  student: { fullName: string; active: boolean };
  sessions: Session[];
};

// Doc 25 / RN-1320: IndividualPlan agora cobre apenas tratamento clínico.
// Treinos genéricos (turma/aluno) são gerenciados em /treinos (Workouts).
const PLAN_TYPES = [['TRATAMENTO', 'Tratamento clínico']] as const;

type SessionFormState = {
  mode: 'create' | 'edit';
  sessionId?: string;
  title: string;
  instructions: string;
  estimatedDurationMinutes: string;
};

type ExerciseFormState = {
  mode: 'create' | 'edit';
  sessionId: string;
  exerciseId?: string;
  name: string;
  description: string;
  videoUrl: string;
  sets: string;
  repetitions: string;
  durationSeconds: string;
  restSeconds: string;
  notes: string;
  /** Quando preenchido, criação usa POST .../from-library com overrides. */
  libraryItemId?: string;
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
  notes: string | null;
};

type PendingDelete =
  | { kind: 'session'; sessionId: string; label: string }
  | {
      kind: 'exercise';
      sessionId: string;
      exerciseId: string;
      label: string;
    };

function emptySessionForm(): SessionFormState {
  return {
    mode: 'create',
    title: '',
    instructions: '',
    estimatedDurationMinutes: '',
  };
}

function emptyExerciseForm(sessionId: string): ExerciseFormState {
  return {
    mode: 'create',
    sessionId,
    name: '',
    description: '',
    videoUrl: '',
    sets: '',
    repetitions: '',
    durationSeconds: '',
    restSeconds: '',
    notes: '',
  };
}

function numOrUndefined(raw: string): number | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strOrUndefined(raw: string): string | undefined {
  const v = raw.trim();
  return v.length ? v : undefined;
}

function summarizeExercise(ex: Exercise): string[] {
  const parts: string[] = [];
  if (ex.sets != null && ex.repetitions != null) {
    parts.push(`${ex.sets} × ${ex.repetitions}`);
  } else if (ex.sets != null) {
    parts.push(`${ex.sets} séries`);
  } else if (ex.repetitions != null) {
    parts.push(`${ex.repetitions} repetições`);
  }
  if (ex.durationSeconds != null) {
    parts.push(`${ex.durationSeconds}s`);
  }
  if (ex.restSeconds != null) {
    parts.push(`descanso ${ex.restSeconds}s`);
  }
  return parts;
}

export default function PlanoEditor() {
  const { id: studentId, planId } = useParams<{ id: string; planId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sessionForm, setSessionForm] = useState<SessionFormState | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [exerciseForm, setExerciseForm] = useState<ExerciseFormState | null>(
    null,
  );
  const [exerciseBusy, setExerciseBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isNew = planId === 'novo';
  const canEdit =
    user?.role === 'ADMIN' ||
    (user?.role === 'TREINADOR' && user?.staffProfile?.active);
  const canMutateContent =
    !!plan && plan.status !== 'CANCELLED' && plan.status !== 'COMPLETED';

  useEffect(() => {
    if (!studentId || !planId || !canEdit) return;
    void (async () => {
      setLoading(true);
      try {
        if (user?.role === 'ADMIN') {
          const s = await apiFetch<StaffOpt[]>('/staff');
          setStaff(s);
        }
        if (!isNew) {
          const p = await apiFetch<PlanDetail>(`/individual-plans/${planId}`);
          if (p.studentId !== studentId) {
            setErr('Plano não pertence a este aluno.');
            return;
          }
          setPlan(p);
        }
        setErr(null);
      } catch (e) {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar plano.');
        setErr(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId, planId, isNew, canEdit, user?.role, toast]);

  if (user?.role === 'ATLETA') return <Navigate to="/" replace />;
  if (!canEdit) return <Navigate to={`/alunos/${studentId}`} replace />;

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!studentId) return;
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      type: String(fd.get('type')),
      title: String(fd.get('title')).trim(),
      goal: String(fd.get('goal') ?? '').trim() || undefined,
      startDate: String(fd.get('startDate')),
      endDate: String(fd.get('endDate') ?? '').trim() || undefined,
    };
    const wf = String(fd.get('weeklyFrequency') ?? '').trim();
    if (wf) body.weeklyFrequency = Number(wf);
    if (user?.role === 'ADMIN') {
      const sid = String(fd.get('assignedProfessionalId') ?? '');
      if (!sid) {
        toast.error('Selecione o profissional.');
        return;
      }
      body.assignedProfessionalId = sid;
    }
    try {
      const created = await apiFetch<PlanDetail>(
        `/students/${studentId}/individual-plans`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      toast.success('Rascunho criado.');
      navigate(`/alunos/${studentId}/planos/${created.id}`, { replace: true });
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao criar plano.'));
    }
  }

  async function onSaveMeta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!plan) return;
    const fd = new FormData(e.currentTarget);
    try {
      const p = await apiFetch<PlanDetail>(`/individual-plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type: String(fd.get('type')),
          title: String(fd.get('title')).trim(),
          goal: String(fd.get('goal') ?? '').trim() || null,
          startDate: String(fd.get('startDate')),
          endDate: String(fd.get('endDate') ?? '').trim() || null,
          weeklyFrequency: String(fd.get('weeklyFrequency') ?? '').trim()
            ? Number(fd.get('weeklyFrequency'))
            : null,
        }),
      });
      setPlan(p);
      toast.success('Salvo.');
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao salvar.'));
    }
  }

  function openCreateSession() {
    setSessionForm(emptySessionForm());
  }

  function openEditSession(s: Session) {
    setSessionForm({
      mode: 'edit',
      sessionId: s.id,
      title: s.title,
      instructions: s.instructions ?? '',
      estimatedDurationMinutes:
        s.estimatedDurationMinutes != null
          ? String(s.estimatedDurationMinutes)
          : '',
    });
  }

  async function submitSession() {
    if (!plan || !sessionForm) return;
    const title = sessionForm.title.trim();
    if (title.length < 2) {
      toast.error('Informe o título da sessão.');
      return;
    }
    setSessionBusy(true);
    try {
      const body: Record<string, unknown> = {
        title,
        instructions: strOrUndefined(sessionForm.instructions) ?? null,
        estimatedDurationMinutes:
          numOrUndefined(sessionForm.estimatedDurationMinutes) ?? null,
      };
      if (sessionForm.mode === 'create') {
        const p = await apiFetch<PlanDetail>(
          `/individual-plans/${plan.id}/sessions`,
          { method: 'POST', body: JSON.stringify(body) },
        );
        setPlan(p);
        toast.success('Sessão adicionada.');
      } else if (sessionForm.sessionId) {
        const p = await apiFetch<PlanDetail>(
          `/individual-plans/${plan.id}/sessions/${sessionForm.sessionId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
        );
        setPlan(p);
        toast.success('Sessão atualizada.');
      }
      setSessionForm(null);
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao salvar sessão.'));
    } finally {
      setSessionBusy(false);
    }
  }

  function openCreateExercise(sessionId: string) {
    setExerciseForm(emptyExerciseForm(sessionId));
  }

  function openEditExercise(sessionId: string, ex: Exercise) {
    setExerciseForm({
      mode: 'edit',
      sessionId,
      exerciseId: ex.id,
      name: ex.name,
      description: ex.description ?? '',
      videoUrl: ex.videoUrl ?? '',
      sets: ex.sets != null ? String(ex.sets) : '',
      repetitions: ex.repetitions != null ? String(ex.repetitions) : '',
      durationSeconds:
        ex.durationSeconds != null ? String(ex.durationSeconds) : '',
      restSeconds: ex.restSeconds != null ? String(ex.restSeconds) : '',
      notes: ex.notes ?? '',
    });
  }

  async function submitExercise() {
    if (!plan || !exerciseForm) return;
    const name = exerciseForm.name.trim();
    if (name.length < 2) {
      toast.error('Informe o nome do exercício.');
      return;
    }
    setExerciseBusy(true);
    try {
      if (
        exerciseForm.mode === 'create' &&
        exerciseForm.libraryItemId
      ) {
        const body: Record<string, unknown> = {
          libraryItemId: exerciseForm.libraryItemId,
          sets: numOrUndefined(exerciseForm.sets),
          repetitions: numOrUndefined(exerciseForm.repetitions),
          durationSeconds: numOrUndefined(exerciseForm.durationSeconds),
          restSeconds: numOrUndefined(exerciseForm.restSeconds),
          notes: strOrUndefined(exerciseForm.notes),
        };
        const p = await apiFetch<PlanDetail>(
          `/individual-plan-sessions/${exerciseForm.sessionId}/exercises/from-library`,
          { method: 'POST', body: JSON.stringify(body) },
        );
        setPlan(p);
        toast.success('Exercício adicionado da biblioteca.');
      } else {
        const body: Record<string, unknown> = {
          name,
          description: strOrUndefined(exerciseForm.description) ?? null,
          videoUrl: strOrUndefined(exerciseForm.videoUrl) ?? null,
          sets: numOrUndefined(exerciseForm.sets) ?? null,
          repetitions: numOrUndefined(exerciseForm.repetitions) ?? null,
          durationSeconds: numOrUndefined(exerciseForm.durationSeconds) ?? null,
          restSeconds: numOrUndefined(exerciseForm.restSeconds) ?? null,
          notes: strOrUndefined(exerciseForm.notes) ?? null,
        };
        if (exerciseForm.mode === 'create') {
          const p = await apiFetch<PlanDetail>(
            `/individual-plan-sessions/${exerciseForm.sessionId}/exercises`,
            { method: 'POST', body: JSON.stringify(body) },
          );
          setPlan(p);
          toast.success('Exercício adicionado.');
        } else if (exerciseForm.exerciseId) {
          const p = await apiFetch<PlanDetail>(
            `/individual-plan-sessions/${exerciseForm.sessionId}/exercises/${exerciseForm.exerciseId}`,
            { method: 'PATCH', body: JSON.stringify(body) },
          );
          setPlan(p);
          toast.success('Exercício atualizado.');
        }
      }
      setExerciseForm(null);
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao salvar exercício.'));
    } finally {
      setExerciseBusy(false);
    }
  }

  function askDeleteSession(s: Session) {
    setPendingDelete({
      kind: 'session',
      sessionId: s.id,
      label: s.title,
    });
  }

  function askDeleteExercise(sessionId: string, ex: Exercise) {
    setPendingDelete({
      kind: 'exercise',
      sessionId,
      exerciseId: ex.id,
      label: ex.name,
    });
  }

  async function confirmDelete() {
    if (!plan || !pendingDelete) return;
    setDeleteBusy(true);
    try {
      if (pendingDelete.kind === 'session') {
        const p = await apiFetch<PlanDetail>(
          `/individual-plans/${plan.id}/sessions/${pendingDelete.sessionId}`,
          { method: 'DELETE' },
        );
        setPlan(p);
        toast.success('Sessão removida.');
      } else {
        const p = await apiFetch<PlanDetail>(
          `/individual-plan-sessions/${pendingDelete.sessionId}/exercises/${pendingDelete.exerciseId}`,
          { method: 'DELETE' },
        );
        setPlan(p);
        toast.success('Exercício removido.');
      }
      setPendingDelete(null);
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao remover.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function publish() {
    if (!plan) return;
    try {
      const p = await apiFetch<PlanDetail>(
        `/individual-plans/${plan.id}/publish`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setPlan(p);
      toast.success('Plano publicado.');
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao publicar.'));
    }
  }

  async function pause() {
    if (!plan) return;
    try {
      const p = await apiFetch<PlanDetail>(
        `/individual-plans/${plan.id}/pause`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setPlan(p);
      toast.success('Plano em pausa.');
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao pausar.'));
    }
  }

  async function resume() {
    if (!plan) return;
    try {
      const p = await apiFetch<PlanDetail>(
        `/individual-plans/${plan.id}/resume`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setPlan(p);
      toast.success('Plano retomado.');
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao retomar.'));
    }
  }

  async function complete() {
    if (!plan) return;
    const note = window.prompt('Nota final (opcional, até 280 caracteres)') ?? '';
    try {
      const p = await apiFetch<PlanDetail>(
        `/individual-plans/${plan.id}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({ completionNote: note.trim() || undefined }),
        },
      );
      setPlan(p);
      toast.success('Plano concluído.');
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao concluir.'));
    }
  }

  async function cancel() {
    if (!plan) return;
    const reason = window.prompt('Motivo do cancelamento (obrigatório)');
    if (!reason || reason.trim().length < 3) {
      toast.error('Informe o motivo.');
      return;
    }
    try {
      const p = await apiFetch<PlanDetail>(
        `/individual-plans/${plan.id}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      setPlan(p);
      toast.success('Plano cancelado.');
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao cancelar.'));
    }
  }

  if (err) {
    return (
      <div className="page stack">
        <Banner variant="danger">{err}</Banner>
        <Link to={`/alunos/${studentId}/planos`}>Voltar</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page muted" style={{ paddingTop: '2rem' }}>
        Carregando…
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="page stack">
        <nav className="text-caption">
          <Link to={`/alunos/${studentId}/planos`}>← Planos</Link>
        </nav>
        <h1 className="text-h2">Novo plano</h1>
        <form
          className="card card--lg stack"
          style={{ gap: 'var(--space-3)' }}
          onSubmit={onCreate}
        >
          {user?.role === 'ADMIN' ? (
            <label className="stack text-caption">
              Profissional responsável
              <select
                name="assignedProfessionalId"
                className="input"
                required
              >
                <option value="">Selecione…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="stack text-caption">
            Tipo
            <select name="type" className="input" defaultValue="TRATAMENTO">
              {PLAN_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="stack text-caption">
            Título
            <input name="title" className="input" required maxLength={140} />
          </label>
          <label className="stack text-caption">
            Objetivo (opcional se houver sessões)
            <textarea name="goal" className="input" rows={3} maxLength={500} />
          </label>
          <label className="stack text-caption">
            Início
            <input name="startDate" type="date" lang="pt-BR" className="input" required />
          </label>
          <label className="stack text-caption">
            Fim (opcional)
            <input name="endDate" type="date" lang="pt-BR" className="input" />
          </label>
          <label className="stack text-caption">
            Frequência semanal (opcional)
            <input
              name="weeklyFrequency"
              type="number"
              min={1}
              max={14}
              className="input"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Criar rascunho
          </button>
        </form>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <>
      <div className="page stack">
        <nav className="text-caption">
          <Link to={`/alunos/${studentId}/planos`}>
            ← Planos · {plan.student.fullName}
          </Link>
        </nav>
        <header className="page-header">
          <div className="page-header__text">
            <h1 className="page-header__title">{plan.title}</h1>
            <p className="page-header__subtitle">
              <PlanStatusBadge status={plan.status} />{' '}
              <span className="muted">{plan.type}</span>
            </p>
          </div>
        </header>

        <form
          className="card card--lg stack"
          style={{ gap: 'var(--space-3)' }}
          onSubmit={onSaveMeta}
        >
          <h2 className="text-h3">Metadados</h2>
          <label className="stack text-caption">
            Tipo
            <select name="type" className="input" defaultValue={plan.type}>
              {PLAN_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="stack text-caption">
            Título
            <input
              name="title"
              className="input"
              defaultValue={plan.title}
              required
              maxLength={140}
            />
          </label>
          <label className="stack text-caption">
            Objetivo
            <textarea
              name="goal"
              className="input"
              rows={3}
              maxLength={500}
              defaultValue={plan.goal ?? ''}
            />
          </label>
          <label className="stack text-caption">
            Início
            <input
              name="startDate"
              type="date"
              lang="pt-BR"
              className="input"
              defaultValue={plan.startDate.slice(0, 10)}
              required
            />
          </label>
          <label className="stack text-caption">
            Fim
            <input
              name="endDate"
              type="date"
              lang="pt-BR"
              className="input"
              defaultValue={plan.endDate?.slice(0, 10) ?? ''}
            />
          </label>
          <label className="stack text-caption">
            Frequência semanal
            <input
              name="weeklyFrequency"
              type="number"
              min={1}
              max={14}
              className="input"
              defaultValue={plan.weeklyFrequency ?? ''}
            />
          </label>
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={plan.status === 'CANCELLED'}
          >
            Salvar alterações
          </button>
        </form>

        <div className="card card--lg stack">
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <h2 className="text-h3" style={{ margin: 0 }}>
              Sessões
            </h2>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCreateSession}
              disabled={!canMutateContent}
            >
              + Sessão
            </button>
          </div>
          {plan.sessions.length === 0 ? (
            <p className="muted">
              Nenhuma sessão. Adicione ou preencha o objetivo para publicar.
            </p>
          ) : (
            <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
              {plan.sessions.map((s) => (
                <li key={s.id}>
                  <SessionCard
                    session={s}
                    canMutate={canMutateContent}
                    onEdit={() => openEditSession(s)}
                    onDelete={() => askDeleteSession(s)}
                    onAddExercise={() => openCreateExercise(s.id)}
                    onEditExercise={(ex) => openEditExercise(s.id, ex)}
                    onDeleteExercise={(ex) => askDeleteExercise(s.id, ex)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card card--lg stack">
          <h2 className="text-h3">Ações</h2>
          <div
            className="row"
            style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}
          >
            {plan.status === 'DRAFT' || plan.status === 'PAUSED' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={publish}
                disabled={!plan.student.active}
              >
                Publicar
              </button>
            ) : null}
            {plan.status === 'PUBLISHED' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={pause}
              >
                Pausar
              </button>
            ) : null}
            {plan.status === 'PAUSED' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resume}
              >
                Retomar
              </button>
            ) : null}
            {plan.status === 'PUBLISHED' || plan.status === 'PAUSED' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={complete}
              >
                Concluir
              </button>
            ) : null}
            {plan.status !== 'CANCELLED' && plan.status !== 'COMPLETED' ? (
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                Cancelar plano
              </button>
            ) : null}
          </div>
          {!plan.student.active ? (
            <p className="text-caption muted">
              Aluno inativo: publicação bloqueada.
            </p>
          ) : null}
        </div>
      </div>

      <SessionFormModal
        form={sessionForm}
        busy={sessionBusy}
        onChange={(next) => setSessionForm(next)}
        onClose={() => setSessionForm(null)}
        onSubmit={submitSession}
      />

      <ExerciseFormModal
        form={exerciseForm}
        busy={exerciseBusy}
        onChange={(next) => setExerciseForm(next)}
        onClose={() => setExerciseForm(null)}
        onSubmit={submitExercise}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === 'session'
            ? 'Remover sessão?'
            : 'Remover exercício?'
        }
        description={
          pendingDelete ? (
            <p>
              Esta ação removerá <strong>{pendingDelete.label}</strong>
              {pendingDelete.kind === 'session'
                ? ' e todos os exercícios dentro dela'
                : ''}
              . Não dá para desfazer.
            </p>
          ) : null
        }
        confirmLabel="Remover"
        danger
        busy={deleteBusy}
        onConfirm={confirmDelete}
      />
    </>
  );
}

type SessionCardProps = {
  session: Session;
  canMutate: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddExercise: () => void;
  onEditExercise: (ex: Exercise) => void;
  onDeleteExercise: (ex: Exercise) => void;
};

function SessionCard({
  session,
  canMutate,
  onEdit,
  onDelete,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
}: SessionCardProps) {
  return (
    <article
      className="card stack"
      style={{ gap: 'var(--space-2)', padding: 'var(--space-3)' }}
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
        <div className="stack" style={{ gap: 'var(--space-1)', flex: 1 }}>
          <h3 className="text-h3" style={{ margin: 0 }}>
            {session.title}
          </h3>
          <p className="text-caption muted" style={{ margin: 0 }}>
            {session.exercises.length} exercício(s)
            {session.estimatedDurationMinutes != null
              ? ` · ~${session.estimatedDurationMinutes} min`
              : ''}
          </p>
          {session.instructions ? (
            <p className="text-body" style={{ margin: 0 }}>
              {session.instructions}
            </p>
          ) : null}
        </div>
        <div className="row" style={{ gap: 'var(--space-1)' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onEdit}
            disabled={!canMutate}
          >
            Editar
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onDelete}
            disabled={!canMutate}
          >
            Remover
          </button>
        </div>
      </header>

      {session.exercises.length === 0 ? (
        <p className="muted text-body" style={{ margin: 0 }}>
          Nenhum exercício ainda.
        </p>
      ) : (
        <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
          {session.exercises.map((ex) => {
            const summary = summarizeExercise(ex);
            return (
              <li
                key={ex.id}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                  borderTop: '1px solid var(--color-border, #2a2f37)',
                  paddingTop: 'var(--space-2)',
                }}
              >
                <div className="stack" style={{ gap: 4, flex: 1 }}>
                  <strong>{ex.name}</strong>
                  {summary.length ? (
                    <span className="text-caption muted">
                      {summary.join(' · ')}
                    </span>
                  ) : null}
                  {ex.description ? (
                    <span className="text-body">{ex.description}</span>
                  ) : null}
                  {ex.notes ? (
                    <span className="text-caption muted">Obs.: {ex.notes}</span>
                  ) : null}
                  {ex.videoUrl ? (
                    <a
                      href={ex.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-caption"
                    >
                      Vídeo de referência ↗
                    </a>
                  ) : null}
                </div>
                <div className="row" style={{ gap: 'var(--space-1)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onEditExercise(ex)}
                    disabled={!canMutate}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onDeleteExercise(ex)}
                    disabled={!canMutate}
                  >
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onAddExercise}
          disabled={!canMutate}
        >
          + Exercício
        </button>
      </div>
    </article>
  );
}

type SessionFormModalProps = {
  form: SessionFormState | null;
  busy: boolean;
  onChange: (next: SessionFormState | null) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

function SessionFormModal({
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: SessionFormModalProps) {
  const open = !!form;
  const title = form?.mode === 'edit' ? 'Editar sessão' : 'Nova sessão';
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => !busy && onClose()}
      footer={
        <div className="ds-modal__actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSubmit()}
            disabled={busy}
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      }
    >
      {form ? (
        <div className="stack">
          <label className="stack text-caption">
            Título
            <input
              className="input"
              maxLength={140}
              autoFocus
              value={form.title}
              onChange={(e) =>
                onChange({ ...form, title: e.target.value })
              }
            />
          </label>
          <label className="stack text-caption">
            Instruções gerais (opcional)
            <textarea
              className="input"
              rows={3}
              maxLength={1000}
              value={form.instructions}
              onChange={(e) =>
                onChange({ ...form, instructions: e.target.value })
              }
            />
          </label>
          <label className="stack text-caption">
            Duração estimada (min, opcional)
            <input
              className="input"
              type="number"
              min={1}
              max={300}
              value={form.estimatedDurationMinutes}
              onChange={(e) =>
                onChange({
                  ...form,
                  estimatedDurationMinutes: e.target.value,
                })
              }
            />
          </label>
        </div>
      ) : null}
    </Modal>
  );
}

type ExerciseFormModalProps = {
  form: ExerciseFormState | null;
  busy: boolean;
  onChange: (next: ExerciseFormState | null) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

function ExerciseFormModal({
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: ExerciseFormModalProps) {
  const open = !!form;
  const title =
    form?.mode === 'edit'
      ? 'Editar exercício'
      : form?.libraryItemId
        ? 'Adicionar da biblioteca'
        : 'Novo exercício';
  const showLibrary =
    !!form && form.mode === 'create' && !form.libraryItemId;
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => !busy && onClose()}
      footer={
        <div className="ds-modal__actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSubmit()}
            disabled={busy}
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      }
    >
      {form ? (
        <div className="stack">
          {form.mode === 'create' ? (
            <LibraryPicker
              form={form}
              onChange={onChange}
              expanded={showLibrary}
            />
          ) : null}

          {form.libraryItemId || !showLibrary ? (
            <ExerciseFormFields form={form} onChange={onChange} />
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

type ExerciseFormFieldsProps = {
  form: ExerciseFormState;
  onChange: (next: ExerciseFormState) => void;
};

function ExerciseFormFields({ form, onChange }: ExerciseFormFieldsProps) {
  const fromLibrary = !!form.libraryItemId;
  return (
    <div className="stack">
      <label className="stack text-caption">
        Nome
        <input
          className="input"
          maxLength={140}
          autoFocus={!fromLibrary}
          readOnly={fromLibrary}
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </label>
      {fromLibrary ? (
        <p className="text-caption muted">
          Vindo da biblioteca. Os campos abaixo viram <strong>overrides</strong>{' '}
          deste exercício no plano (não alteram a biblioteca).
        </p>
      ) : null}
      {!fromLibrary ? (
        <>
          <label className="stack text-caption">
            Descrição (opcional)
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={form.description}
              onChange={(e) =>
                onChange({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="stack text-caption">
            Vídeo de referência (URL, opcional)
            <input
              className="input"
              type="url"
              placeholder="https://…"
              value={form.videoUrl}
              onChange={(e) =>
                onChange({ ...form, videoUrl: e.target.value })
              }
            />
          </label>
        </>
      ) : null}
      <div
        className="row"
        style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
      >
        <label className="stack text-caption" style={{ flex: 1 }}>
          Séries
          <input
            className="input"
            type="number"
            min={1}
            max={50}
            value={form.sets}
            onChange={(e) => onChange({ ...form, sets: e.target.value })}
          />
        </label>
        <label className="stack text-caption" style={{ flex: 1 }}>
          Repetições
          <input
            className="input"
            type="number"
            min={1}
            max={500}
            value={form.repetitions}
            onChange={(e) =>
              onChange({ ...form, repetitions: e.target.value })
            }
          />
        </label>
      </div>
      <div
        className="row"
        style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
      >
        <label className="stack text-caption" style={{ flex: 1 }}>
          Tempo (segundos)
          <input
            className="input"
            type="number"
            min={1}
            max={3600}
            value={form.durationSeconds}
            onChange={(e) =>
              onChange({ ...form, durationSeconds: e.target.value })
            }
          />
        </label>
        <label className="stack text-caption" style={{ flex: 1 }}>
          Descanso (segundos)
          <input
            className="input"
            type="number"
            min={0}
            max={3600}
            value={form.restSeconds}
            onChange={(e) =>
              onChange({ ...form, restSeconds: e.target.value })
            }
          />
        </label>
      </div>
      <label className="stack text-caption">
        Notas (opcional, até 280 caracteres)
        <textarea
          className="input"
          rows={2}
          maxLength={280}
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </label>
    </div>
  );
}

type LibraryPickerProps = {
  form: ExerciseFormState;
  onChange: (next: ExerciseFormState) => void;
  expanded: boolean;
};

function LibraryPicker({ form, onChange, expanded }: LibraryPickerProps) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const qs = new URLSearchParams();
          if (query.trim()) qs.set('search', query.trim());
          const list = await apiFetch<LibraryItem[]>(
            `/exercise-library${qs.toString() ? `?${qs.toString()}` : ''}`,
          );
          if (!cancelled) {
            setResults(list);
            setLoaded(true);
          }
        } catch (e) {
          if (!cancelled) {
            toast.error(
              errorMessageFromUnknown(e, 'Falha ao consultar biblioteca.'),
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [expanded, query, toast]);

  function pick(item: LibraryItem) {
    onChange({
      ...form,
      libraryItemId: item.id,
      name: item.name,
      description: item.description ?? '',
      videoUrl: item.videoUrl ?? '',
      sets: item.defaultSets != null ? String(item.defaultSets) : '',
      repetitions:
        item.defaultRepetitions != null ? String(item.defaultRepetitions) : '',
      durationSeconds:
        item.defaultDurationSeconds != null
          ? String(item.defaultDurationSeconds)
          : '',
      restSeconds:
        item.defaultRestSeconds != null ? String(item.defaultRestSeconds) : '',
      notes: item.notes ?? '',
    });
  }

  function unpick() {
    onChange({
      ...form,
      libraryItemId: undefined,
    });
  }

  if (form.libraryItemId) {
    return (
      <div
        className="card stack"
        style={{ padding: 'var(--space-2)', gap: 'var(--space-1)' }}
      >
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span className="text-caption muted">Selecionado da biblioteca</span>
          <button type="button" className="btn btn-ghost" onClick={unpick}>
            Trocar
          </button>
        </div>
        <strong>{form.name}</strong>
      </div>
    );
  }

  if (!expanded) return null;

  return (
    <div
      className="card stack"
      style={{ padding: 'var(--space-2)', gap: 'var(--space-2)' }}
    >
      <div className="stack" style={{ gap: 'var(--space-1)' }}>
        <span className="text-caption muted">Da biblioteca</span>
        <input
          className="input"
          type="search"
          placeholder="Buscar exercício na biblioteca…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="muted text-caption">Buscando…</p>
      ) : results.length === 0 && loaded ? (
        <p className="muted text-caption">
          {query.trim()
            ? 'Nenhum exercício encontrado. Crie um do zero abaixo.'
            : 'Sua biblioteca está vazia. Cadastre exercícios em Biblioteca → +Novo exercício.'}
        </p>
      ) : (
        <ul
          className="plain stack"
          style={{ gap: 'var(--space-1)', maxHeight: 200, overflowY: 'auto' }}
        >
          {results.slice(0, 20).map((it) => {
            const summary: string[] = [];
            if (it.defaultSets != null && it.defaultRepetitions != null) {
              summary.push(`${it.defaultSets}×${it.defaultRepetitions}`);
            }
            if (it.defaultDurationSeconds != null) {
              summary.push(`${it.defaultDurationSeconds}s`);
            }
            if (it.defaultRestSeconds != null) {
              summary.push(`desc. ${it.defaultRestSeconds}s`);
            }
            return (
              <li key={it.id}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => pick(it)}
                >
                  <span className="stack" style={{ gap: 2, alignItems: 'flex-start' }}>
                    <strong>{it.name}</strong>
                    {summary.length ? (
                      <span className="text-caption muted">
                        {summary.join(' · ')}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-caption muted">
        Ou preencha o formulário abaixo para criar do zero.
      </p>
    </div>
  );
}
