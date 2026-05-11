/**
 * Regras de autorização do lado do cliente. **Não substituem** os guards do
 * backend (esses são autoritativos); servem apenas para esconder/mostrar
 * controles e simplificar JSX espalhado pelas páginas.
 *
 * Tipo `AuthLikeUser` é intencionalmente estrutural para casar com `useAuth()`
 * sem criar acoplamento circular com o módulo de auth.
 */

export type UserRole = 'ADMIN' | 'TREINADOR' | 'ATLETA';

export type AuthLikeUser = {
  role: UserRole;
  staffProfile?: { active: boolean } | null;
} | null;

export function isAdmin(user: AuthLikeUser): boolean {
  return user?.role === 'ADMIN';
}

export function isAthlete(user: AuthLikeUser): boolean {
  return user?.role === 'ATLETA';
}

/** TREINADOR só conta como "ativo" se o `StaffProfile` está active. */
export function isActiveCoach(user: AuthLikeUser): boolean {
  return user?.role === 'TREINADOR' && user.staffProfile?.active === true;
}

/** Qualquer membro do staff com permissão operativa (admin + coach ativo). */
export function isStaff(user: AuthLikeUser): boolean {
  return isAdmin(user) || isActiveCoach(user);
}

/** Pode ler relatórios agregados (médias por evento/treino). */
export function canSeeFeedbackReport(user: AuthLikeUser): boolean {
  return isAdmin(user) || user?.role === 'TREINADOR';
}

/** Pode configurar dimensões padrão do tenant. */
export function canConfigureTenantDefaults(user: AuthLikeUser): boolean {
  return isAdmin(user);
}
