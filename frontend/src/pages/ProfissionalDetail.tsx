import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';

type StaffRow = {
  id: string;
  professionalType: string;
  active: boolean;
  registry: string | null;
  bio: string | null;
  user: { id: string; email: string; fullName: string; active: boolean };
};

const TYPES = [
  ['PROFESSOR', 'Professor'],
  ['FISIOTERAPEUTA', 'Fisioterapeuta'],
  ['PREPARADOR_FISICO', 'Preparador físico'],
  ['OUTRO', 'Outro'],
] as const;

export default function ProfissionalDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [row, setRow] = useState<StaffRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id || user?.role !== 'ADMIN') return;
    void apiFetch<StaffRow[]>('/staff')
      .then((list) => {
        const r = list.find((x) => x.id === id) ?? null;
        setRow(r);
        if (!r) setErr('Profissional não encontrado');
      })
      .catch((e) => {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar profissional.');
        setErr(msg);
        toast.error(msg);
      });
  }, [id, user?.role, toast]);

  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const fd = new FormData(e.currentTarget);
    const professionalType = String(fd.get('professionalType') ?? '');
    const registryRaw = String(fd.get('registry') ?? '').trim();
    const active = fd.get('active') === 'on';
    try {
      const updated = await apiFetch<StaffRow>(`/staff/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          professionalType,
          registry: registryRaw || null,
          active,
        }),
      });
      setRow(updated);
      toast.success('Alterações salvas.');
    } catch (ex) {
      toast.error(errorMessageFromUnknown(ex, 'Falha ao salvar.'));
    }
  }

  if (err && !row) {
    return (
      <div className="page stack">
        <Banner variant="danger">{err}</Banner>
        <Link to="/gestao/profissionais">Voltar</Link>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="page muted" style={{ paddingTop: '2rem' }}>
        Carregando…
      </div>
    );
  }

  return (
    <div className="page stack">
      <nav className="text-caption">
        <Link to="/gestao/profissionais">← Profissionais</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">{row.user.fullName}</h1>
          <p className="page-header__subtitle">{row.user.email}</p>
        </div>
      </header>

      <form className="card card--lg stack" style={{ gap: 'var(--space-4)' }} onSubmit={onSave}>
        <label className="stack text-caption">
          Tipo profissional
          <select
            name="professionalType"
            className="input"
            defaultValue={row.professionalType}
          >
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="stack text-caption">
          Registro
          <input name="registry" className="input" defaultValue={row.registry ?? ''} />
        </label>
        <label className="row text-caption" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
          <input type="checkbox" name="active" defaultChecked={row.active} />
          Perfil ativo (pode prescrever quando vinculado a turmas)
        </label>
        <button type="submit" className="btn btn-primary">
          Salvar
        </button>
      </form>
    </div>
  );
}
