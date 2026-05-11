/**
 * Service do domínio Students. Cobre apenas os endpoints já consumidos pelas
 * páginas migradas no PR atual; os de criação/edição podem ser adicionados aos
 * poucos, à medida que `Gestao.tsx` for refatorado.
 */
import { apiFetch } from '../lib/api';
import type { StudentLite } from './types';

export const studentsApi = {
  /**
   * Lista alunos visíveis ao usuário. Para ATLETA o backend devolve apenas os
   * dependentes da conta. Para staff devolve o tenant inteiro (paginação
   * controlada pelo backend via `take`).
   */
  list(opts: { take?: number } = {}): Promise<StudentLite[]> {
    const qs = new URLSearchParams();
    if (opts.take != null) qs.set('take', String(opts.take));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<StudentLite[]>(`/students${suffix}`);
  },
};
