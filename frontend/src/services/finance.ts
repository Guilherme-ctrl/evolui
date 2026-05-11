/**
 * Service do domínio Finance. No PR atual cobre apenas o extrato por aluno,
 * consumido pela HomeGuardian; as operações de cobranças, baixa em lote,
 * reversão e CSV serão portadas quando `Finance.tsx` for dividido.
 */
import { apiFetch } from '../lib/api';
import type { FinancialCharge } from './types';

export const financeApi = {
  extratoByStudent(studentId: string): Promise<FinancialCharge[]> {
    return apiFetch<FinancialCharge[]>(`/finance/students/${studentId}/extrato`);
  },
};
