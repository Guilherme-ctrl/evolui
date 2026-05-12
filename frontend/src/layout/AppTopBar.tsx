import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CircleHelp,
  Mail,
  Menu,
  Search,
  ChevronDown,
  LogOut,
  Settings,
} from 'lucide-react';
import { notificationsApi } from '../services/notifications';
import type { UserRole } from './nav-config';

function roleLabel(role: UserRole): string {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'TREINADOR') return 'Treinador';
  return 'Responsável';
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type AppTopBarProps = {
  tenantName: string;
  fullName: string;
  role: UserRole;
  showStaffSearch: boolean;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  /** Switcher de aluno (conta-atleta); opcional. */
  studentSwitcher?: ReactNode;
};

export function AppTopBar({
  tenantName,
  fullName,
  role,
  showStaffSearch,
  onOpenSearch,
  onToggleSidebar,
  onLogout,
  studentSwitcher,
}: AppTopBarProps) {
  const [unread, setUnread] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await notificationsApi.list({ take: 80 });
        if (cancelled) return;
        const n = rows.filter((r) => r.readAt == null).length;
        setUnread(n);
      } catch {
        if (!cancelled) setUnread(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const mailTo = role === 'ATLETA' ? '/avisos' : '/comunicacoes';

  const searchTitle = useMemo(
    () =>
      showStaffSearch
        ? 'Buscar atletas, turmas, treinos… (⌘K)'
        : 'Atalhos e busca (⌘K)',
    [showStaffSearch],
  );

  return (
    <header className="app-topbar">
      <div className="app-topbar__row">
        <button
          type="button"
          className="app-topbar__icon-btn app-topbar__menu-btn"
          aria-label="Abrir menu de navegação"
          onClick={onToggleSidebar}
        >
          <Menu size={22} strokeWidth={2} aria-hidden />
        </button>

        <div className="app-topbar__tenant" title={tenantName}>
          <span className="app-topbar__tenant-label">{tenantName}</span>
        </div>

        {studentSwitcher ? (
          <div className="app-topbar__switcher">{studentSwitcher}</div>
        ) : null}

        <div className="app-topbar__search-wrap">
          <button
            type="button"
            className="app-topbar__search"
            onClick={onOpenSearch}
            title={searchTitle}
          >
            <Search
              size={18}
              strokeWidth={2}
              className="app-topbar__search-icon"
              aria-hidden
            />
            <span className="app-topbar__search-placeholder">{searchTitle}</span>
            <kbd className="app-topbar__kbd">⌘K</kbd>
          </button>
        </div>

        <div className="app-topbar__actions">
          <Link
            to="/notificacoes"
            className="app-topbar__icon-link"
            title="Notificações"
            aria-label="Notificações"
          >
            <Bell size={22} strokeWidth={2} aria-hidden />
            {unread != null && unread > 0 ? (
              <span className="app-topbar__badge">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>
          <Link
            to={mailTo}
            className="app-topbar__icon-link"
            title={role === 'ATLETA' ? 'Avisos' : 'Comunicações'}
            aria-label={role === 'ATLETA' ? 'Avisos' : 'Comunicações'}
          >
            <Mail size={22} strokeWidth={2} aria-hidden />
          </Link>
          <span
            className="app-topbar__icon-muted"
            title="Central de ajuda em breve"
            role="img"
            aria-label="Ajuda em breve"
          >
            <CircleHelp size={22} strokeWidth={2} />
          </span>

          <div className="app-topbar__profile-wrap" ref={menuRef}>
            <button
              type="button"
              className="app-topbar__profile"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="app-topbar__avatar" aria-hidden>
                {initials(fullName)}
              </span>
              <span className="app-topbar__profile-text">
                <span className="app-topbar__profile-name">{fullName}</span>
                <span className="app-topbar__profile-role">{roleLabel(role)}</span>
              </span>
              <ChevronDown size={18} strokeWidth={2} aria-hidden className="muted" />
            </button>
            {menuOpen ? (
              <div className="app-topbar__dropdown" role="menu">
                <Link
                  to="/preferencias"
                  className="app-topbar__dropdown-item"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings size={18} aria-hidden />
                  Preferências
                </Link>
                <button
                  type="button"
                  className="app-topbar__dropdown-item app-topbar__dropdown-item--danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={18} aria-hidden />
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
