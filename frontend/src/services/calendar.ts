/**
 * Camada de transporte para o domínio Calendário. Encapsula os endpoints de
 * eventos, dimensões de feedback do evento e relatórios. As páginas nunca
 * devem montar URLs do `/calendar/*` ou `/athlete/*calendar*` à mão.
 */
import { apiFetch } from '../lib/api';
import type { FeedbackDimension } from '../domain/feedback-dimensions';
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarFeedbackOverviewResponse,
  EventFeedbackReport,
  PendingFeedbackResponse,
} from './types';

export type CalendarListParams = {
  from?: Date | string;
  to?: Date | string;
  type?: CalendarEventType;
  take?: number;
};

function toIso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function appendIf(params: URLSearchParams, key: string, value: string | undefined) {
  if (value != null && value !== '') params.set(key, value);
}

export type CalendarUpsertPayload = {
  type: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  isWholeSchool: boolean;
  turmaIds?: string[];
};

export type FeedbackOverviewParams = {
  from?: Date | string;
  to?: Date | string;
  type?: string;
  cursor?: string;
  take?: number;
};

export type EventFeedbackDimsAction =
  | { type: 'inherit' }
  | { type: 'disable' }
  | { type: 'set'; dimensions: FeedbackDimension[] };

export type SubmitEventFeedbackPayload = {
  scores: Record<string, number>;
  notes?: string;
};

export const calendarApi = {
  list(params: CalendarListParams = {}): Promise<CalendarEvent[]> {
    const qs = new URLSearchParams();
    appendIf(qs, 'from', toIso(params.from));
    appendIf(qs, 'to', toIso(params.to));
    if (params.type) qs.set('type', params.type);
    if (params.take) qs.set('take', String(params.take));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<CalendarEvent[]>(`/calendar/events${suffix}`);
  },

  get(eventId: string): Promise<CalendarEvent> {
    return apiFetch<CalendarEvent>(`/calendar/events/${eventId}`);
  },

  create(payload: CalendarUpsertPayload): Promise<CalendarEvent> {
    return apiFetch<CalendarEvent>('/calendar/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(eventId: string, payload: CalendarUpsertPayload): Promise<CalendarEvent> {
    return apiFetch<CalendarEvent>(`/calendar/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  cancel(eventId: string, reason?: string): Promise<void> {
    return apiFetch<void>(`/calendar/events/${eventId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || undefined }),
    });
  },

  setEventFeedbackDimensions(
    eventId: string,
    action: EventFeedbackDimsAction,
  ): Promise<void> {
    const body =
      action.type === 'inherit'
        ? { unset: true }
        : action.type === 'disable'
          ? { dimensions: [] }
          : {
              dimensions: action.dimensions.map((d, i) => ({
                key: d.key,
                label: d.label.trim(),
                order: i,
              })),
            };
    return apiFetch<void>(`/calendar/events/${eventId}/feedback-dimensions`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  /** Relatório consolidado por evento — staff (ADMIN/TREINADOR). */
  getEventFeedbackReport(eventId: string): Promise<EventFeedbackReport> {
    return apiFetch<EventFeedbackReport>(`/calendar/events/${eventId}/feedback`);
  },

  feedbackOverview(
    params: FeedbackOverviewParams = {},
  ): Promise<CalendarFeedbackOverviewResponse> {
    const qs = new URLSearchParams();
    appendIf(qs, 'from', toIso(params.from));
    appendIf(qs, 'to', toIso(params.to));
    if (params.type) qs.set('type', params.type);
    if (params.cursor) qs.set('cursor', params.cursor);
    qs.set('take', String(params.take ?? 25));
    return apiFetch<CalendarFeedbackOverviewResponse>(
      `/calendar/events/feedback-overview?${qs.toString()}`,
    );
  },

  // -------- Endpoints do ATLETA (escopo /athlete/students/:sid/*) --------

  getAthleteEventFeedback(
    studentId: string,
    eventId: string,
  ): Promise<{ id: string; scores: Record<string, number>; notes: string | null } | null> {
    return apiFetch<{
      id: string;
      scores: Record<string, number>;
      notes: string | null;
    } | null>(
      `/athlete/students/${studentId}/calendar/events/${eventId}/feedback`,
    );
  },

  submitAthleteEventFeedback(
    studentId: string,
    eventId: string,
    payload: SubmitEventFeedbackPayload,
  ): Promise<void> {
    return apiFetch<void>(
      `/athlete/students/${studentId}/calendar/events/${eventId}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify({
          scores: payload.scores,
          notes: payload.notes?.trim() || undefined,
        }),
      },
    );
  },

  getPendingFeedback(
    studentId: string,
    opts: { limit?: number; days?: number } = {},
  ): Promise<PendingFeedbackResponse> {
    const qs = new URLSearchParams();
    if (opts.limit != null) qs.set('limit', String(opts.limit));
    if (opts.days != null) qs.set('days', String(opts.days));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<PendingFeedbackResponse>(
      `/athlete/students/${studentId}/calendar/pending-feedback${suffix}`,
    );
  },
};
