/**
 * Fonte única do menu lateral por papel (shell operacional + portal).
 */

export type UserRole = 'ADMIN' | 'TREINADOR' | 'ATLETA';

export type NavItem = {
  to: string;
  label: string;
  /** NavLink `end` — ex.: só match exato em `/`. */
  end?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

function coachExtras(isActiveStaff: boolean): NavItem[] {
  if (!isActiveStaff) return [];
  return [
    { to: '/biblioteca/exercicios', label: 'Biblioteca' },
    { to: '/treinos', label: 'Treinos' },
  ];
}

export function navGroupsForRole(
  role: UserRole,
  isActiveStaff: boolean,
): NavGroup[] {
  if (role === 'ADMIN') {
    return [
      { title: 'Principal', items: [{ to: '/', label: 'Início', end: true }] },
      {
        title: 'Pessoas',
        items: [
          { to: '/alunos', label: 'Alunos' },
          { to: '/gestao/profissionais', label: 'Profissionais' },
          { to: '/gestao', label: 'Visão geral' },
        ],
      },
      {
        title: 'Operação',
        items: [
          { to: '/turmas', label: 'Turmas' },
          { to: '/avaliacoes', label: 'Avaliações' },
          { to: '/calendario', label: 'Calendário' },
          { to: '/treinos', label: 'Treinos' },
          { to: '/treinos/historico', label: 'Histórico' },
          { to: '/biblioteca/exercicios', label: 'Biblioteca' },
        ],
      },
      {
        title: 'Comunicação',
        items: [
          { to: '/comunicacoes', label: 'Comunicações' },
          { to: '/midia', label: 'Mídia' },
        ],
      },
      {
        title: 'Financeiro',
        items: [
          { to: '/financeiro/inadimplencia', label: 'Inadimplência' },
          { to: '/financeiro/historico', label: 'Histórico' },
          { to: '/financeiro/cobrancas', label: 'Cobranças' },
        ],
      },
      {
        title: 'Relatórios',
        items: [
          { to: '/relatorios', label: 'Relatórios' },
          { to: '/dashboard', label: 'Dashboard' },
        ],
      },
    ];
  }
  if (role === 'TREINADOR') {
    return [
      { title: 'Principal', items: [{ to: '/', label: 'Início', end: true }] },
      {
        title: 'Operação',
        items: [
          { to: '/presenca', label: 'Presença' },
          { to: '/turmas', label: 'Turmas' },
          { to: '/alunos', label: 'Alunos' },
          { to: '/avaliacoes', label: 'Avaliações' },
          { to: '/calendario', label: 'Calendário' },
          { to: '/treinos/historico', label: 'Histórico' },
          ...coachExtras(isActiveStaff),
        ],
      },
      {
        title: 'Comunicação',
        items: [
          { to: '/comunicacoes', label: 'Comunicações' },
          { to: '/midia', label: 'Mídia' },
        ],
      },
    ];
  }
  return [
    { title: 'Principal', items: [{ to: '/', label: 'Início', end: true }] },
    {
      title: 'Família',
      items: [
        { to: '/filhos', label: 'Meus filhos' },
        { to: '/meus-treinos', label: 'Meus treinos' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/treinos/historico', label: 'Histórico' },
      ],
    },
    {
      title: 'Comunicação',
      items: [
        { to: '/avisos', label: 'Avisos' },
        { to: '/notificacoes', label: 'Notificações' },
        { to: '/midia', label: 'Mídia' },
      ],
    },
  ];
}
