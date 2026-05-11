import { createContext } from 'react';
import type { LoginResponse } from '../lib/api';

export type AuthState = LoginResponse['user'] | null;

export type AuthContextValue = {
  user: AuthState;
  loading: boolean;
  login: (tenantSlug: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  /** ID do aluno ativo na sessão (somente faz sentido para role=ATLETA). */
  activeStudentId: string | null;
  setActiveStudent: (studentId: string) => void;
  /** Marca o aceite de termos no backend e atualiza o user em memória. */
  acceptTerms: (kinship: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
