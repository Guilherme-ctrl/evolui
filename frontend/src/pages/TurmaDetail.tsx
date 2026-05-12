import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Users,
  ClipboardCheck,
  Star,
  CalendarDays,
  DollarSign,
  ArrowLeft,
} from 'lucide-react';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';

type TurmaDetailData = {
  id: string;
  name: string;
  capacity: number;
  ageRangeText: string | null;
  weekDaysText: string | null;
  scheduleText: string | null;
  location: string | null;
  categoryLabel: string | null;
  coach: { id: string; fullName: string; email: string };
  enrollments: { student: { id: string; fullName: string } }[];
};

type ContextTab = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

export default function TurmaDetail() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TurmaDetailData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'alunos' | 'presenca' | 'avaliacoes' | 'calendario' | 'financeiro'>('alunos');

  useEffect(() => {
    if (!id) return;
    void apiFetch<TurmaDetailData>(`/turmas/${id}`)
      .then(setData)
      .catch((e) => {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar turma.');
        setErr(msg);
        toast.error(msg);
      });
  }, [id, toast]);

  if (err) {
    return (
      <div className="page stack">
        <Banner variant="danger" onDismiss={() => setErr(null)}>{err}</Banner>
        <Link to="/turmas">Voltar para turmas</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page muted" style={{ paddingTop: '2rem' }}>Carregando…</div>
    );
  }

  const n = data.enrollments.length;
  const occupancyPct = data.capacity > 0 ? Math.round((n / data.capacity) * 100) : null;

  const tabs: ContextTab[] = [
    { to: 'alunos', label: 'Alunos', icon: <Users size={15} strokeWidth={2} aria-hidden /> },
    { to: 'presenca', label: 'Presença', icon: <ClipboardCheck size={15} strokeWidth={2} aria-hidden /> },
    { to: 'avaliacoes', label: 'Avaliações', icon: <Star size={15} strokeWidth={2} aria-hidden /> },
    { to: 'calendario', label: 'Calendário', icon: <CalendarDays size={15} strokeWidth={2} aria-hidden /> },
    { to: 'financeiro', label: 'Financeiro', icon: <DollarSign size={15} strokeWidth={2} aria-hidden /> },
  ];

  return (
    <div className="page stack" style={{ gap: 0, paddingBottom: 0 }}>
      {/* Header contextual */}
      <div className="turma-context-header">
        <div className="turma-context-header__top">
          <Link to="/turmas" className="turma-context-header__back">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            Turmas
          </Link>
          <div className="turma-context-header__info">
            <h1 className="turma-context-header__name">{data.name}</h1>
            <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="text-caption muted">
                {data.coach.fullName}
              </span>
              {data.weekDaysText ? (
                <span className="text-caption muted">{data.weekDaysText}</span>
              ) : null}
              {data.scheduleText ? (
                <span className="text-caption muted">{data.scheduleText}</span>
              ) : null}
              <span className="turma-context-header__occupancy">
                <span
                  className="turma-context-header__occupancy-bar"
                  style={{ width: `${Math.min(100, occupancyPct ?? 0)}%` }}
                />
                <span className="tabular-nums text-caption">
                  {n}/{data.capacity}
                  {occupancyPct != null ? ` · ${occupancyPct}%` : ''}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Tabs contextuais (sticky) */}
        <nav className="turma-tabs" aria-label="Seções da turma">
          {tabs.map((tab) => (
            <button
              key={tab.to}
              type="button"
              className={`turma-tab${activeTab === tab.to ? ' turma-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.to as typeof activeTab)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo por tab */}
      <div className="turma-tab-content">
        {activeTab === 'alunos' ? (
          <AlunosTab data={data} />
        ) : activeTab === 'presenca' ? (
          <LinkTab
            href={`/presenca?turmaId=${id}`}
            icon={<ClipboardCheck size={24} strokeWidth={2} />}
            label="Registrar presença"
            description={`Abrir chamada para ${data.name}`}
          />
        ) : activeTab === 'avaliacoes' ? (
          <LinkTab
            href={`/avaliacoes?turmaId=${id}`}
            icon={<Star size={24} strokeWidth={2} />}
            label="Avaliações da turma"
            description={`Ver e registrar avaliações de ${data.name}`}
          />
        ) : activeTab === 'calendario' ? (
          <LinkTab
            href={`/calendario?turmaId=${id}`}
            icon={<CalendarDays size={24} strokeWidth={2} />}
            label="Calendário da turma"
            description={`Treinos e eventos de ${data.name}`}
          />
        ) : activeTab === 'financeiro' ? (
          <LinkTab
            href={`/financeiro/inadimplencia`}
            icon={<DollarSign size={24} strokeWidth={2} />}
            label="Financeiro"
            description="Ver inadimplência geral — filtro por turma em breve"
          />
        ) : null}
      </div>
    </div>
  );
}

function AlunosTab({ data }: { data: TurmaDetailData }) {
  return (
    <div className="stack" style={{ gap: 'var(--space-4)', padding: 'var(--space-5) 0' }}>
      {/* Detalhes da turma */}
      {(data.ageRangeText || data.location || data.categoryLabel) ? (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="detail-kv">
            {data.ageRangeText ? (
              <span><span className="muted">Faixa etária</span> {data.ageRangeText}</span>
            ) : null}
            {data.categoryLabel ? (
              <span><span className="muted">Categoria</span> {data.categoryLabel}</span>
            ) : null}
            {data.location ? (
              <span className="detail-kv__full"><span className="muted">Local</span> {data.location}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Lista de alunos */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {data.enrollments.length === 0 ? (
          <p className="muted" style={{ padding: 'var(--space-4)' }}>Nenhum aluno nesta turma.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th style={{ width: '5rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map((e) => (
                <tr key={e.student.id}>
                  <td>
                    <Link
                      to={`/alunos/${e.student.id}`}
                      style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textDecoration: 'none' }}
                    >
                      {e.student.fullName}
                    </Link>
                  </td>
                  <td>
                    <Link
                      to={`/alunos/${e.student.id}`}
                      className="text-caption"
                      style={{ color: 'var(--accent-secondary)' }}
                    >
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LinkTab({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div style={{ padding: 'var(--space-8) var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', textAlign: 'center' }}>
      <span style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{icon}</span>
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <strong style={{ fontSize: 'var(--text-base)' }}>{label}</strong>
        <p className="text-caption muted" style={{ margin: 0 }}>{description}</p>
      </div>
      <Link to={href} className="btn btn-primary">{label} →</Link>
    </div>
  );
}
