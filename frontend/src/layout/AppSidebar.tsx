import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  Cog,
  MessageSquare,
  DollarSign,
  BarChart2,
  ClipboardCheck,
  BookOpen,
} from 'lucide-react';
import type { UserRole } from './nav-config';
import { navGroupsForRole } from './nav-config';

const PRODUCT_NAME = 'Evolui';

const GROUP_ICONS: Record<string, ReactNode> = {
  Principal:    <Home size={15} strokeWidth={2} aria-hidden />,
  Pessoas:      <Users size={15} strokeWidth={2} aria-hidden />,
  Operação:     <ClipboardCheck size={15} strokeWidth={2} aria-hidden />,
  Gestão:       <Cog size={15} strokeWidth={2} aria-hidden />,
  Comunicação:  <MessageSquare size={15} strokeWidth={2} aria-hidden />,
  Financeiro:   <DollarSign size={15} strokeWidth={2} aria-hidden />,
  Relatórios:   <BarChart2 size={15} strokeWidth={2} aria-hidden />,
  Família:      <BookOpen size={15} strokeWidth={2} aria-hidden />,
};

type Props = {
  role: UserRole;
  isActiveStaff: boolean;
  /** Mobile drawer */
  mobileOpen: boolean;
  /** Chamado ao fechar drawer (backdrop ou após navegar). */
  onCloseMobile?: () => void;
  onLogout: () => void;
};

export function AppSidebar({
  role,
  isActiveStaff,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: Props) {
  const groups = navGroupsForRole(role, isActiveStaff);

  const onNav = () => {
    onCloseMobile?.();
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="app-sidebar__backdrop"
          aria-label="Fechar menu"
          onClick={() => onCloseMobile?.()}
        />
      ) : null}
      <aside
        id="app-sidebar-nav"
        className={`app-sidebar${mobileOpen ? ' app-sidebar--open' : ''}`}
        aria-label="Navegação principal"
      >
        <div className="app-sidebar__brand">
          <Link
            to="/"
            className="app-sidebar__brand-link"
            title={PRODUCT_NAME}
            onClick={onNav}
          >
            <img src="/brand/logo-mark.svg" width={28} height={28} alt="" aria-hidden />
            <span className="app-sidebar__brand-text">{PRODUCT_NAME}</span>
          </Link>
        </div>
        <nav className="app-sidebar__scroll" aria-label="Seções">
          {groups.map((group) => (
            <div key={group.title} className="app-sidebar__group">
              <h2 className="app-sidebar__group-title">
                {GROUP_ICONS[group.title] ?? null}
                {group.title}
              </h2>
              <ul className="app-sidebar__list plain">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      className={({ isActive }) =>
                        isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
                      }
                      onClick={onNav}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="app-sidebar__footer">
          <Link
            to="/preferencias"
            className="sidebar-link sidebar-link--footer"
            onClick={onNav}
          >
            Preferências
          </Link>
          <button
            type="button"
            className="sidebar-link sidebar-link--footer sidebar-link--logout"
            onClick={() => {
              onNav();
              onLogout();
            }}
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
