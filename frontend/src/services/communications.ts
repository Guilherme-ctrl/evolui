/**
 * Service do domínio Communications (avisos/inbox). Hoje cobre apenas leitura
 * do inbox do usuário corrente, consumida pela HomeGuardian.
 */
import { apiFetch } from '../lib/api';
import type { CommunicationInboxRow } from './types';

export const communicationsApi = {
  inbox(opts: { take?: number } = {}): Promise<CommunicationInboxRow[]> {
    const qs = new URLSearchParams();
    if (opts.take != null) qs.set('take', String(opts.take));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<CommunicationInboxRow[]>(`/communications/inbox${suffix}`);
  },
};
