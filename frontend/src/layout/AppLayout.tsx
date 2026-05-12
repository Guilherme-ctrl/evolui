import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { TermsAcceptModal } from '../components/TermsAcceptModal';
import { AppBottomNav } from './AppBottomNav';
import { AppSidebar } from './AppSidebar';
import { AppTopBar } from './AppTopBar';
import type { UserRole } from './nav-config';

const PRODUCT_NAME = 'Evolui';

export default function AppLayout() {
  const { user, loading, logout, activeStudentId, setActiveStudent } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user) document.title = `${PRODUCT_NAME} — ${user.tenantName}`;
  }, [user]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  const role = user.role as UserRole;
  const showStaffSearch = role === 'ADMIN' || role === 'TREINADOR';

  const studentSwitcher = showStudentSwitcher ? (
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
  ) : null;

  return (
    <div className="app-shell">
      <AppSidebar
        role={role}
        isActiveStaff={isActiveStaff}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        onLogout={() => logout()}
      />
      <div className="app-shell__main">
        <AppTopBar
          tenantName={user.tenantName}
          fullName={user.fullName}
          role={role}
          showStaffSearch={showStaffSearch}
          onOpenSearch={openSearch}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onLogout={() => logout()}
          studentSwitcher={studentSwitcher}
        />
        <Outlet />
      </div>
      <AppBottomNav role={role} />
      <GlobalSearchModal open={searchOpen} onClose={closeSearch} role={role} />
      <TermsAcceptModal />
    </div>
  );
}
