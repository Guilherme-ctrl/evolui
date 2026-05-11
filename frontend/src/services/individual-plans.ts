/**
 * Service do domínio IndividualPlans. No PR atual cobre só o que a Home do
 * ATLETA consome (lista por filho). O editor (`PlanoEditor.tsx`) será migrado
 * em PR separado.
 */
import { apiFetch } from '../lib/api';

export type IndividualPlanListItem = {
  id: string;
  status: string;
  title?: string;
};

export const individualPlansApi = {
  listForGuardian(studentId: string): Promise<IndividualPlanListItem[]> {
    return apiFetch<IndividualPlanListItem[]>(
      `/guardian/children/${studentId}/individual-plans`,
    );
  },
};
