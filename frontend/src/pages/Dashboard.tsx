import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ProgressBar } from '../components/ProgressBar';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';

type DashboardPayload = {
  period?: { from: string; to: string };
  students?: { active: number; inactive: number };
  attendance?: { sessionsClosed?: number; avgPresenceRatePct?: number | null };
  finance?: { delinquentCharges?: number; delinquentAmountCents?: number };
  turmas?: Array<{
    turmaId: string;
    name: string;
    enrolled: number;
    capacity: number;
    pct: number;
  }>;
  retentionNote?: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [json, setJson] = useState<string>('');

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    return runDeferredEffect(() => {
      void apiFetch<Record<string, unknown>>('/dashboard').then((d) =>
        setJson(JSON.stringify(d, null, 2)),
      );
    });
  }, [user?.role]);

  const data = useMemo((): DashboardPayload | null => {
    try {
      return JSON.parse(json) as DashboardPayload;
    } catch {
      return null;
    }
  }, [json]);

  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;

  const presencePct = data?.attendance?.avgPresenceRatePct;
  const presenceValue =
    typeof presencePct === 'number' && !Number.isNaN(presencePct)
      ? Math.min(100, Math.max(0, presencePct))
      : null;

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Dashboard admin</h1>
          <p className="page-header__subtitle">Métricas e payload bruto da API (operacional).</p>
        </div>
      </header>

      {data && presenceValue !== null ? (
        <section className="card stack card--lg" aria-label="Presença no período">
          <h2 className="text-h3" style={{ margin: 0 }}>
            Presença no período
          </h2>
          <ProgressBar
            value={presenceValue}
            max={100}
            label="Taxa média de presença registrada"
            ariaLabel={`Taxa média de presença ${presenceValue} por cento`}
          />
          {data.attendance?.sessionsClosed != null ? (
            <p className="text-caption muted" style={{ margin: 0 }}>
              Sessões encerradas:{' '}
              <span className="tabular-nums">{data.attendance.sessionsClosed}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      {data?.turmas?.length ? (
        <section className="card stack card--lg" aria-label="Ocupação das turmas">
          <h2 className="text-h3" style={{ margin: 0 }}>
            Ocupação por turma
          </h2>
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            {data.turmas.map((t) => (
              <ProgressBar
                key={t.turmaId}
                value={Math.min(100, Math.max(0, t.pct))}
                max={100}
                label={`${t.name} — ${t.enrolled}/${t.capacity || '—'} vagas`}
                ariaLabel={`Turma ${t.name}, ocupação ${t.pct} por cento`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <pre className="card code-block">{json}</pre>
    </div>
  );
}
