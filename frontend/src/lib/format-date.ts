/**
 * Helpers de formatação **pt-BR** consistentes em todo o frontend.
 *
 * Regras do produto:
 * - Datas sempre em `dd/MM/yyyy`.
 * - Horários sempre em 24h (`HH:mm`) — `hourCycle: 'h23'` evita que navegadores
 *   com locale em inglês exibam AM/PM mesmo recebendo o argumento 'pt-BR'.
 *
 * Sempre que precisar exibir data ou hora, use estes helpers (não chame
 * `toLocale*` direto na view). Para inputs `<input type="time">`, use
 * também `lang="pt-BR"` no próprio input — é o sinal que Chrome/Safari
 * usam para escolher 12h vs 24h.
 */

function asDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function capFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1);
}

/** Exibição pt-BR: `dd/MM/yyyy`. */
export function formatDateBR(value: string | Date | null | undefined): string {
  const d = asDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Exibição pt-BR: `dd/MM/yyyy HH:mm` (24h). */
export function formatDateTimeBR(value: string | Date | null | undefined): string {
  const d = asDate(value);
  if (!d) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Exibição pt-BR: `HH:mm` (24h). */
export function formatTimeBR(value: string | Date | null | undefined): string {
  const d = asDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Exibição pt-BR: "Maio de 2026" (primeira letra maiúscula). */
export function formatMonthYearBR(value: string | Date | null | undefined): string {
  const d = asDate(value);
  if (!d) return '—';
  return capFirst(
    d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );
}

/** Exibição pt-BR: "Quarta-feira, 13 de maio" (primeira letra maiúscula). */
export function formatWeekdayLongBR(
  value: string | Date | null | undefined,
): string {
  const d = asDate(value);
  if (!d) return '—';
  return capFirst(
    d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );
}

/**
 * Converte um dayKey local no formato `YYYY-MM-DD` para exibição `dd/MM/yyyy`,
 * sem cair em armadilhas de timezone do `new Date('YYYY-MM-DD')` (que é tratado
 * como meia-noite UTC e pode "voltar um dia" em fusos negativos).
 */
export function formatYmdToBR(dayKey: string): string {
  const [y, m, d] = dayKey.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}
