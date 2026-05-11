import { useContext } from 'react';
import { AuthContext } from './auth-context-internal';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
