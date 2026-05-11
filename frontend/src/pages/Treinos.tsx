import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';

type WorkoutListItem = {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: string;
    fullName: string;
    role: 'ADMIN' | 'TREINADOR' | 'ATLETA';
  };
  ownerStaff: {
    id: string;
    professionalType: string;
    user: { id: string; fullName: string };
  } | null;
  exercises: { id: string }[];
  assignments: {
    id: string;
    scope: 'TURMA' | 'STUDENT';
    turma: { id: string; name: string } | null;
    student: { id: string; fullName: string; active: boolean } | null;
  }[];
};

export default function Treinos() {
  const { user } = useAuth();
  const toast = useToast();

  const canSee =
    user?.role === 'ADMIN' ||
    (user?.role === 'TREINADOR' && user?.staffProfile?.active);

  const [items, setItems] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const [pendingArchive, setPendingArchive] = useState<{
    item: WorkoutListItem;
    target: boolean;
  } | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (includeArchived) qs.set('includeArchived', 'true');
      const list = await apiFetch<WorkoutListItem[]>(
        `/workouts${qs.toString() ? `?${qs.toString()}` : ''}`,
      );
      setItems(list);
      setErr(null);
    } catch (e) {
      const msg = errorMessageFromUnknown(e, 'Falha ao carregar treinos.');
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canSee) return;
    const t = window.setTimeout(reload, search.trim() ? 250 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee, search, includeArchived]);

  const visible = useMemo(() => items, [items]);

  if (!canSee) return <Navigate to="/" replace />;

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name.length < 2) {
      toast.error('Informe o nome do treino.');
      return;
    }
    setBusy(true);
    try {
      const created = await apiFetch<{ id: string }>('/workouts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: newDescription.trim() || undefined,
        }),
      });
      toast.success('Treino criado. Adicione exercícios no editor.');
      setCreating(false);
      setNewName('');
      setNewDescription('');
      window.location.href = `/treinos/${created.id}`;
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao criar treino.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive() {
    if (!pendingArchive) return;
    setArchiveBusy(true);
    try {
      await apiFetch(
        `/workouts/${pendingArchive.item.id}/${
          pendingArchive.target ? 'archive' : 'unarchive'
        }`,
        { method: 'POST' },
      );
      toast.success(
        pendingArchive.target ? 'Treino arquivado.' : 'Treino restaurado.',
      );
      setPendingArchive(null);
      void reload();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao alterar estado.'));
    } finally {
      setArchiveBusy(false);
    }
  }

  return (
    <>
      <div className="page stack">
        <header className="page-header">
          <div className="page-header__text">
            <h1 className="page-header__title">Treinos</h1>
            <p className="page-header__subtitle muted">
              Monte conjuntos de exercícios (com séries/reps/duração) e atribua a
              uma turma inteira ou a alunos específicos.
            </p>
          </div>
          <div className="page-header__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              + Novo treino
            </button>
          </div>
        </header>

        <div
          className="card stack"
          style={{ padding: 'var(--space-3)', gap: 'var(--space-2)' }}
        >
          <div
            className="row"
            style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            <input
              className="input"
              type="search"
              placeholder="Buscar por nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <label
              className="row text-caption"
              style={{ alignItems: 'center', gap: 'var(--space-1)' }}
            >
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Mostrar arquivados
            </label>
          </div>
        </div>

        {err ? <Banner variant="danger">{err}</Banner> : null}

        {loading ? (
          <p className="muted">Carregando…</p>
        ) : visible.length === 0 ? (
          <div className="card stack" style={{ padding: 'var(--space-4)' }}>
            <p className="muted">
              {search.trim()
                ? 'Nenhum treino encontrado para essa busca.'
                : 'Você ainda não tem treinos. Crie o primeiro e adicione exercícios da biblioteca.'}
            </p>
          </div>
        ) : (
          <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
            {visible.map((w) => {
              const turmas = w.assignments.filter((a) => a.scope === 'TURMA');
              const alunos = w.assignments.filter((a) => a.scope === 'STUDENT');
              const authorName =
                w.ownerStaff?.user.fullName ?? w.createdByUser.fullName;
              return (
                <li key={w.id}>
                  <article
                    className="card stack"
                    style={{
                      padding: 'var(--space-3)',
                      gap: 'var(--space-2)',
                      opacity: w.archived ? 0.6 : 1,
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
                      <div className="stack" style={{ gap: 'var(--space-1)', flex: 1 }}>
                        <strong>
                          <Link to={`/treinos/${w.id}`} style={{ color: 'inherit' }}>
                            {w.name}
                          </Link>
                        </strong>
                        <span className="text-caption muted">
                          {w.exercises.length} exercício(s) · por {authorName}
                          {w.archived ? ' · arquivado' : ''}
                        </span>
                        {w.description ? (
                          <span className="text-body">{w.description}</span>
                        ) : null}
                        {turmas.length || alunos.length ? (
                          <div
                            className="row text-caption"
                            style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
                          >
                            {turmas.length ? (
                              <span>
                                Turmas:{' '}
                                {turmas
                                  .map((a) => a.turma?.name ?? '—')
                                  .join(', ')}
                              </span>
                            ) : null}
                            {alunos.length ? (
                              <span>
                                Alunos:{' '}
                                {alunos
                                  .map((a) => a.student?.fullName ?? '—')
                                  .join(', ')}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-caption muted">
                            Ainda não atribuído.
                          </span>
                        )}
                      </div>
                      <div
                        className="row"
                        style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}
                      >
                        <Link className="btn btn-secondary" to={`/treinos/${w.id}`}>
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            setPendingArchive({ item: w, target: !w.archived })
                          }
                        >
                          {w.archived ? 'Restaurar' : 'Arquivar'}
                        </button>
                      </div>
                    </header>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {creating ? (
        <Modal open title="Novo treino" onClose={() => setCreating(false)}>
          <form className="stack" onSubmit={submitCreate}>
            <label className="stack">
              <span className="muted">Nome</span>
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                minLength={2}
                maxLength={140}
                autoFocus
              />
            </label>
            <label className="stack">
              <span className="muted">Descrição / objetivo (opcional)</span>
              <textarea
                className="input"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
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
                onClick={() => setCreating(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Criando…' : 'Criar e abrir editor'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      <ConfirmDialog
        open={!!pendingArchive}
        onOpenChange={(open) => !open && setPendingArchive(null)}
        title={
          pendingArchive?.target ? 'Arquivar treino?' : 'Restaurar treino?'
        }
        description={
          pendingArchive?.target
            ? 'O treino sai das listas ativas, mas continua acessível em "mostrar arquivados". Atribuições não são apagadas.'
            : 'O treino volta a aparecer nas listagens ativas.'
        }
        confirmLabel={pendingArchive?.target ? 'Arquivar' : 'Restaurar'}
        danger={pendingArchive?.target}
        busy={archiveBusy}
        onConfirm={confirmArchive}
      />
    </>
  );
}
