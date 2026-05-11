import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { ProgressBar } from '../components/ProgressBar';
import { useToast } from '../components/useToast';
import { apiFetch, apiFetchBlob, getToken, setToken } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateBR } from '../lib/format-date';

type TurmaOpt = { id: string; name: string };
type CalEv = { id: string; title: string; startsAt: string };
type Stu = { id: string; fullName: string };
type MediaRow = {
  id: string;
  mimeType: string;
  createdAt: string;
  turmaId: string | null;
  thumbnailKey: string | null;
  turma?: { id: string; name: string } | null;
};

const PAGE = 24;
const FETCH = PAGE + 1;

function postUploadMulti(
  files: File[],
  q: { turmaId?: string; eventId?: string; studentIds?: string[] },
  onProgress: (pct: number) => void,
): Promise<MediaRow[]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const params = new URLSearchParams();
    if (q.turmaId) params.set('turmaId', q.turmaId);
    if (q.eventId) params.set('eventId', q.eventId);
    if (q.studentIds?.length) params.set('studentIds', q.studentIds.join(','));
    const qs = params.toString();
    xhr.open('POST', `/api/media/upload-multi${qs ? `?${qs}` : ''}`);
    const t = getToken();
    if (t) xhr.setRequestHeader('Authorization', `Bearer ${t}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((100 * e.loaded) / e.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MediaRow[]);
        } catch {
          reject(new Error('Resposta inválida'));
        }
      } else if (xhr.status === 401) {
        setToken(null);
        window.location.href = '/login';
        reject(new Error('Não autorizado'));
      } else {
        reject(new Error(xhr.responseText?.slice(0, 300) || String(xhr.status)));
      }
    };
    xhr.onerror = () => reject(new Error('Falha de rede'));
    xhr.send(fd);
  });
}

function MediaThumb({
  item,
  onOpen,
  isAdmin,
  onDeleted,
}: {
  item: MediaRow;
  onOpen: () => void;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const isImage = item.mimeType.startsWith('image/');
  const isVideo = item.mimeType.startsWith('video/');

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (item.thumbnailKey && isImage) {
          const { blob } = await apiFetchBlob(`/media/${item.id}/thumbnail`);
          if (!cancelled) {
            url = URL.createObjectURL(blob);
            setSrc(url);
          }
          return;
        }
        if (isImage) {
          const { blob } = await apiFetchBlob(`/media/${item.id}/file`);
          if (!cancelled) {
            url = URL.createObjectURL(blob);
            setSrc(url);
          }
        }
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.id, item.thumbnailKey, isImage]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/media/${item.id}`, { method: 'DELETE' });
      onDeleted();
      setConfirmOpen(false);
      toast.success('Mídia removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <figure className="midia-cell">
      <button type="button" className="midia-cell__open" onClick={onOpen}>
        {src ? (
          <img src={src} alt="" className="midia-cell__img" />
        ) : isVideo ? (
          <div className="midia-cell__placeholder">Vídeo</div>
        ) : (
          <div className="midia-cell__placeholder">Arquivo</div>
        )}
      </button>
      <figcaption className="midia-cell__cap text-caption muted">
        {formatDateBR(item.createdAt)}
        {item.turma ? ` · ${item.turma.name}` : ''}
      </figcaption>
      {isAdmin ? (
        <button
          type="button"
          className="btn btn-ghost midia-cell__del"
          onClick={() => setConfirmOpen(true)}
        >
          Excluir
        </button>
      ) : null}
      {isAdmin ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Excluir mídia"
          description="Excluir esta mídia do armazenamento? (CA-11.03)"
          confirmLabel="Excluir"
          danger
          busy={deleting}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </figure>
  );
}

export default function Midia() {
  const toast = useToast();
  const { user } = useAuth();
  const canUpload = user?.role === 'ADMIN' || user?.role === 'TREINADOR';
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<MediaRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [turmaFilter, setTurmaFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [events, setEvents] = useState<CalEv[]>([]);
  const [students, setStudents] = useState<Stu[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [upTurma, setUpTurma] = useState('');
  const [upEvent, setUpEvent] = useState('');
  const [upStudents, setUpStudents] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [upBusy, setUpBusy] = useState(false);

  const [lightbox, setLightbox] = useState<MediaRow | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setErr(null);
    const params = new URLSearchParams();
    params.set('take', String(FETCH));
    if (turmaFilter) params.set('turmaId', turmaFilter);
    const chunk = await apiFetch<MediaRow[]>(`/media?${params}`);
    const more = chunk.length > PAGE;
    const list = chunk.slice(0, PAGE);
    setItems(list);
    setHasMore(more);
    setNextCursor(more && list.length ? list[list.length - 1].id : undefined);
  }, [turmaFilter]);

  useEffect(() => {
    return runDeferredEffect(() => {
      setNextCursor(undefined);
      setItems([]);
      setHasMore(true);
      void loadFirstPage().catch((e) => {
        setErr(e instanceof Error ? e.message : 'Erro ao listar');
      });
    });
  }, [loadFirstPage]);

  async function loadMore() {
    if (!nextCursor || !hasMore) return;
    setErr(null);
    const params = new URLSearchParams();
    params.set('take', String(FETCH));
    if (turmaFilter) params.set('turmaId', turmaFilter);
    params.set('cursor', nextCursor);
    try {
      const chunk = await apiFetch<MediaRow[]>(`/media?${params}`);
      const more = chunk.length > PAGE;
      const list = chunk.slice(0, PAGE);
      setItems((prev) => [...prev, ...list]);
      setHasMore(more);
      setNextCursor(more && list.length ? list[list.length - 1].id : undefined);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao listar');
    }
  }

  useEffect(() => {
    if (!canUpload) return;
    return runDeferredEffect(() => {
      void apiFetch<TurmaOpt[]>('/turmas').then(setTurmas);
      const from = new Date();
      const to = new Date(from.getTime() + 86400000 * 45);
      const q = new URLSearchParams({
        take: '40',
        from: from.toISOString(),
        to: to.toISOString(),
      });
      void apiFetch<CalEv[]>(`/calendar/events?${q}`).then(setEvents);
      void apiFetch<Stu[]>('/students').then(setStudents);
    });
  }, [canUpload]);

  const turmaOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of turmas) m.set(t.id, t.name);
    for (const it of items) {
      if (it.turma) m.set(it.turma.id, it.turma.name);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [turmas, items]);

  useEffect(() => {
    if (!lightbox) {
      return runDeferredEffect(() => {
        setLightboxUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      });
    }
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { blob } = await apiFetchBlob(`/media/${lightbox.id}/file`);
        if (!cancelled) {
          url = URL.createObjectURL(blob);
          setLightboxUrl(url);
        }
      } catch {
        if (!cancelled) setLightboxUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [lightbox]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function onSubmitUpload(e: FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setUpBusy(true);
    setUpErr(null);
    setProgress(0);
    try {
      await postUploadMulti(
        files,
        {
          turmaId: upTurma || undefined,
          eventId: upEvent || undefined,
          studentIds: upStudents.length ? upStudents : undefined,
        },
        setProgress,
      );
      toast.success('Envio concluído.');
      setModalOpen(false);
      setFiles([]);
      setProgress(0);
      const params = new URLSearchParams();
      params.set('take', String(FETCH));
      if (turmaFilter) params.set('turmaId', turmaFilter);
      const chunk = await apiFetch<MediaRow[]>(`/media?${params}`);
      const more = chunk.length > PAGE;
      const list = chunk.slice(0, PAGE);
      setItems(list);
      setHasMore(more);
      setNextCursor(more && list.length ? list[list.length - 1].id : undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Envio falhou — tente de novo.';
      setUpErr(msg);
      toast.error(msg);
    } finally {
      setUpBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const list = [...e.dataTransfer.files].slice(0, 12);
    setFiles(list);
  }

  return (
    <div className="page stack midia-page">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Mídia</h1>
          <p className="page-header__subtitle">
            Galeria por turma e evento. Apenas equipe envia arquivos (RN-804).
          </p>
        </div>
        {canUpload ? (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            Enviar fotos
          </button>
        ) : null}
      </header>

      <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' }}>
        <label className="stack" style={{ minWidth: '12rem' }}>
          <span className="muted">Filtrar por turma</span>
          <select value={turmaFilter} onChange={(e) => setTurmaFilter(e.target.value)}>
            <option value="">Todas</option>
            {turmaOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <span>{err}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void loadFirstPage().catch((e) => {
                  setErr(e instanceof Error ? e.message : 'Erro ao listar');
                })
              }
            >
              Tentar carregar de novo
            </button>
          </div>
        </Banner>
      ) : null}

      {items.length === 0 && !err ? (
        <div className="card stack card--lg" style={{ gap: 'var(--space-4)' }}>
          <h2 className="page-header__title" style={{ fontSize: '1.125rem' }}>
            Nenhuma mídia nesta visualização
          </h2>
          <p className="text-body muted" style={{ margin: 0 }}>
            {canUpload
              ? 'Envie fotos ou víncule-as a uma turma ou evento. Famílias veem a galeria quando há arquivos publicados.'
              : 'Quando a escolinha publicar fotos ou vídeos da turma do seu filho, eles aparecerão aqui.'}
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {canUpload ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
                  Enviar fotos
                </button>
                <Link to="/calendario" className="btn btn-secondary">
                  Ver calendário
                </Link>
              </>
            ) : (
              <Link to="/filhos" className="btn btn-primary">
                Ver filhos
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="midia-grid">
          {items.map((it) => (
            <MediaThumb
              key={it.id}
              item={it}
              isAdmin={isAdmin}
              onOpen={() => setLightbox(it)}
              onDeleted={() => {
                setItems((prev) => prev.filter((x) => x.id !== it.id));
              }}
            />
          ))}
        </div>
      )}

      {hasMore ? (
        <button type="button" className="btn btn-secondary" onClick={() => void loadMore()}>
          Carregar mais
        </button>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => !upBusy && setModalOpen(false)}
        title="Enviar até 12 arquivos"
        closeOnBackdrop={!upBusy}
        closeOnEscape={!upBusy}
      >
            <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={(e) => void onSubmitUpload(e)}>
              <label className="stack">
                <span className="muted">Turma (opcional)</span>
                <select value={upTurma} onChange={(e) => setUpTurma(e.target.value)}>
                  <option value="">—</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Evento (opcional)</span>
                <select value={upEvent} onChange={(e) => setUpEvent(e.target.value)}>
                  <option value="">—</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({formatDateBR(ev.startsAt)})
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="muted text-caption">Marcar atletas (opcional)</legend>
                <div className="midia-student-pick">
                  {students.map((s) => (
                    <label key={s.id} className="field-check">
                      <input
                        type="checkbox"
                        checked={upStudents.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setUpStudents((p) => [...p, s.id]);
                          else setUpStudents((p) => p.filter((x) => x !== s.id));
                        }}
                      />
                      <span>{s.fullName}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div
                className="midia-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
              >
                <p className="muted" style={{ margin: 0 }}>
                  Arraste arquivos ou escolha até 12 (máx. 40MB cada; lote 240MB).
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 12))}
                />
                {files.length ? (
                  <ul className="plain text-caption">
                    {files.map((f) => (
                      <li key={f.name + f.size}>
                        {f.name} — {(f.size / (1024 * 1024)).toFixed(1)} MB
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {upBusy ? (
                <ProgressBar value={progress} max={100} label="Enviando arquivos" />
              ) : null}
              {upErr ? (
                <Banner variant="danger" onDismiss={() => setUpErr(null)}>
                  <div className="stack" style={{ gap: 'var(--space-3)' }}>
                    <span>{upErr}</span>
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      disabled={upBusy || !files.length}
                    >
                      Tentar enviar de novo
                    </button>
                  </div>
                </Banner>
              ) : null}
              <div className="ds-modal__actions">
                <button type="button" className="btn btn-ghost" disabled={upBusy} onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={upBusy || !files.length}>
                  Enviar
                </button>
              </div>
            </form>
      </Modal>

      {lightbox && lightboxUrl ? (
        <div
          className="midia-lightbox"
          role="presentation"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="midia-lightbox__close btn btn-ghost" aria-label="Fechar">
            ×
          </button>
          {lightbox.mimeType.startsWith('video/') ? (
            <video src={lightboxUrl} controls className="midia-lightbox__media" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={lightboxUrl} alt="" className="midia-lightbox__media" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      ) : null}
    </div>
  );
}
