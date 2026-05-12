import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { HomeAdmin } from './home/HomeAdmin';
import { HomeCoach } from './home/HomeCoach';
import { HomeGuardian } from './home/HomeGuardian';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="page stack">
      <header
        className={`page-header${user?.role === 'ADMIN' ? ' row' : ''}`}
        style={
          user?.role === 'ADMIN'
            ? {
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
              }
            : undefined
        }
      >
        <div className="page-header__text">
          <h1 className="page-header__title">Olá, {user?.fullName} 👋</h1>
          <p className="page-header__subtitle">
            {user?.role === 'ADMIN'
              ? 'Visão geral da escolinha e próximos passos.'
              : user?.role === 'TREINADOR'
                ? 'Treinos de hoje e acesso rápido à presença.'
                : 'Avisos, notificações e agenda da família em um só lugar.'}
          </p>
        </div>
        {user?.role === 'ADMIN' ? (
          <Link to="/preferencias" className="btn btn-secondary">
            Personalizar dashboard
          </Link>
        ) : null}
      </header>

      {user?.role === 'ADMIN' ? <HomeAdmin /> : null}
      {user?.role === 'TREINADOR' ? <HomeCoach /> : null}
      {user?.role === 'ATLETA' ? <HomeGuardian /> : null}
    </div>
  );
}
