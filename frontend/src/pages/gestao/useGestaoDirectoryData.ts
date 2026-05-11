import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { runDeferredEffect } from '../../lib/run-deferred';

export type GuardianFull = {
  id: string;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  kinship: string | null;
  address: string | null;
  cpf: string | null;
};

export type Coach = { id: string; fullName: string; email: string };

export type TurmaRow = {
  id: string;
  name: string;
  capacity: number;
  categoryLabel?: string | null;
  ageRangeText?: string | null;
  weekDaysText?: string | null;
  scheduleText?: string | null;
  location?: string | null;
  coach: Coach;
  _count?: { enrollments: number };
};

export type StudentListItem = {
  id: string;
  fullName: string;
  active: boolean;
  birthDate?: string | null;
  categoryLabel?: string | null;
  documentType?: 'CPF' | 'RG' | 'RNE' | 'OUTRO' | null;
  documentNumber?: string | null;
  preferredPosition?: string | null;
  emergencyContact?: string | null;
  medicalNotes?: string | null;
  physicalRestrictions?: string | null;
  accountUserId?: string;
  accountUser?: { id: string; fullName: string; email: string } | null;
  guardians?: {
    guardianId: string;
    isPrimaryForBilling: boolean;
    guardian: GuardianFull;
  }[];
  _count?: { enrollments: number };
};

/**
 * Aviso/UX: aluno ativo sem responsável de contato (Guardian) cadastrado.
 * Não bloqueia matrícula (todo aluno tem conta-atleta), mas aponta lacuna
 * de canal externo (cobrança/WhatsApp).
 */
export function studentNeedsGuardianLink(s: StudentListItem): boolean {
  if (!s.active) return false;
  return (s.guardians?.length ?? 0) === 0;
}

export function useGestaoDirectoryData() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [guardians, setGuardians] = useState<GuardianFull[]>([]);
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);

  const reloadAll = useCallback(async () => {
    setDirectoryLoading(true);
    try {
      const [s, g, t, c] = await Promise.all([
        apiFetch<StudentListItem[]>('/students').catch(() => [] as StudentListItem[]),
        apiFetch<GuardianFull[]>('/guardians').catch(() => [] as GuardianFull[]),
        apiFetch<TurmaRow[]>('/turmas').catch(() => [] as TurmaRow[]),
        apiFetch<Coach[]>('/auth/coaches').catch(() => [] as Coach[]),
      ]);
      setStudents(s);
      setGuardians(g);
      setTurmas(t);
      setCoaches(c);
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    return runDeferredEffect(() => {
      void reloadAll().catch(() => null);
    });
  }, [reloadAll]);

  return { students, guardians, turmas, coaches, directoryLoading, reloadAll };
}
