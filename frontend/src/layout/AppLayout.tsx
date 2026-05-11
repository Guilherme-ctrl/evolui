import { useEffect } from 'react';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { TermsAcceptModal } from '../components/TermsAcceptModal';

const PRODUCT_NAME = 'Evolui';

export default function AppLayout() {
  const { user, loading, logout, activeStudentId, setActiveStudent } = useAuth();

  useEffect(() => {
    if (user) document.title = `${PRODUCT_NAME} — ${user.tenantName}`;
  }, [user]);

  if (loading) {
    return (
      <div className="page muted" style={{ paddingTop: '3rem' }}>
        Carregando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const isActiveStaff = !!user.staffProfile?.active;
  const isAthlete = user.role === 'ATLETA';
  const showStudentSwitcher = isAthlete && user.students.length > 1;

  const nav: [string, string][] =
    user.role === 'ADMIN'
      ? [
          ['/', 'Início'],
          ['/gestao', 'Gestão'],
          ['/gestao/profissionais', 'Profissionais'],
          ['/biblioteca/exercicios', 'Biblioteca'],
          ['/treinos', 'Treinos'],
          ['/treinos/historico', 'Histórico'],
          ['/alunos', 'Alunos'],
          ['/turmas', 'Turmas'],
          ['/avaliacoes', 'Avaliações'],
          ['/calendario', 'Calendário'],
          ['/comunicacoes', 'Comunicações'],
          ['/midia', 'Mídia'],
          ['/relatorios', 'Relatórios'],
          ['/financeiro', 'Financeiro'],
          ['/dashboard', 'Dashboard'],
        ]
      : user.role === 'TREINADOR'
        ? [
            ['/', 'Início'],
            ['/alunos', 'Alunos'],
            ['/turmas', 'Turmas'],
            ['/avaliacoes', 'Avaliações'],
            ['/calendario', 'Calendário'],
            ['/treinos/historico', 'Histórico'],
            ...((isActiveStaff
              ? ([
                  ['/biblioteca/exercicios', 'Biblioteca'],
                  ['/treinos', 'Treinos'],
                ] as [string, string][])
              : []) as [string, string][]),
            ['/comunicacoes', 'Comunicações'],
            ['/midia', 'Mídia'],
            ['/presenca', 'Presença'],
          ]
        : [
            ['/', 'Início'],
            ['/filhos', 'Meus filhos'],
            ['/meus-treinos', 'Meus treinos'],
            ['/calendario', 'Calendário'],
            ['/treinos/historico', 'Histórico'],
            ['/avisos', 'Avisos'],
            ['/notificacoes', 'Notificações'],
            ['/midia', 'Mídia'],
          ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__bar">
          <Link to="/" className="app-brand" title={`${PRODUCT_NAME} — ${user.tenantName}`}>
            <img src="/brand/logo-mark.svg" width={24} height={24} alt="" aria-hidden />
            <span className="app-brand__text">
              <span className="app-brand__product">{PRODUCT_NAME}</span>
              <span className="app-brand__sep" aria-hidden>
                ·
              </span>
              <span className="app-brand__tenant">{user.tenantName}</span>
            </span>
          </Link>
          {showStudentSwitcher ? (
            <label className="app-student-switcher" title="Aluno ativo">
              <span className="sr-only">Aluno ativo</span>
              <select
                value={activeStudentId ?? ''}
                onChange={(e) => setActiveStudent(e.target.value)}
                aria-label="Selecionar aluno ativo"
              >
                {user.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                    {!s.active ? ' (inativo)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <span className="app-user">
            {user.fullName} · {user.role}
          </span>
          <Link to="/preferencias" className="btn btn-ghost">
            Preferências
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Sair
          </button>
        </div>
        <nav className="app-nav" aria-label="Principal">
          {nav.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link--active' : 'nav-link'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
      <TermsAcceptModal />
    </div>
  );
}
