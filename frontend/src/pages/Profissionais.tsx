import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';

type StaffRow = {
  id: string;
  professionalType: string;
  active: boolean;
  registry: string | null;
  user: { id: string; email: string; fullName: string; active: boolean };
};

const TYPES = [
  ['PROFESSOR', 'Professor'],
  ['FISIOTERAPEUTA', 'Fisioterapeuta'],
  ['PREPARADOR_FISICO', 'Preparador físico'],
  ['OUTRO', 'Outro'],
] as const;

export default function Profissionais() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await apiFetch<StaffRow[]>('/staff');
      setRows(data);
    } catch (e) {
      const msg = errorMessageFromUnknown(e, 'Erro ao carregar profissionais.');
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    return runDeferredEffect(() => {
      void load();
    });
  }, [load]);

  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const fullName = String(fd.get('fullName') ?? '').trim();
    const professionalType = String(fd.get('professionalType') ?? 'PROFESSOR');
    const registry = String(fd.get('registry') ?? '').trim() || undefined;
    setSaving(true);
    try {
      await apiFetch('/staff', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          professionalType,
          registry,
        }),
      });
      toast.success('Profissional criado.');
      setOpen(false);
      e.currentTarget.reset();
      await load();
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao criar profissional.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page stack">
      <nav className="text-caption">
        <Link to="/gestao">← Gestão</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Profissionais</h1>
          <p className="page-header__subtitle">
            Professores, fisioterapeutas e preparadores que podem prescrever planos individuais.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Novo profissional
        </button>
      </header>

      {err ? <Banner variant="danger">{err}</Banner> : null}

      {loading ? (
        <p className="muted">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="card card--lg stack">
          <p className="muted">Nenhum profissional cadastrado ainda.</p>
        </div>
      ) : (
        <ul className="plain stack" style={{ gap: 'var(--space-3)' }}>
          {rows.map((r) => (
            <li key={r.id} className="card stack" style={{ padding: 'var(--space-4)' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <strong>{r.user.fullName}</strong>
                  <span className="muted"> · {r.user.email}</span>
                  <div className="text-caption muted">
                    {TYPES.find(([k]) => k === r.professionalType)?.[1] ?? r.professionalType}
                    {r.registry ? ` · Registro: ${r.registry}` : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span className={`badge ${r.active && r.user.active ? 'badge--ok' : 'badge--neutral'}`}>
                    {r.active && r.user.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <Link to={`/gestao/profissionais/${r.id}`} className="btn btn-secondary">
                    Editar
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} title="Novo profissional" onClose={() => setOpen(false)}>
        <form className="stack" style={{ gap: 'var(--space-3)' }} onSubmit={onCreate}>
          <label className="stack text-caption">
            Nome completo
            <input name="fullName" className="input" required />
          </label>
          <label className="stack text-caption">
            E-mail (login)
            <input name="email" type="email" className="input" required />
          </label>
          <label className="stack text-caption">
            Senha inicial
            <input name="password" type="password" className="input" required minLength={6} />
          </label>
          <label className="stack text-caption">
            Tipo
            <select name="professionalType" className="input">
              {TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="stack text-caption">
            Registro (CREF/CREFITO, opcional)
            <input name="registry" className="input" />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
