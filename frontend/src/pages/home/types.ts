export type CalEventApi = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  status: string;
  isWholeSchool: boolean;
  turmas: Array<{ turmaId: string; turma: { id: string; name: string } }>;
};

export type DashboardHomePayload = {
  students?: { active: number; inactive?: number };
  finance?: { delinquentCharges?: number; delinquentAmountCents?: number };
  turmas?: Array<{
    turmaId: string;
    name: string;
    enrolled: number;
    capacity: number;
    pct: number;
  }>;
};
