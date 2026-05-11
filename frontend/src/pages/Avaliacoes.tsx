import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';

type EvalModel = 'STARS' | 'SIMPLE_SCALE';

type DimRow = { key: string; label: string; order: number };

type TenantEvalConfig = {
  evaluationModel: EvalModel;
  evaluationDimensions: unknown;
};

type TurmaRow = { id: string; name: string };

type TurmaDetail = {
  id: string;
  name: string;
  enrollments: { student: { id: string; fullName: string } }[];
};

type Draft = {
  scores: Record<string, number | string>;
  comment: string;
  saved: boolean;
};

const SIMPLE_LABELS = ['Excelente', 'Muito bom', 'Bom', 'Precisa melhorar'] as const;

function parseDims(raw: unknown): DimRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x, i) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      const key = String(o.key ?? '').trim();
      const label = String(o.label ?? key).trim();
      const order = Number.isFinite(Number(o.order)) ? Number(o.order) : i;
      if (!key) return null;
      return { key, label: label || key, order };
    })
    .filter((x): x is DimRow => x !== null)
    .sort((a, b) => a.order - b.order);
}

function scoresComplete(
  model: EvalModel,
  dims: DimRow[],
  scores: Record<string, number | string>,
): boolean {
  for (const d of dims) {
    const v = scores[d.key];
    if (v === undefined || v === null) return false;
    if (model === 'STARS') {
      if (typeof v !== 'number' || v < 1 || v > 5) return false;
    } else {
      if (typeof v !== 'string') return false;
      if (!SIMPLE_LABELS.includes(v as (typeof SIMPLE_LABELS)[number])) return false;
    }
  }
  return dims.length > 0;
}

export default function Avaliacoes() {
  const toast = useToast();
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [turmaDetail, setTurmaDetail] = useState<TurmaDetail | null>(null);
  const [config, setConfig] = useState<TenantEvalConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const dims = useMemo(() => parseDims(config?.evaluationDimensions), [config]);
  const model = config?.evaluationModel ?? 'STARS';

  const loadTurmas = useCallback(async () => {
    const rows = await apiFetch<TurmaRow[]>('/turmas');
    setTurmas(rows);
    setTurmaId((tid) => tid || (rows[0]?.id ?? ''));
  }, []);

  useEffect(() => {
    return runDeferredEffect(() => {
      void loadTurmas().catch((e) => setLoadErr(e instanceof Error ? e.message : 'Erro'));
    });
  }, [loadTurmas]);

  useEffect(() => {
    if (!turmaId) return;
    return runDeferredEffect(() => {
      void (async () => {
        try {
          setLoadErr(null);
          const [detail, cfg] = await Promise.all([
            apiFetch<TurmaDetail>(`/turmas/${turmaId}`),
            apiFetch<TenantEvalConfig>('/evaluations/config'),
          ]);
          setTurmaDetail(detail);
          setConfig(cfg);
          const next: Record<string, Draft> = {};
          for (const e of detail.enrollments) {
            next[e.student.id] = { scores: {}, comment: '', saved: false };
          }
          setDrafts(next);
          setIndex(0);
        } catch (e) {
          setLoadErr(e instanceof Error ? e.message : 'Erro');
        }
      })();
    });
  }, [turmaId]);

  if (!user) return null;
  if (user.role !== 'ADMIN' && user.role !== 'TREINADOR') {
    return <Navigate to="/" replace />;
  }

  const enrollments = turmaDetail?.enrollments ?? [];
  const n = enrollments.length;
  const current = enrollments[index];
  const studentId = current?.student.id;
  const draft = studentId ? drafts[studentId] : undefined;

  const patchDraft = (sid: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [sid]: { ...prev[sid], ...patch, saved: patch.saved ?? false },
    }));
  };

  const setStar = (sid: string, key: string, value: number) => {
    setDrafts((prev) => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        scores: { ...prev[sid].scores, [key]: value },
        comment: prev[sid].comment,
        saved: false,
      },
    }));
  };

  const setSimple = (sid: string, key: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        scores: { ...prev[sid].scores, [key]: value },
        comment: prev[sid].comment,
        saved: false,
      },
    }));
  };

  const setComment = (sid: string, comment: string) => {
    if (comment.length > 140) return;
    setDrafts((prev) => ({
      ...prev,
      [sid]: { ...prev[sid], comment, saved: false },
    }));
  };

  const saveCurrent = async () => {
    if (!studentId || !draft || !turmaId) return;
    if (!scoresComplete(model, dims, draft.scores)) {
      toast.error('Preencha todas as dimensões antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          turmaId,
          scores: draft.scores,
          comment: draft.comment.trim() || undefined,
        }),
      });
      patchDraft(studentId, { saved: true });
      toast.success('Avaliação salva.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const go = (delta: number) => {
    setIndex((i) => Math.min(Math.max(0, i + delta), Math.max(0, n - 1)));
  };

  return (
    <div className="field-mode">
      <div className="page stack">
        <header className="page-header">
          <div className="page-header__text">
            <h1 className="page-header__title">Avaliações</h1>
            <p className="page-header__subtitle">
              Registro por aluno, turma a turma. Toques largos para uso em campo.
            </p>
          </div>
          {user.role === 'ADMIN' ? (
            <Link to="/avaliacoes/config" className="btn btn-secondary">
              Configuração
            </Link>
          ) : null}
        </header>

        {loadErr ? (
          <Banner variant="danger" onDismiss={() => setLoadErr(null)}>
            {loadErr}
          </Banner>
        ) : null}

        <label className="stack" htmlFor="avaliacoes-turma">
          <span className="muted" id="avaliacoes-turma-lbl">
            Turma
          </span>
          <select
            id="avaliacoes-turma"
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            aria-describedby="avaliacoes-turma-lbl"
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {dims.length === 0 ? (
          <Banner variant="warning">
            Não há dimensões configuradas.{' '}
            {user.role === 'ADMIN' ? (
              <Link to="/avaliacoes/config">Configure em Configuração de avaliações</Link>
            ) : (
              'Peça ao administrador para configurar as dimensões.'
            )}
          </Banner>
        ) : null}

        {n === 0 ? (
          <p className="muted">Nenhum aluno matriculado nesta turma.</p>
        ) : current && draft ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <p className="text-h3" style={{ margin: 0 }}>
                {current.student.fullName}
              </p>
              <span className="tabular-nums text-body row" style={{ gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }} aria-live="polite">
                <span>
                  {index + 1} / {n}
                </span>
                {draft.saved ? (
                  <span className="badge badge--ok">Salvo nesta sessão</span>
                ) : (
                  <span className="badge badge--warning">Não salvo</span>
                )}
              </span>
            </div>

            <div className="card card--lg stack">
              <p className="text-caption muted" style={{ margin: 0 }}>
                Modelo: {model === 'STARS' ? 'Estrelas (1–5)' : 'Escala simples'}
              </p>
              {dims.map((d) => (
                <div key={d.key} className="stack" style={{ gap: 'var(--space-2)' }}>
                  <span className="text-body" style={{ fontWeight: 600 }}>
                    {d.label}
                  </span>
                  {model === 'STARS' ? (
                    <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const sel = draft.scores[d.key] === star;
                        return (
                          <button
                            key={star}
                            type="button"
                            className={sel ? 'btn btn-field-cta' : 'btn btn-secondary'}
                            onClick={() => setStar(studentId, d.key, star)}
                            aria-pressed={sel}
                          >
                            {star}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="stack" style={{ gap: 'var(--space-2)' }}>
                      {SIMPLE_LABELS.map((label) => {
                        const sel = draft.scores[d.key] === label;
                        return (
                          <button
                            key={label}
                            type="button"
                            className={sel ? 'btn btn-field-cta btn-block' : 'btn btn-secondary btn-block'}
                            onClick={() => setSimple(studentId, d.key, label)}
                            aria-pressed={sel}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <label className="stack" htmlFor={`avaliacoes-comment-${studentId}`}>
                <span className="muted" id={`avaliacoes-comment-lbl-${studentId}`}>
                  Comentário (opcional, máx. 140) — {draft.comment.length}/140
                </span>
                <textarea
                  id={`avaliacoes-comment-${studentId}`}
                  value={draft.comment}
                  maxLength={140}
                  onChange={(e) => setComment(studentId, e.target.value)}
                  rows={3}
                  placeholder="Observação curta para a família"
                  aria-describedby={`avaliacoes-comment-lbl-${studentId}`}
                />
              </label>
            </div>

            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index <= 0}
                onClick={() => go(-1)}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="btn btn-field-cta"
                disabled={saving || dims.length === 0}
                onClick={() => void saveCurrent()}
              >
                {saving ? 'Salvando…' : 'Salvar avaliação'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={index >= n - 1}
                onClick={() => go(1)}
              >
                Próximo aluno →
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
