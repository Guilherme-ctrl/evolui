import { useCallback, useEffect, useState } from 'react';
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

export default function AvaliacoesConfig() {
  const toast = useToast();
  const { user } = useAuth();
  const [model, setModel] = useState<EvalModel>('STARS');
  const [dims, setDims] = useState<DimRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const c = await apiFetch<TenantEvalConfig>('/evaluations/config');
      setModel(c.evaluationModel);
      setDims(parseDims(c.evaluationDimensions));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return runDeferredEffect(() => {
      void load();
    });
  }, [load]);

  if (!user) return null;
  if (user.role !== 'ADMIN') {
    return <Navigate to="/avaliacoes" replace />;
  }

  const save = async () => {
    setErr(null);
    try {
      await apiFetch('/evaluations/config', {
        method: 'POST',
        body: JSON.stringify({
          evaluationModel: model,
          evaluationDimensions: dims.map((d, i) => ({
            key: d.key,
            label: d.label,
            order: i,
          })),
        }),
      });
      toast.success('Configuração salva.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  };

  const addDim = () => {
    setDims((d) => [
      ...d,
      { key: `dim_${d.length + 1}`, label: 'Nova dimensão', order: d.length },
    ]);
  };

  const updateDim = (i: number, patch: Partial<DimRow>) => {
    setDims((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const removeDim = (i: number) => {
    setDims((rows) => rows.filter((_, j) => j !== i));
  };

  return (
    <div className="page stack">
      <nav className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
        <Link to="/avaliacoes">← Avaliações</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Configuração de avaliações</h1>
          <p className="page-header__subtitle">
            Modelo de pontuação e dimensões usadas na turma (somente administrador).
          </p>
        </div>
      </header>

      {loading ? <p className="muted">Carregando…</p> : null}
      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      {!loading ? (
        <>
          <fieldset className="card card--lg stack">
            <legend className="text-h3">Modelo</legend>
            <label className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
              <input
                type="radio"
                name="model"
                checked={model === 'STARS'}
                onChange={() => setModel('STARS')}
              />
              <span>Estrelas (1 a 5 por dimensão)</span>
            </label>
            <label className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
              <input
                type="radio"
                name="model"
                checked={model === 'SIMPLE_SCALE'}
                onChange={() => setModel('SIMPLE_SCALE')}
              />
              <span>Escala simples (Excelente / Muito bom / Bom / Precisa melhorar)</span>
            </label>
          </fieldset>

          <div className="card card--lg stack">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <h2 className="text-h3" style={{ margin: 0 }}>
                Dimensões
              </h2>
              <button type="button" className="btn btn-secondary" onClick={addDim}>
                Adicionar dimensão
              </button>
            </div>
            {dims.length === 0 ? (
              <p className="muted">Nenhuma dimensão. Adicione ao menos uma chave e rótulo.</p>
            ) : (
              <ul className="plain stack" style={{ gap: 'var(--space-4)' }}>
                {dims.map((d, i) => (
                  <li key={`${d.key}-${i}`} className="stack card" style={{ padding: 'var(--space-4)' }}>
                    <label className="stack">
                      <span className="muted text-caption">Chave (id)</span>
                      <input
                        value={d.key}
                        onChange={(e) => updateDim(i, { key: e.target.value })}
                      />
                    </label>
                    <label className="stack">
                      <span className="muted text-caption">Rótulo</span>
                      <input
                        value={d.label}
                        onChange={(e) => updateDim(i, { label: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeDim(i)}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            Salvar configuração
          </button>
        </>
      ) : null}
    </div>
  );
}
