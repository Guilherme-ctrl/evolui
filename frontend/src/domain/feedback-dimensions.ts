/**
 * Tipos e regras puras (sem React, sem fetch) para dimensões de feedback físico.
 *
 * A mesma forma é usada em três contextos:
 * - Tenant default (`Tenant.defaultFeedbackDimensions`)
 * - Override por evento de calendário (`CalendarEvent.feedbackDimensions`)
 * - Override por treino estruturado (`Workout.feedbackDimensions`)
 *
 * O backend valida via `class-validator`; replicamos aqui só o suficiente para
 * dar UX rápida (mensagens em pt-BR antes do POST/PATCH).
 */

export type FeedbackDimension = {
  key: string;
  label: string;
  order: number;
};

/**
 * Estado do override de um evento em relação ao tenant default.
 * - `inherit` → `feedbackDimensions === null`
 * - `disabled` → `feedbackDimensions === []`
 * - `custom` → `feedbackDimensions === [...]`
 */
export type OverrideState = 'inherit' | 'disabled' | 'custom';

export function describeOverrideState(
  override: FeedbackDimension[] | null | undefined,
): OverrideState {
  if (override === null || override === undefined) return 'inherit';
  if (override.length === 0) return 'disabled';
  return 'custom';
}

/**
 * Normaliza para garantir `order` sequencial 0..n-1 (o backend recebe `order`
 * mas reordena pela posição do array — o frontend só precisa não enviar
 * inconsistências).
 */
export function normalizeDimensions(
  items: FeedbackDimension[],
): FeedbackDimension[] {
  return items.map((d, i) => ({ ...d, order: i }));
}

/**
 * Valida o array do editor antes de enviar ao backend. Retorna mensagem de
 * erro (string) ou `null` se tudo bem. Mantém regras espelhadas com o
 * `class-validator` do backend: key `[a-z][a-z0-9_]{1,30}`, label ≥ 2 chars,
 * sem duplicados.
 */
export function validateDimensions(
  items: FeedbackDimension[],
): string | null {
  const seen = new Set<string>();
  for (const d of items) {
    if (!d.label.trim() || d.label.trim().length < 2) {
      return 'Cada dimensão precisa de um nome com ao menos 2 letras.';
    }
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(d.key)) {
      return `Identificador "${d.key}" inválido. Use letras minúsculas e underscore (ex: desgaste_fisico).`;
    }
    if (seen.has(d.key)) {
      return `Identificador duplicado: ${d.key}.`;
    }
    seen.add(d.key);
  }
  return null;
}

/** Sanitiza a `key` enquanto o usuário digita (sem regex no JSX). */
export function sanitizeDimensionKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}
