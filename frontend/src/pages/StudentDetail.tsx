import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import EvolutionList from '../components/EvolutionList';
import { useToast } from '../components/useToast';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import { formatCpfBr, labelStudentDocumentType } from '../lib/format-cpf';
import { formatDateBR, formatYmdToBR } from '../lib/format-date';

type GuardianLink = {
  isPrimaryForBilling: boolean;
  guardian: {
    id: string;
    fullName: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    kinship: string | null;
    address: string | null;
    cpf: string | null;
  };
};

type PortalUserRef = {
  id: string;
  fullName: string;
  email: string;
};

type StudentDetail = {
  id: string;
  fullName: string;
  birthDate: string | null;
  categoryLabel: string | null;
  active: boolean;
  documentType?: 'CPF' | 'RG' | 'RNE' | 'OUTRO' | null;
  documentNumber?: string | null;
  preferredPosition?: string | null;
  emergencyContact: string | null;
  medicalNotes?: string | null;
  physicalRestrictions?: string | null;
  selfManagedPortal?: boolean;
  portalUser?: PortalUserRef | null;
  guardians: GuardianLink[];
  enrollments: { turma: { id: string; name: string } }[];
};

type WorkoutFeedbackHistoryItem = {
  id: string;
  submittedDate: string;
  scores: Record<string, number>;
  notes: string | null;
  workout: {
    id: string;
    name: string;
    feedbackDimensions: { key: string; label: string; order: number }[];
  };
  submittedByUser: { id: string; fullName: string };
};

type StudentFeedbackHistory = {
  student: { id: string; fullName: string };
  feedbacks: WorkoutFeedbackHistoryItem[];
};

type CalendarFeedbackHistoryItem = {
  id: string;
  scores: Record<string, number>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    title: string;
    type: string;
    startsAt: string;
    effectiveFeedbackDimensions: {
      key: string;
      label: string;
      order: number;
    }[];
  };
  submittedByUser: { id: string; fullName: string };
};

type StudentCalendarFeedbackHistory = {
  student: { id: string; fullName: string };
  feedbacks: CalendarFeedbackHistoryItem[];
};

export default function StudentDetail() {
  const toast = useToast();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StudentDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [studentIsAccountHolder, setStudentIsAccountHolder] = useState(false);
  const [accountHolderEmail, setAccountHolderEmail] = useState('');
  const [accountHolderPassword, setAccountHolderPassword] = useState('');
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalErr, setPortalErr] = useState<string | null>(null);
  const [portalOk, setPortalOk] = useState(false);
  const isGuardian = user?.role === 'ATLETA';
  const isAdmin = user?.role === 'ADMIN';
  const canSeeFeedback =
    user?.role === 'ADMIN' ||
    (user?.role === 'TREINADOR' && user?.staffProfile?.active);
  const [feedbackHistory, setFeedbackHistory] =
    useState<StudentFeedbackHistory | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [calFeedbackHistory, setCalFeedbackHistory] =
    useState<StudentCalendarFeedbackHistory | null>(null);
  const [calFeedbackLoading, setCalFeedbackLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    void apiFetch<StudentDetail>(`/students/${id}`)
      .then((d) => {
        setData(d);
        setStudentIsAccountHolder(!!d.selfManagedPortal);
        setAccountHolderEmail('');
        setAccountHolderPassword('');
      })
      .catch((e) => {
        const msg = errorMessageFromUnknown(e, 'Erro ao carregar aluno.');
        setErr(msg);
        toast.error(msg);
      });
  }, [id, toast]);

  useEffect(() => {
    if (!id || !canSeeFeedback) return;
    setFeedbackLoading(true);
    void apiFetch<StudentFeedbackHistory>(`/students/${id}/workout-feedback`)
      .then((h) => setFeedbackHistory(h))
      .catch((e) =>
        toast.error(errorMessageFromUnknown(e, 'Erro ao carregar feedback.')),
      )
      .finally(() => setFeedbackLoading(false));
  }, [id, canSeeFeedback, toast]);

  useEffect(() => {
    if (!id || !canSeeFeedback) return;
    setCalFeedbackLoading(true);
    void apiFetch<StudentCalendarFeedbackHistory>(
      `/students/${id}/calendar-feedback`,
    )
      .then((h) => setCalFeedbackHistory(h))
      .catch((e) =>
        toast.error(
          errorMessageFromUnknown(
            e,
            'Erro ao carregar feedback de eventos.',
          ),
        ),
      )
      .finally(() => setCalFeedbackLoading(false));
  }, [id, canSeeFeedback, toast]);

  async function savePortalAutonomy() {
    if (!id || !data) return;
    setPortalErr(null);
    setPortalOk(false);
    setPortalSaving(true);
    try {
      const needsNewLogin =
        studentIsAccountHolder && !data.portalUser?.id;
      if (needsNewLogin) {
        if (!accountHolderEmail.trim()) {
          setPortalErr('Informe o e-mail do login.');
          setPortalSaving(false);
          return;
        }
        if (accountHolderPassword.length < 6) {
          setPortalErr('A senha deve ter ao menos 6 caracteres.');
          setPortalSaving(false);
          return;
        }
      }
      const body: Record<string, unknown> = {
        selfManagedPortal: studentIsAccountHolder,
      };
      if (studentIsAccountHolder && needsNewLogin) {
        body.portalAccountEmail = accountHolderEmail.trim().toLowerCase();
        body.portalAccountPassword = accountHolderPassword;
      }
      const updated = await apiFetch<StudentDetail>(`/students/${id}/portal-autonomy`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setData(updated);
      setStudentIsAccountHolder(!!updated.selfManagedPortal);
      setAccountHolderEmail('');
      setAccountHolderPassword('');
      setPortalOk(true);
    } catch (e) {
      const msg = errorMessageFromUnknown(e, 'Erro ao salvar.');
      setPortalErr(msg);
      toast.error(msg);
    } finally {
      setPortalSaving(false);
    }
  }

  if (err) {
    return (
      <div className="page stack">
        <Banner variant="danger" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
        <Link to="/alunos">Voltar para alunos</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page muted" style={{ paddingTop: '2rem' }}>
        Carregando…
      </div>
    );
  }

  return (
    <div className="page stack">
      <nav className="text-caption" style={{ marginBottom: 'var(--space-2)' }}>
        <Link to="/alunos">← Alunos</Link>
      </nav>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">{data.fullName}</h1>
          <p className="page-header__subtitle">
            Nasc.: {data.birthDate ? formatDateBR(data.birthDate) : '—'}
            {data.categoryLabel ? ` · ${data.categoryLabel}` : ''}
            {' · '}
            <span className={`badge ${data.active ? 'badge--ok' : 'badge--neutral'}`}>
              {data.active ? 'Ativo' : 'Inativo'}
            </span>
          </p>
        </div>
      </header>

      {!isGuardian ||
      data.preferredPosition ||
      data.emergencyContact ||
      data.medicalNotes ||
      data.physicalRestrictions ? (
        <div className="card card--lg stack">
          <h2 className="text-h3">Identificação e ficha</h2>
          {!isGuardian ? (
            data.documentType && data.documentNumber ? (
              <p className="text-body" style={{ margin: 0 }}>
                <span className="muted">{labelStudentDocumentType(data.documentType)}</span>{' '}
                <span className="tabular-nums">
                  {data.documentType === 'CPF'
                    ? formatCpfBr(data.documentNumber)
                    : data.documentNumber}
                </span>
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Documento não informado.
              </p>
            )
          ) : null}
          {data.preferredPosition ? (
            <p className="text-body" style={{ margin: 0 }}>
              <span className="muted">Posição preferida</span> {data.preferredPosition}
            </p>
          ) : null}
          {data.emergencyContact ? (
            <p className="text-body" style={{ margin: 0 }}>
              <span className="muted">Contato de emergência</span> {data.emergencyContact}
            </p>
          ) : null}
          {data.medicalNotes ? (
            <div>
              <p className="muted" style={{ margin: '0 0 var(--space-1)' }}>
                Observações médicas
              </p>
              <p className="text-body" style={{ margin: 0 }}>
                {data.medicalNotes}
              </p>
            </div>
          ) : null}
          {data.physicalRestrictions ? (
            <div>
              <p className="muted" style={{ margin: '0 0 var(--space-1)' }}>
                Restrições físicas
              </p>
              <p className="text-body" style={{ margin: 0 }}>
                {data.physicalRestrictions}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card card--lg stack">
        <h2 className="text-h3">Responsáveis e cobrança</h2>
        {data.guardians.length === 0 ? (
          <p className="muted">Nenhum responsável vinculado.</p>
        ) : (
          <ul className="plain">
            {data.guardians.map((g) => (
              <li key={g.guardian.id} className="list-row stack" style={{ gap: 'var(--space-2)' }}>
                <div className="row" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                  <strong>{g.guardian.fullName}</strong>
                  {g.isPrimaryForBilling ? (
                    <span className="badge badge--info">Cobrança principal</span>
                  ) : (
                    <span className="badge badge--neutral">Responsável</span>
                  )}
                </div>
                {g.guardian.kinship ? <span className="text-caption">Parentesco: {g.guardian.kinship}</span> : null}
                <div className="detail-kv">
                  {g.guardian.phone ? (
                    <span>
                      <span className="muted">Tel.</span> {g.guardian.phone}
                    </span>
                  ) : null}
                  {g.guardian.whatsapp ? (
                    <span>
                      <span className="muted">WhatsApp</span> {g.guardian.whatsapp}
                    </span>
                  ) : null}
                  {g.guardian.email ? (
                    <span>
                      <span className="muted">E-mail</span> {g.guardian.email}
                    </span>
                  ) : null}
                  {g.guardian.cpf ? (
                    <span>
                      <span className="muted">CPF</span> {g.guardian.cpf}
                    </span>
                  ) : null}
                  {g.guardian.address ? (
                    <span className="detail-kv__full">
                      <span className="muted">Endereço</span> {g.guardian.address}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin ? (
        <div className="card card--lg stack">
          <h2 className="text-h3">Conta no app</h2>
          <p className="text-caption muted" style={{ margin: 0 }}>
            Ao desmarcar, é necessário ter ao menos um responsável vinculado ao aluno.
          </p>
          {portalErr ? (
            <Banner variant="danger" onDismiss={() => setPortalErr(null)}>
              {portalErr}
            </Banner>
          ) : null}
          {portalOk ? (
            <Banner variant="info" onDismiss={() => setPortalOk(false)}>
              Configuração atualizada.
            </Banner>
          ) : null}
          <label className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={studentIsAccountHolder}
              onChange={(e) => {
                setStudentIsAccountHolder(e.target.checked);
                if (!e.target.checked) {
                  setAccountHolderEmail('');
                  setAccountHolderPassword('');
                }
              }}
            />
            <span className="text-body">Esse aluno é o responsável pela conta</span>
          </label>
          {studentIsAccountHolder && data.portalUser ? (
            <p className="text-body muted" style={{ margin: 0 }}>
              Login: <strong>{data.portalUser.email}</strong>
            </p>
          ) : null}
          {studentIsAccountHolder && !data.portalUser ? (
            <div className="form-grid-2">
              <label className="stack">
                <span className="muted">E-mail do login</span>
                <input
                  type="email"
                  autoComplete="off"
                  value={accountHolderEmail}
                  onChange={(e) => setAccountHolderEmail(e.target.value)}
                />
              </label>
              <label className="stack">
                <span className="muted">Senha (mín. 6 caracteres)</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={accountHolderPassword}
                  onChange={(e) => setAccountHolderPassword(e.target.value)}
                  minLength={6}
                />
              </label>
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              portalSaving ||
              (studentIsAccountHolder &&
                !data.portalUser &&
                (!accountHolderEmail.trim() || accountHolderPassword.length < 6))
            }
            onClick={() => void savePortalAutonomy()}
          >
            {portalSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      ) : null}

      <div className="card card--lg stack">
        <h2 className="text-h3">Turmas</h2>
        {data.enrollments.length === 0 ? (
          <p className="muted">Sem matrícula.</p>
        ) : (
          <ul className="plain">
            {data.enrollments.map((e) => (
              <li key={e.turma.id} className="list-row">
                <Link to={`/turmas/${e.turma.id}`}>{e.turma.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isGuardian && (user?.role === 'ADMIN' || user?.staffProfile?.active) ? (
        <details className="card card--lg stack" open={false}>
          <summary className="text-h3" style={{ cursor: 'pointer' }}>
            Planos individuais
          </summary>
          <p className="text-caption muted" style={{ marginTop: 'var(--space-2)' }}>
            Prescrições de profissionais (fora da rotina de campo do treinador).
          </p>
          <Link to={`/alunos/${data.id}/planos`} className="btn btn-secondary">
            Abrir planos
          </Link>
        </details>
      ) : null}

      <div className="card card--lg stack field-mode">
        <h2 className="text-h3">Evolução</h2>
        <p className="text-caption muted" style={{ marginTop: 0 }}>
          Histórico de avaliações (sem comparação com outros alunos).
        </p>
        <EvolutionList studentId={data.id} />
      </div>

      {canSeeFeedback ? (
        <div className="card card--lg stack">
          <h2 className="text-h3">Feedback físico — eventos do calendário</h2>
          <p className="text-caption muted" style={{ marginTop: 0 }}>
            Respostas do aluno a treinos, jogos e demais eventos. Cada linha
            representa uma resposta a um evento específico (1 por par
            evento/aluno; reabrir atualiza).
          </p>
          {calFeedbackLoading ? (
            <p className="muted">Carregando…</p>
          ) : !calFeedbackHistory ||
            calFeedbackHistory.feedbacks.length === 0 ? (
            <p className="muted">Sem respostas registradas ainda.</p>
          ) : (
            <ul
              className="stack"
              style={{ listStyle: 'none', padding: 0, gap: 'var(--space-2)' }}
            >
              {calFeedbackHistory.feedbacks.map((f) => (
                <li
                  key={f.id}
                  className="card"
                  style={{ padding: 'var(--space-2)' }}
                >
                  <div
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>
                      {f.event.title}{' '}
                      <span className="text-caption muted">
                        · {f.event.type}
                      </span>
                    </strong>
                    <span className="text-caption muted">
                      {formatDateBR(f.event.startsAt)}
                    </span>
                  </div>
                  <div
                    className="row"
                    style={{
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {f.event.effectiveFeedbackDimensions.map((d) => (
                      <span
                        key={d.key}
                        className="badge"
                        style={{
                          border: '1px solid var(--border-default, #eee)',
                          padding: '2px 8px',
                          borderRadius: 9999,
                        }}
                      >
                        {d.label}:{' '}
                        <strong>
                          {typeof f.scores?.[d.key] === 'number'
                            ? f.scores[d.key]
                            : '—'}
                        </strong>
                      </span>
                    ))}
                  </div>
                  {f.notes ? (
                    <p
                      className="text-caption"
                      style={{ margin: 'var(--space-1) 0 0' }}
                    >
                      <em>"{f.notes}"</em>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {canSeeFeedback ? (
        <div className="card card--lg stack">
          <h2 className="text-h3">
            Feedback físico — treinos específicos (workouts)
          </h2>
          <p className="text-caption muted" style={{ marginTop: 0 }}>
            Respostas vinculadas a um Workout (plano de exercícios) — separado
            do feedback de eventos do calendário acima. Notas em escala 1–5
            (1 = muito leve · 5 = muito intenso); vazio significa que o aluno
            não respondeu aquela dimensão.
          </p>
          {feedbackLoading ? (
            <p className="muted">Carregando…</p>
          ) : !feedbackHistory || feedbackHistory.feedbacks.length === 0 ? (
            <p className="muted">Sem respostas registradas ainda.</p>
          ) : (
            <ul
              className="stack"
              style={{ listStyle: 'none', padding: 0, gap: 'var(--space-2)' }}
            >
              {feedbackHistory.feedbacks.map((f) => (
                <li
                  key={f.id}
                  className="card"
                  style={{ padding: 'var(--space-2)' }}
                >
                  <div
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>{f.workout.name}</strong>
                    <span className="text-caption muted">
                      {formatYmdToBR(f.submittedDate.slice(0, 10))}
                    </span>
                  </div>
                  <div
                    className="row"
                    style={{
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {f.workout.feedbackDimensions.map((d) => (
                      <span
                        key={d.key}
                        className="badge"
                        style={{
                          border: '1px solid var(--border-default, #eee)',
                          padding: '2px 8px',
                          borderRadius: 9999,
                        }}
                      >
                        {d.label}:{' '}
                        <strong>
                          {typeof f.scores?.[d.key] === 'number'
                            ? f.scores[d.key]
                            : '—'}
                        </strong>
                      </span>
                    ))}
                  </div>
                  {f.notes ? (
                    <p
                      className="text-caption"
                      style={{ margin: 'var(--space-1) 0 0' }}
                    >
                      <em>"{f.notes}"</em>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
