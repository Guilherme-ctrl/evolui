/**
 * CA-03.02 / Doc 22 A5: texto exibido na lista in-app não deve vazar corpo livre
 * (ex.: comunicados, motivos longos) nem observações sensíveis no preview.
 * O conteúdo completo permanece nos registros canônicos (Comunicações, etc.).
 */
function payloadStudentName(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const n = (payload as Record<string, unknown>).studentName;
  return typeof n === 'string' && n.trim() ? n.trim() : undefined;
}

export function buildInAppListPreview(n: {
  type: string;
  title: string;
  body: string;
  payloadJson: unknown;
}): string {
  const studentName = payloadStudentName(n.payloadJson);

  switch (n.type) {
    case 'COMMS':
      return 'Abra Comunicações para ler a mensagem completa.';
    case 'BILLING':
      return studentName
        ? `Nova cobrança registrada · ${studentName}`
        : 'Nova cobrança registrada. Veja o financeiro do aluno.';
    case 'MEDIA':
      return 'Novas fotos ou vídeos foram publicados para a turma.';
    case 'EVALUATION':
      return studentName
        ? `Nova avaliação disponível · ${studentName}`
        : 'Nova avaliação disponível. Veja na área do aluno.';
    case 'REPORT':
      return studentName
        ? `Relatório publicado · ${studentName}`
        : 'Novo relatório publicado. Veja em Relatórios.';
    case 'CAL_NEW': {
      const label = n.body?.trim() || n.title?.trim();
      return label ? `Calendário · ${label}` : 'Novo evento no calendário.';
    }
    case 'CAL_UPDATE':
    case 'CAL_CANCEL':
    case 'SCHEDULE_CHANGE':
      return n.body.length > 280 ? `${n.body.slice(0, 277)}…` : n.body;
    case 'INDIVIDUAL_PLAN_PUBLISHED':
    case 'INDIVIDUAL_PLAN_UPDATED':
    case 'INDIVIDUAL_PLAN_PAUSED':
    case 'INDIVIDUAL_PLAN_RESUMED':
    case 'INDIVIDUAL_PLAN_COMPLETED':
    case 'INDIVIDUAL_PLAN_CANCELLED':
      return n.body.length > 280 ? `${n.body.slice(0, 277)}…` : n.body;
    default:
      return 'Nova notificação. Consulte o módulo correspondente para detalhes.';
  }
}
