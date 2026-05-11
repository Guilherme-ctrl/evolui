/** Status de plano individual — tokens semânticos (Doc 19). */
export function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Rascunho', cls: 'badge badge--neutral' },
    PUBLISHED: { label: 'Publicado', cls: 'badge badge--ok' },
    PAUSED: { label: 'Em pausa', cls: 'badge badge--warning' },
    COMPLETED: { label: 'Concluído', cls: 'badge badge--neutral' },
    CANCELLED: { label: 'Cancelado', cls: 'badge' },
  };
  const m = map[status] ?? { label: status, cls: 'badge badge--neutral' };
  return (
    <span
      className={m.cls}
      style={
        status === 'CANCELLED'
          ? { background: 'color-mix(in srgb, var(--color-danger, #c00) 18%, transparent)' }
          : undefined
      }
    >
      {m.label}
    </span>
  );
}
