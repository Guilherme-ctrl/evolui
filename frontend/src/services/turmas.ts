/**
 * Service do domínio Turmas. No PR atual cobre apenas listagem (consumida em
 * `Calendar.tsx`). Demais operações (criação, troca de coach, etc.) virão na
 * refatoração do `Gestao.tsx`.
 */
import { apiFetch } from '../lib/api';
import type { TurmaLite } from './types';

export const turmasApi = {
  list(): Promise<TurmaLite[]> {
    return apiFetch<TurmaLite[]>('/turmas');
  },
};
