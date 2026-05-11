/**
 * Helpers de grade do calendário.
 *
 * Convenções:
 * - Semana começa na **segunda-feira** (padrão brasileiro adotado no produto).
 * - `dayKey` é uma string local `YYYY-MM-DD` — usar este formato sempre que
 *   precisar comparar dias sem cair em armadilhas de timezone.
 * - Datas devolvidas pelos helpers são **sempre locais** (horário do navegador),
 *   nunca UTC. O backend envia ISO com offset; convertemos via `new Date(iso)`
 *   no consumo.
 */

/** Segunda como primeiro dia da semana — grade 6×7 do mês visível. */
export function getCalendarGrid(monthAnchor: Date): Date[] {
  const y = monthAnchor.getFullYear();
  const m = monthAnchor.getMonth();
  const first = new Date(y, m, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(y, m, 1 - mondayOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function sameMonth(d: Date, anchor: Date): boolean {
  return d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth();
}

export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDatetimeLocal(s: string): Date {
  return new Date(s);
}

/** Combina dia da grade (YYYY-MM-DD) com horário do input type="time" (HH:mm). */
export function combineDayKeyAndTime(dayKey: string, timeHHmm: string): Date {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const [hhStr, mmStr] = timeHHmm.split(':');
  const hh = Number(hhStr ?? 0);
  const mm = Number(mmStr ?? 0);
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

export function toTimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Soma `n` dias a uma data, devolvendo uma nova `Date` local. */
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Soma `n` semanas (7×n dias). */
export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

/** Devolve a segunda-feira da semana corrente da data. */
export function getWeekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7; // Mon=0 ... Sun=6
  x.setDate(x.getDate() - offset);
  return x;
}

/** Grade da semana: 7 datas (Seg → Dom) a partir da segunda-feira da data. */
export function getWeekGrid(anchor: Date): Date[] {
  const start = getWeekStart(anchor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  return days;
}

/** Datas com horas 00:00 / 23:59:59.999 — úteis para montar ranges do backend. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Lista de horas inteiras [from..to] para o eixo Y das visões Semana/Dia. */
export function getHoursAxis(fromHour: number, toHour: number): number[] {
  const arr: number[] = [];
  for (let h = fromHour; h <= toHour; h++) arr.push(h);
  return arr;
}

/**
 * Algoritmo de "lanes" para evitar sobreposição visual de eventos no mesmo dia.
 *
 * Recebe uma lista de itens com `startsAt`/`endsAt` (Date) e devolve, para
 * cada item original, o índice da coluna interna (`lane`) e o total de
 * colunas concorrentes naquele grupo (`groupSize`). A view usa esses números
 * para calcular `left` e `width` dos blocos de evento.
 *
 * Estratégia simples e estável:
 *  - Ordena por início (e tie-break por fim).
 *  - Para cada item, pega a primeira lane livre (cuja último evento já
 *    terminou antes do início do atual). Se nenhuma está livre, cria nova.
 *  - Eventos que se "tocam" no tempo formam um cluster; todos do cluster
 *    compartilham o mesmo `groupSize` (= número de lanes usadas no cluster).
 */
export type LaidOut<T> = T & { lane: number; groupSize: number };

export function layoutEventsInLanes<T extends { startsAt: Date; endsAt: Date }>(
  items: T[],
): LaidOut<T>[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    const da = a.startsAt.getTime() - b.startsAt.getTime();
    if (da !== 0) return da;
    return a.endsAt.getTime() - b.endsAt.getTime();
  });

  const out: LaidOut<T>[] = [];
  let cluster: LaidOut<T>[] = [];
  let lanes: Date[] = []; // endsAt da última atribuição em cada lane

  const flushCluster = () => {
    const size = lanes.length;
    for (const it of cluster) (it as { groupSize: number }).groupSize = size;
    cluster = [];
    lanes = [];
  };

  for (const ev of sorted) {
    const startsAtMs = ev.startsAt.getTime();
    const clusterActive = cluster.some((c) => c.endsAt.getTime() > startsAtMs);
    if (!clusterActive && cluster.length > 0) flushCluster();

    // Procura primeira lane cuja última saída já terminou (<= startsAt).
    let laneIdx = lanes.findIndex((endMs) => endMs.getTime() <= startsAtMs);
    if (laneIdx === -1) {
      laneIdx = lanes.length;
      lanes.push(ev.endsAt);
    } else {
      lanes[laneIdx] = ev.endsAt;
    }
    const laid = { ...ev, lane: laneIdx, groupSize: 0 } as LaidOut<T>;
    cluster.push(laid);
    out.push(laid);
  }
  flushCluster();
  return out;
}
