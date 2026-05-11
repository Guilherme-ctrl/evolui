import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';

export default function Login() {
  const { user, login } = useAuth();

  useEffect(() => {
    document.title = 'Entrar · Evolui';
  }, []);
  const [tenantSlug, setTenantSlug] = useState('demo');
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('senha123');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(tenantSlug.trim(), email.trim(), password);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : 'Não foi possível entrar. Verifique escola, e-mail e senha.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow stack">
      <div className="login-brand">
        <img
          className="login-brand__wordmark"
          src="/brand/logo-wordmark-on-dark.svg"
          width={200}
          height={33}
          alt="Evolui"
        />
      </div>
      <header className="page-header page-header--tight">
        <div className="page-header__text">
          <h1 className="page-header__title">Entrar</h1>
          <p className="page-header__subtitle">
            Evolui — gestão da escolinha (ambiente local: demo / senha123)
          </p>
        </div>
      </header>
      <form className="stack card card--lg" onSubmit={onSubmit}>
        <label className="stack" htmlFor="login-tenant-slug">
          <span className="muted" id="login-tenant-label">
            Slug da escolinha
          </span>
          <input
            id="login-tenant-slug"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            autoComplete="organization"
            required
            aria-describedby="login-tenant-label"
            aria-invalid={!!err}
          />
        </label>
        <label className="stack" htmlFor="login-email">
          <span className="muted" id="login-email-label">
            E-mail
          </span>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            aria-describedby="login-email-label"
            aria-invalid={!!err}
          />
        </label>
        <label className="stack" htmlFor="login-password">
          <span className="muted" id="login-password-label">
            Senha
          </span>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-describedby={err ? 'login-error login-password-label' : 'login-password-label'}
            aria-invalid={!!err}
          />
        </label>
        {err ? (
          <Banner id="login-error" variant="danger">
            {err}
          </Banner>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
