import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FeedbackDimensionsEditor } from '../components/FeedbackDimensionsEditor';
import { useToast } from '../components/useToast';
import {
  validateDimensions,
  type FeedbackDimension,
} from '../domain/feedback-dimensions';
import { canConfigureTenantDefaults } from '../domain/rbac';
import { errorMessageFromUnknown, setToken } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { authApi } from '../services/auth';
import { notificationsApi } from '../services/notifications';
import { tenantSettingsApi } from '../services/tenant-settings';
import type { NotificationPreferenceRow as PrefRow } from '../services/types';

export default function Preferencias() {
  const toast = useToast();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = canConfigureTenantDefaults(user);
  const [rows, setRows] = useState<PrefRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionsConfirmOpen, setSessionsConfirmOpen] = useState(false);
  const [tenantDims, setTenantDims] = useState<FeedbackDimension[]>([]);
  const [tenantDimsLoaded, setTenantDimsLoaded] = useState(false);
  const [tenantDimsBusy, setTenantDimsBusy] = useState(false);
  const [tenantDimsDirty, setTenantDimsDirty] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await notificationsApi.preferences();
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível carregar preferências.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return runDeferredEffect(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      try {
        const r = await tenantSettingsApi.getFeedbackDimensions();
        setTenantDims(r.dimensions);
      } catch (e) {
        toast.error(
          errorMessageFromUnknown(
            e,
            'Falha ao carregar dimensões padrão de feedback.',
          ),
        );
      } finally {
        setTenantDimsLoaded(true);
      }
    })();
  }, [isAdmin, toast]);

  async function saveTenantDims() {
    const err = validateDimensions(tenantDims);
    if (err) {
      toast.error(err);
      return;
    }
    setTenantDimsBusy(true);
    try {
      const r = await tenantSettingsApi.setFeedbackDimensions(tenantDims);
      setTenantDims(r.dimensions);
      setTenantDimsDirty(false);
      toast.success('Dimensões padrão salvas.');
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, 'Falha ao salvar.'));
    } finally {
      setTenantDimsBusy(false);
    }
  }

  async function save(next: PrefRow[]) {
    setSaving(true);
    setErr(null);
    try {
      const updated = await notificationsApi.savePreferences({
        preferences: next.map((r) => ({
          category: r.category,
          inAppEnabled: r.requiredInApp ? true : r.inAppEnabled,
        })),
      });
      setRows(updated);
      toast.success('Preferências salvas.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function toggle(category: string, on: boolean) {
    const next = rows.map((r) =>
      r.category === category ? { ...r, inAppEnabled: on } : r,
    );
    setRows(next);
    void save(next);
  }

  async function encerrarSessoes() {
    setSessionsBusy(true);
    setErr(null);
    try {
      await authApi.logoutAll();
      setToken(null);
      logout();
      setSessionsConfirmOpen(false);
      navigate('/login', { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível encerrar as sessões.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSessionsBusy(false);
    }
  }

  return (
    <div className="page stack" style={{ maxWidth: '36rem' }}>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Preferências</h1>
          <p className="page-header__subtitle">
            Notificações in-app por categoria (ROT-NOT-02). Cancelamento de treino não pode ser desligado (RN-1101).
          </p>
        </div>
      </header>

      {loading ? <p className="muted">Carregando…</p> : null}
      {err ? (
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      ) : null}

      {!loading && rows.length ? (
        <ul className="plain stack" style={{ gap: 'var(--space-4)' }}>
          {rows.map((r) => (
            <li key={r.category} className="card stack" style={{ padding: 'var(--space-4)' }}>
              <div className="pref-row">
                <div>
                  <strong>{r.label}</strong>
                  {r.requiredInApp ? (
                    <span className="text-caption muted" style={{ display: 'block', marginTop: 'var(--space-1)' }}>
                      Obrigatório — não desligável
                    </span>
                  ) : null}
                  <p className="muted text-caption" style={{ margin: 'var(--space-2) 0 0' }}>
                    {r.description}
                  </p>
                </div>
                <label className="pref-toggle" htmlFor={`pref-${r.category}`}>
                  <input
                    id={`pref-${r.category}`}
                    type="checkbox"
                    checked={r.inAppEnabled}
                    disabled={r.requiredInApp || saving}
                    onChange={(e) => toggle(r.category, e.target.checked)}
                    aria-describedby={`pref-desc-${r.category}`}
                  />
                  <span className="muted text-caption" id={`pref-desc-${r.category}`}>
                    {r.inAppEnabled ? 'Ativo' : 'Silenciado'}
                  </span>
                </label>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isAdmin ? (
        <section className="card stack" style={{ padding: 'var(--space-5)' }}>
          <header className="stack" style={{ gap: 'var(--space-1)' }}>
            <h2 className="text-h3" style={{ margin: 0 }}>
              Feedback físico padrão
            </h2>
            <p className="muted text-caption" style={{ margin: 0 }}>
              Dimensões que o aluno responde (1–5) ao final de cada evento do
              calendário. Cada evento pode sobrescrever individualmente; deixar
              esta lista vazia desliga o pedido de feedback por padrão.
            </p>
          </header>
          {!tenantDimsLoaded ? (
            <p className="muted">Carregando…</p>
          ) : (
            <FeedbackDimensionsEditor
              value={tenantDims}
              onChange={(next) => {
                setTenantDims(next);
                setTenantDimsDirty(true);
              }}
              helperText="Sugestão: comece com 2–3 dimensões (ex: Desgaste físico, Desgaste muscular, Humor). O identificador (key) é usado internamente e não muda mesmo se você renomear o rótulo."
            />
          )}
          <div
            className="row"
            style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}
          >
            <button
              type="button"
              className="btn btn-primary"
              disabled={!tenantDimsLoaded || tenantDimsBusy || !tenantDimsDirty}
              onClick={() => void saveTenantDims()}
            >
              {tenantDimsBusy ? 'Salvando…' : 'Salvar dimensões padrão'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="card stack" style={{ padding: 'var(--space-5)' }}>
        <h2 className="text-h3" style={{ margin: 0 }}>
          Sessões
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Revoga todos os tokens emitidos antes de agora nesta conta (outros aparelhos perdem acesso imediatamente).
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={sessionsBusy}
          onClick={() => setSessionsConfirmOpen(true)}
        >
          Encerrar todas as sessões
        </button>
      </section>

      <ConfirmDialog
        open={sessionsConfirmOpen}
        onOpenChange={setSessionsConfirmOpen}
        title="Encerrar todas as sessões"
        description="Encerrar todas as sessões neste e em outros dispositivos? Você precisará entrar de novo."
        confirmLabel="Encerrar sessões"
        danger
        busy={sessionsBusy}
        onConfirm={() => void encerrarSessoes()}
      />
    </div>
  );
}
