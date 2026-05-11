/**
 * Service do domínio Auth para chamadas que NÃO passam pelo `AuthProvider`
 * (essas continuam lá). Hoje cobre apenas o "encerrar todas as sessões"
 * disparado em `Preferencias.tsx`. Login/logout/refreshMe seguem no provider
 * por motivos de fluxo de estado.
 */
import { apiFetch } from '../lib/api';

export const authApi = {
  logoutAll(): Promise<void> {
    return apiFetch<void>('/auth/logout-all', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};
