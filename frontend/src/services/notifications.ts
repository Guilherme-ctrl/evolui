/**
 * Service do domínio Notifications + preferências.
 */
import { apiFetch } from '../lib/api';
import type {
  NotificationPreferenceRow,
  NotificationRow,
} from './types';

export type SavePreferencesPayload = {
  preferences: Array<{ category: string; inAppEnabled: boolean }>;
};

export const notificationsApi = {
  list(opts: { take?: number } = {}): Promise<NotificationRow[]> {
    const qs = new URLSearchParams();
    if (opts.take != null) qs.set('take', String(opts.take));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<NotificationRow[]>(`/notifications${suffix}`);
  },

  preferences(): Promise<NotificationPreferenceRow[]> {
    return apiFetch<NotificationPreferenceRow[]>('/notifications/preferences');
  },

  savePreferences(
    payload: SavePreferencesPayload,
  ): Promise<NotificationPreferenceRow[]> {
    return apiFetch<NotificationPreferenceRow[]>('/notifications/preferences', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
