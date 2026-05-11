import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiFetch,
  formatApiErrorBody,
  getActiveStudentId,
  getToken,
  setActiveStudentId as persistActiveStudentId,
  setToken,
  type LoginResponse,
} from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { AuthContext, type AuthState } from './auth-context-internal';

/**
 * Para uma conta ATLETA, define o aluno ativo inicial:
 * - se houver um persistido e ele ainda existe na lista → mantém;
 * - senão, escolhe o primeiro aluno ativo (fallback: o primeiro).
 */
function pickInitialActiveStudent(
  user: NonNullable<AuthState>,
  fromStorage: string | null,
): string | null {
  if (user.role !== 'ATLETA') return null;
  if (!user.students.length) return null;
  if (fromStorage && user.students.some((s) => s.id === fromStorage)) {
    return fromStorage;
  }
  return (user.students.find((s) => s.active) ?? user.students[0]).id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState>(null);
  const [loading, setLoading] = useState(true);
  const [activeStudentId, setActiveStudentIdState] = useState<string | null>(null);

  const logout = useCallback(() => {
    if (user?.id) persistActiveStudentId(user.id, null);
    setToken(null);
    setUser(null);
    setActiveStudentIdState(null);
  }, [user?.id]);

  const applyUser = useCallback((u: NonNullable<AuthState> | null) => {
    if (!u) {
      setUser(null);
      setActiveStudentIdState(null);
      return;
    }
    const stored = getActiveStudentId(u.id);
    const next = pickInitialActiveStudent(u, stored);
    if (next) persistActiveStudentId(u.id, next);
    setUser(u);
    setActiveStudentIdState(next);
  }, []);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      applyUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await apiFetch<LoginResponse['user']>('/auth/me');
      applyUser(u);
    } catch {
      applyUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => {
    return runDeferredEffect(() => {
      void refreshMe();
    });
  }, [refreshMe]);

  const login = useCallback(
    async (tenantSlug: string, email: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, email, password }),
      });
      if (!res.ok) {
        let detail = '';
        try {
          detail = await res.text();
        } catch {
          /* ignore */
        }
        const fromApi = formatApiErrorBody(detail, '');
        if (fromApi) {
          throw new Error(fromApi);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error('Credenciais inválidas ou escolinha incorreta.');
        }
        if (res.status >= 500 || res.status === 502 || res.status === 503) {
          throw new Error(
            'A API não respondeu direito (erro no servidor ou proxy). Pare processos na porta 3333 e rode de novo: npm run dev na raiz do projeto.',
          );
        }
        throw new Error(detail?.slice(0, 200) || `Falha no login (HTTP ${res.status}).`);
      }
      const body = (await res.json()) as LoginResponse;
      setToken(body.accessToken);
      applyUser(body.user);
    },
    [applyUser],
  );

  const setActiveStudent = useCallback(
    (studentId: string) => {
      if (!user) return;
      const exists = user.students.some((s) => s.id === studentId);
      if (!exists) return;
      persistActiveStudentId(user.id, studentId);
      setActiveStudentIdState(studentId);
    },
    [user],
  );

  const acceptTerms = useCallback(
    async (kinship: string) => {
      const result = await apiFetch<{
        termsAcceptedAt: string | null;
        termsKinship: string | null;
      }>('/auth/accept-terms', {
        method: 'POST',
        body: JSON.stringify({ kinship, acceptedTerms: true }),
      });
      setUser((prev) =>
        prev
          ? {
              ...prev,
              termsAcceptedAt: result.termsAcceptedAt,
              termsKinship: result.termsKinship,
            }
          : prev,
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshMe,
      activeStudentId,
      setActiveStudent,
      acceptTerms,
    }),
    [user, loading, login, logout, refreshMe, activeStudentId, setActiveStudent, acceptTerms],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
