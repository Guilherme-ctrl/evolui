/**
 * Payload de `GET /dashboard/home` (ADMIN) e tipos correlatos da home.
 */

export type DashboardHomeEventItem = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  status: string;
  isWholeSchool: boolean;
  location: string | null;
  coachSubtitle: string | null;
  turmas: Array<{ turmaId: string; turma: { id: string; name: string } }>;
};

export type DashboardHomeResponse = {
  generatedAt: string;
  students: { active: number; inactive: number };
  professionalsActive: number;
  finance: {
    delinquentCharges: number;
    delinquentAmountCents: number;
    topStudents: Array<{
      studentId: string;
      fullName: string;
      charges: number;
      totalCents: number;
      oldestDueDate: string;
      daysOverdue: number;
    }>;
  };
  todayEvents: {
    total: number;
    byType: Record<string, number>;
    items: DashboardHomeEventItem[];
  };
  tomorrowEvents: {
    total: number;
    items: DashboardHomeEventItem[];
  };
  physicalFeedbackWeek: {
    eligible: number;
    withFeedback: number;
    pct: number | null;
    windowFrom: string;
    windowTo: string;
  };
  evaluations: {
    periodFrom: string;
    periodTo: string;
    activeStudents: number;
    distinctStudentsEvaluated: number;
    totalEvaluations: number;
    percentage: number | null;
  };
};

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
