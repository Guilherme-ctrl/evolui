import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateBR } from '../lib/format-date';

type ReportDetail = {
  id: string;
  title: string;
  summaryText: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string | null;
  dataJson: Record<string, unknown> | null;
  student: { id: string; fullName: string };
};

export default function RelatorioDetail() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<ReportDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!id) return;
    return runDeferredEffect(() => {
      void apiFetch<ReportDetail>(`/reports/${id}`)
        .then((r) => {
          setLoadErr(null);
          setData(r);
        })
        .catch((e) => setLoadErr(e instanceof Error ? e.message : 'Erro'));
    });
  }, [id]);

  const publish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      await apiFetch(`/reports/${id}/publish`, { method: 'POST' });
      toast.success('Relatório publicado. Responsáveis foram notificados.');
      const next = await apiFetch<ReportDetail>(`/reports/${id}`);
      setData(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao publicar');
    } finally {
      setPublishing(false);
    }
  };

  if (loadErr && !data) {
    return (
      <div className="page stack">
        <Banner variant="danger" onDismiss={() => setLoadErr(null)}>
          {loadErr}
        </Banner>
        <Link to="/relatorios">Voltar</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page muted" style={{ paddingTop: '2rem' }}>
        Carregando…
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';
  const isDraft = data.status === 'DRAFT';

  return (
    <div className="page stack">
      <nav className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
        {isAdmin ? (
          <Link to="/relatorios">← Relatórios</Link>
        ) : (
          <Link to={`/filhos/${data.student.id}/relatorios`}>← Relatórios do atleta</Link>
        )}
      </nav>

      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">{data.title}</h1>
          <p className="page-header__subtitle">
            {data.student.fullName} · {formatDateBR(data.periodStart)} — {formatDateBR(data.periodEnd)}
          </p>
        </div>
      </header>

      <div
        className="row stack"
        style={{
          gap: 'var(--space-4)',
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        <div
          className={`card card--lg stack ${isDraft ? 'card--interactive' : ''}`}
          style={{ flex: '1 1 18rem', borderColor: isDraft ? 'var(--state-warning)' : undefined }}
        >
          <h2 className="text-h3">
            {isDraft ? 'Rascunho (família ainda não vê)' : 'Publicado para a família'}
          </h2>
          {isDraft ? (
            <p className="text-caption" style={{ color: 'var(--state-warning)' }}>
              Conteúdo abaixo é pré-visualização. Após publicar, o texto e os dados ficam disponíveis no portal
              do responsável.
            </p>
          ) : (
            <p className="text-caption muted">
              Publicado em{' '}
              {data.publishedAt ? formatDateBR(data.publishedAt) : '—'}
            </p>
          )}
          <p className="text-body" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {data.summaryText}
          </p>
        </div>

        <div className="card card--lg stack" style={{ flex: '1 1 18rem' }}>
          <h2 className="text-h3">Dados agregados (JSON)</h2>
          <p className="text-caption muted" style={{ margin: 0 }}>
            Sem dados de saúde sensíveis. Apenas métricas do período.
          </p>
          <pre
            className="text-caption"
            style={{
              margin: 0,
              padding: 'var(--space-3)',
              background: 'var(--bg-base)',
              borderRadius: 'var(--radius-input)',
              overflow: 'auto',
              maxHeight: '24rem',
            }}
          >
            {data.dataJson
              ? JSON.stringify(data.dataJson, null, 2)
              : '—'}
          </pre>
        </div>
      </div>

      {isAdmin && isDraft ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={publishing}
          onClick={() => void publish()}
        >
          {publishing ? 'Publicando…' : 'Publicar relatório'}
        </button>
      ) : null}
    </div>
  );
}
