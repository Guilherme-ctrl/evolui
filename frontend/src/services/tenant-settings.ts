/**
 * Service do domínio Tenant Settings. Hoje cobre apenas as dimensões padrão de
 * feedback físico (`/tenant/me/feedback-dimensions`).
 */
import { apiFetch } from '../lib/api';
import type { FeedbackDimension } from '../domain/feedback-dimensions';

export const tenantSettingsApi = {
  getFeedbackDimensions(): Promise<{ dimensions: FeedbackDimension[] }> {
    return apiFetch<{ dimensions: FeedbackDimension[] }>(
      '/tenant/me/feedback-dimensions',
    );
  },

  setFeedbackDimensions(
    dimensions: FeedbackDimension[],
  ): Promise<{ dimensions: FeedbackDimension[] }> {
    const payload = dimensions.map((d, i) => ({
      key: d.key,
      label: d.label.trim(),
      order: i,
    }));
    return apiFetch<{ dimensions: FeedbackDimension[] }>(
      '/tenant/me/feedback-dimensions',
      { method: 'PUT', body: JSON.stringify({ dimensions: payload }) },
    );
  },
};
