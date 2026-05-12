import { NavLink } from 'react-router-dom';
import { Home, Users, ClipboardCheck, MessageSquare } from 'lucide-react';
import type { UserRole } from './nav-config';

type BottomTab = {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
};

const COACH_TABS: BottomTab[] = [
  { to: '/', label: 'Hoje', icon: <Home size={22} strokeWidth={2} aria-hidden />, end: true },
  { to: '/presenca', label: 'Presença', icon: <ClipboardCheck size={22} strokeWidth={2} aria-hidden /> },
  { to: '/alunos', label: 'Alunos', icon: <Users size={22} strokeWidth={2} aria-hidden /> },
  { to: '/comunicacoes', label: 'Mensagens', icon: <MessageSquare size={22} strokeWidth={2} aria-hidden /> },
];

type Props = {
  role: UserRole;
};

export function AppBottomNav({ role }: Props) {
  if (role !== 'TREINADOR') return null;

  return (
    <nav className="app-bottom-nav" aria-label="Navegação rápida">
      {COACH_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end ?? false}
          className={({ isActive }) =>
            `app-bottom-nav__tab${isActive ? ' app-bottom-nav__tab--active' : ''}`
          }
          aria-label={tab.label}
        >
          {tab.icon}
          <span className="app-bottom-nav__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
