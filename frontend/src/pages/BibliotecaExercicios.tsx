import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';

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
  archived: boolean;
  /**
   * Autor profissional do exercício. `null` quando o autor é um ADMIN sem
   * `StaffProfile` (RN-1311) — nesse caso o cartão usa `createdByUser`.
   */
  ownerStaff: {
    id: string;
    userId: string;
    professionalType: string;
    user: { id: string; fullName: string };
  } | null;
  createdByUser: {
    id: string;
    fullName: string;
    role: 'ADMIN' | 'TREINADOR' | 'ATLETA';
  };
};

type FormState = {
  mode: 'create' | 'edit';
  itemId?: string;
  name: string;
  description: string;
  videoUrl: string;
  defaultSets: string;
  defaultRepetitions: string;
  defaultDurationSeconds: string;
  defaultRestSeconds: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    mode: 'create',
    name: '',
    description: '',
    videoUrl: '',
    defaultSets: '',
    defaultRepetitions: '',
    defaultDurationSeconds: '',
    defaultRestSeconds: '',
    notes: '',
  };
}

function fromItem(item: LibraryItem): FormState {
  return {
    mode: 'edit',
    itemId: item.id,
    name: item.name,
    description: item.description ?? '',
    videoUrl: item.videoUrl ?? '',
    defaultSets: item.defaultSets != null ? String(item.defaultSets) : '',
    defaultRepetitions:
      item.defaultRepetitions != null ? String(item.defaultRepetitions) : '',
    defaultDurationSeconds:
      item.defaultDurationSeconds != null
        ? String(item.defaultDurationSeconds)
        : '',
    defaultRestSeconds:
      item.defaultRestSeconds != null ? String(item.defaultRestSeconds) : '',
    notes: item.notes ?? '',
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

function summarizeItem(item: LibraryItem): string[] {
  const parts: string[] = [];
  if (item.defaultSets != null && item.defaultRepetitions != null) {
    parts.push(`${item.defaultSets} × ${item.defaultRepetitions}`);
  } else if (item.defaultSets != null) {
    parts.push(`${item.defaultSets} séries`);
  } else if (item.defaultRepetitions != null) {
    parts.push(`${item.defaultRepetitions} reps`);
  }
  if (item.defaultDurationSeconds != null) {
    parts.push(`${item.defaultDurationSeconds}s`);
  }
  if (item.defaultRestSeconds != null) {
    parts.push(`descanso ${item.defaultRestSeconds}s`);
  }
  return parts;
}

export default function BibliotecaExercicios() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);

  const [pendingArchive, setPendingArchive] = useState<{
    item: LibraryItem;
    target: boolean;
  } | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const canSee =
    user?.role === 'ADMIN' ||
    (user?.role === 'TREINADOR' && user?.staffProfile?.active);

  async function reload() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (includeArchived) qs.set('includeArchived', 'true');
      const list = await apiFetch<LibraryItem[]>(
        `/exercise-library${qs.toString() ? `?${qs.toString()}` : ''}`,
      );
      setItems(list);
      setErr(null);
    } catch (e) {
      const msg = errorMessageFromUnknown(e, 'Falha ao carregar biblioteca.');
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canSee) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee, search, includeArchived]);

  const visibleItems = useMemo(() => items, [items]);

  if (!canSee) return <Navigate to="/" replace />;

  function openCreate() {
    setForm(emptyForm());
  }

  function openEdit(item: LibraryItem) {
    setForm(fromItem(item));
  }

  async function submitForm() {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error('Informe o nome do exercício.');
      return;
    }
    const body: Record<string, unknown> = {
      name,
      description: strOrUndefined(form.description) ?? null,
      videoUrl: strOrUndefined(form.videoUrl) ?? null,
      defaultSets: numOrUndefined(form.defaultSets) ?? null,
      defaultRepetitions: numOrUndefined(form.defaultRepetitions) ?? null,
      defaultDurationSeconds:
        numOrUndefined(form.defaultDurationSeconds) ?? null,
      defaultRestSeconds: numOrUndefined(form.defaultRestSeconds) ?? null,
      notes: strOrUndefined(form.notes) ?? null,
    };
    setBusy(true);
    try {
      if (form.mode === 'create') {
        await apiFetch('/exercise-library', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Exercício adicionado à biblioteca.');
      } else if (form.itemId) {
        await apiFetch(`/exercise-library/${form.itemId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Exercício atualizado.');
      }
      setForm(null);
      void reload();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao salvar exercício.'));
    } finally {
      setBusy(false);
    }
  }

  function askArchive(item: LibraryItem) {
    setPendingArchive({ item, target: !item.archived });
  }

  async function confirmArchive() {
    if (!pendingArchive) return;
    setArchiveBusy(true);
    try {
      const verb = pendingArchive.target ? 'archive' : 'unarchive';
      await apiFetch(`/exercise-library/${pendingArchive.item.id}/${verb}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success(
        pendingArchive.target ? 'Exercício arquivado.' : 'Exercício restaurado.',
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
            <h1 className="page-header__title">Biblioteca de exercícios</h1>
            <p className="page-header__subtitle muted">
              Cadastre seus exercícios mais usados aqui para reaproveitar em
              vários planos.
            </p>
          </div>
          <div className="page-header__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
            >
              + Novo exercício
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
        ) : visibleItems.length === 0 ? (
          <div className="card stack" style={{ padding: 'var(--space-4)' }}>
            <p className="muted">
              {search.trim()
                ? 'Nenhum exercício encontrado para essa busca.'
                : 'Sua biblioteca está vazia. Crie o primeiro exercício para começar a reutilizar nas suas sessões.'}
            </p>
          </div>
        ) : (
          <ul className="plain stack" style={{ gap: 'var(--space-2)' }}>
            {visibleItems.map((item) => {
              const summary = summarizeItem(item);
              return (
                <li key={item.id}>
                  <article
                    className="card stack"
                    style={{
                      padding: 'var(--space-3)',
                      gap: 'var(--space-2)',
                      opacity: item.archived ? 0.6 : 1,
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
                      <div
                        className="stack"
                        style={{ gap: 'var(--space-1)', flex: 1 }}
                      >
                        <strong>{item.name}</strong>
                        {summary.length ? (
                          <span className="text-caption muted">
                            {summary.join(' · ')}
                          </span>
                        ) : null}
                        <span className="text-caption muted">
                          Cadastrado por{' '}
                          {item.ownerStaff?.user.fullName ??
                            item.createdByUser.fullName}
                          {item.archived ? ' · arquivado' : ''}
                        </span>
                        {item.description ? (
                          <span className="text-body">{item.description}</span>
                        ) : null}
                        {item.notes ? (
                          <span className="text-caption muted">
                            Obs.: {item.notes}
                          </span>
                        ) : null}
                        {item.videoUrl ? (
                          <a
                            href={item.videoUrl}
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
                          onClick={() => openEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => askArchive(item)}
                        >
                          {item.archived ? 'Restaurar' : 'Arquivar'}
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

      <LibraryFormModal
        form={form}
        busy={busy}
        onChange={(next) => setForm(next)}
        onClose={() => setForm(null)}
        onSubmit={submitForm}
      />

      <ConfirmDialog
        open={!!pendingArchive}
        onOpenChange={(open) => {
          if (!open) setPendingArchive(null);
        }}
        title={
          pendingArchive?.target
            ? 'Arquivar exercício?'
            : 'Restaurar exercício?'
        }
        description={
          pendingArchive ? (
            <p>
              {pendingArchive.target
                ? 'Exercícios arquivados deixam de aparecer ao montar uma sessão. Você pode restaurar a qualquer momento.'
                : 'O exercício voltará a aparecer ao montar sessões.'}
            </p>
          ) : null
        }
        confirmLabel={pendingArchive?.target ? 'Arquivar' : 'Restaurar'}
        danger={pendingArchive?.target}
        busy={archiveBusy}
        onConfirm={confirmArchive}
      />
    </>
  );
}

type LibraryFormModalProps = {
  form: FormState | null;
  busy: boolean;
  onChange: (next: FormState | null) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

function LibraryFormModal({
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: LibraryFormModalProps) {
  const open = !!form;
  const title =
    form?.mode === 'edit' ? 'Editar exercício' : 'Novo exercício';
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
            Nome
            <input
              className="input"
              maxLength={140}
              autoFocus
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
            />
          </label>
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
          <p className="text-caption muted">
            Defaults sugeridos quando o exercício for adicionado a uma sessão.
            Você pode alterá-los antes de salvar a sessão.
          </p>
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
                value={form.defaultSets}
                onChange={(e) =>
                  onChange({ ...form, defaultSets: e.target.value })
                }
              />
            </label>
            <label className="stack text-caption" style={{ flex: 1 }}>
              Repetições
              <input
                className="input"
                type="number"
                min={1}
                max={500}
                value={form.defaultRepetitions}
                onChange={(e) =>
                  onChange({ ...form, defaultRepetitions: e.target.value })
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
                value={form.defaultDurationSeconds}
                onChange={(e) =>
                  onChange({
                    ...form,
                    defaultDurationSeconds: e.target.value,
                  })
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
                value={form.defaultRestSeconds}
                onChange={(e) =>
                  onChange({ ...form, defaultRestSeconds: e.target.value })
                }
              />
            </label>
          </div>
          <label className="stack text-caption">
            Notas (opcional)
            <textarea
              className="input"
              rows={2}
              maxLength={280}
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
      ) : null}
    </Modal>
  );
}
