/**
 * Tipos do domínio compartilhados pelos services e consumidos pelas páginas.
 * Mantemos aqui apenas os shapes que cruzam mais de um arquivo; tipos
 * estritamente locais de uma página continuam onde estão.
 */
import type { FeedbackDimension } from '../domain/feedback-dimensions';

export type CalendarEventStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | string;

export type CalendarEventType =
  | 'TREINO'
  | 'JOGO'
  | 'AMISTOSO'
  | 'EVENTO'
  | 'CAMPEONATO'
  | 'AVALIACAO'
  | 'REUNIAO'
  | string;

export const CALENDAR_EVENT_TYPES = [
  'TREINO',
  'JOGO',
  'AMISTOSO',
  'EVENTO',
  'CAMPEONATO',
  'AVALIACAO',
  'REUNIAO',
] as const;

export type CalendarEventTurmaRef = {
  turmaId: string;
  turma: { id?: string; name: string };
};

/** Shape "completo" devolvido por `/calendar/events` e detalhe. */
export type CalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  status: CalendarEventStatus;
  location: string | null;
  isWholeSchool: boolean;
  turmas: CalendarEventTurmaRef[];
  feedbackDimensions: FeedbackDimension[] | null;
  effectiveFeedbackDimensions: FeedbackDimension[];
};

export type CalendarEventAverage = {
  key: string;
  label: string;
  count: number;
  average: number | null;
};

export type CalendarEventStaffOverview = CalendarEvent & {
  feedbackCount: number;
  averages: CalendarEventAverage[];
};

export type AthleteEventFeedback = {
  id: string;
  scores: Record<string, number>;
  notes: string | null;
  updatedAt: string;
};

export type CalendarEventAthleteOverview = CalendarEvent & {
  myFeedback: AthleteEventFeedback | null;
};

export type CalendarFeedbackOverviewResponse =
  | { events: CalendarEventStaffOverview[]; nextCursor: string | null }
  | { events: CalendarEventAthleteOverview[]; nextCursor: string | null };

export type PendingFeedbackResponse = {
  studentId: string;
  windowDays: number;
  events: CalendarEventAthleteOverview[];
};

export type EventFeedbackReportItem = {
  id: string;
  scores: Record<string, number>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  student: { id: string; fullName: string; active: boolean };
  submittedByUser: { id: string; fullName: string; email: string };
};

export type EventFeedbackReport = {
  eventId: string;
  effectiveFeedbackDimensions: FeedbackDimension[];
  averages: CalendarEventAverage[];
  feedbacks: EventFeedbackReportItem[];
};

export type AthleteWorkoutExercise = {
  id: string;
  order: number;
  nameSnapshot: string;
  descriptionSnapshot: string | null;
  videoUrlSnapshot: string | null;
  sets: number | null;
  repetitions: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type AthleteWorkoutAssignment = {
  id: string;
  scope: 'TURMA' | 'STUDENT';
  notes: string | null;
  createdAt: string;
  turma: { id: string; name: string } | null;
  workout: {
    id: string;
    name: string;
    description: string | null;
    notes: string | null;
    exercises: AthleteWorkoutExercise[];
    createdByUser: { id: string; fullName: string };
    ownerStaff: {
      id: string;
      professionalType: string;
      user: { id: string; fullName: string };
    } | null;
    feedbackDimensions: FeedbackDimension[];
  };
};

export type WorkoutTodayFeedback = {
  id: string;
  scores: Record<string, number>;
  notes: string | null;
  submittedDate: string;
} | null;

export type StudentLite = {
  id: string;
  fullName: string;
  active?: boolean;
};

export type TurmaLite = {
  id: string;
  name: string;
};

export type FinancialCharge = {
  id: string;
  amountCents: number;
  dueDate: string;
  status: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
};

export type NotificationPreferenceRow = {
  category: string;
  label: string;
  description: string;
  requiredInApp: boolean;
  inAppEnabled: boolean;
};

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type CommunicationInboxRow = {
  id: string;
  title: string;
  recipients: { readAt: string | null }[];
};
