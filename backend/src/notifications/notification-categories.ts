/** Categorias configuráveis em NotificationPreference (ROT-NOT-02). */
export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  'COMMS',
  'BILLING',
  'MEDIA',
  'EVALUATION',
  'REPORT',
  'CAL_NEW',
  'CAL_UPDATE',
  'SCHEDULE_CHANGE',
  'CAL_CANCEL',
  'individual_plan',
] as const;

export type NotificationPreferenceCategory =
  (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number];

/** RN-1101: não respeitam silenciamento — sempre entregues in-app. */
export const NOTIFICATION_NON_OPTIONAL_TYPES = new Set<string>(['CAL_CANCEL']);

export const NOTIFICATION_CATEGORY_META: {
  category: NotificationPreferenceCategory;
  label: string;
  description: string;
  requiredInApp: boolean;
}[] = [
  {
    category: 'COMMS',
    label: 'Comunicados',
    description: 'Avisos e mensagens da escolinha.',
    requiredInApp: false,
  },
  {
    category: 'BILLING',
    label: 'Cobranças',
    description: 'Novas competências e lembretes financeiros.',
    requiredInApp: false,
  },
  {
    category: 'MEDIA',
    label: 'Mídia',
    description: 'Novas fotos ou vídeos da turma.',
    requiredInApp: false,
  },
  {
    category: 'EVALUATION',
    label: 'Avaliações',
    description: 'Feedback do treinador disponível.',
    requiredInApp: false,
  },
  {
    category: 'REPORT',
    label: 'Relatórios',
    description: 'Relatórios publicados.',
    requiredInApp: false,
  },
  {
    category: 'CAL_NEW',
    label: 'Calendário — novos eventos',
    description: 'Quando um treino ou evento é agendado.',
    requiredInApp: false,
  },
  {
    category: 'CAL_UPDATE',
    label: 'Calendário — alterações',
    description: 'Quando data, horário ou local mudam.',
    requiredInApp: false,
  },
  {
    category: 'SCHEDULE_CHANGE',
    label: 'Horário da turma',
    description: 'Mudança de horário ou local cadastrado na turma.',
    requiredInApp: false,
  },
  {
    category: 'CAL_CANCEL',
    label: 'Cancelamento de treino',
    description: 'Quando um evento é cancelado (sempre ativo, RN-1101).',
    requiredInApp: true,
  },
  {
    category: 'individual_plan',
    label: 'Planos individuais',
    description: 'Planos prescritos para seus filhos.',
    requiredInApp: false,
  },
];

export function isValidPreferenceCategory(
  c: string,
): c is NotificationPreferenceCategory {
  return (NOTIFICATION_PREFERENCE_CATEGORIES as readonly string[]).includes(c);
}

/** Preferência silenciável para tipos INDIVIDUAL_PLAN_* (categoria `individual_plan`). */
export function notificationPreferenceCategory(type: string): string {
  if (type.startsWith('INDIVIDUAL_PLAN_')) return 'individual_plan';
  return type;
}
