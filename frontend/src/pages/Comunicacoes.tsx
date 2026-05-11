import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Banner } from '../components/Banner';
import { useToast } from '../components/useToast';
import { apiFetch } from '../lib/api';
import { runDeferredEffect } from '../lib/run-deferred';
import { formatDateTimeBR } from '../lib/format-date';

type TurmaRow = { id: string; name: string };
type RespRow = { id: string; fullName: string; email: string };
type CalEv = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
};

export default function Comunicacoes() {
  const toast = useToast();
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [responsaveis, setResponsaveis] = useState<RespRow[]>([]);
  const [events, setEvents] = useState<CalEv[]>([]);
  const [scope, setScope] = useState<'GLOBAL' | 'TURMA' | 'DIRECT'>('TURMA');
  const [turmaId, setTurmaId] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [calendarEventId, setCalendarEventId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isTreinador = user?.role === 'TREINADOR';
  const messageScope = isAdmin ? scope : 'TURMA';

  const loadTurmas = useCallback(async () => {
    const rows = await apiFetch<TurmaRow[]>('/turmas');
    setTurmas(rows);
    setTurmaId((t) => t || (rows[0]?.id ?? ''));
  }, []);

  const loadResponsaveis = useCallback(async () => {
    if (!isAdmin) return;
    const rows = await apiFetch<RespRow[]>('/users/responsaveis');
    setResponsaveis(rows);
    setRecipientUserId((r) => r || (rows[0]?.id ?? ''));
  }, [isAdmin]);

  const loadEvents = useCallback(async () => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 120);
    const list = await apiFetch<CalEv[]>(
      `/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}&take=100`,
    );
    setEvents(list.filter((e) => e.status === 'SCHEDULED' && new Date(e.startsAt) >= from));
  }, []);

  useEffect(() => {
    if (!isAdmin && !isTreinador) return;
    return runDeferredEffect(() => {
      void loadTurmas().catch(() => setErr('Não foi possível carregar as turmas.'));
      void loadEvents().catch(() => {
        /* opcional */
      });
    });
  }, [isAdmin, isTreinador, loadTurmas, loadEvents]);

  useEffect(() => {
    if (!isAdmin) return;
    return runDeferredEffect(() => {
      void loadResponsaveis().catch(() =>
        setErr('Não foi possível carregar responsáveis (somente administrador).'),
      );
    });
  }, [isAdmin, loadResponsaveis]);

  const eventOptions = useMemo(() => {
    const none = { id: '', label: 'Nenhum evento vinculado' };
    return [
      none,
      ...events.map((e) => ({
        id: e.id,
        label: `${e.title} · ${formatDateTimeBR(e.startsAt)}`,
      })),
    ];
  }, [events]);

  if (!user) return null;
  if (!isAdmin && !isTreinador) return <Navigate to="/" replace />;

  const submit = async () => {
    setErr(null);
    if (!title.trim() || !body.trim()) {
      setErr('Preencha título e corpo da mensagem.');
      return;
    }
    if (messageScope === 'TURMA' && !turmaId) {
      setErr('Escolha uma turma para avisos por turma.');
      return;
    }
    if (messageScope === 'DIRECT' && !recipientUserId) {
      setErr('Escolha o responsável destinatário.');
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        scope: messageScope,
        title: title.trim(),
        body: body.trim(),
      };
      if (messageScope === 'TURMA') payload.turmaId = turmaId;
      if (messageScope === 'DIRECT') payload.recipientUserId = recipientUserId;
      if (calendarEventId) payload.calendarEventId = calendarEventId;
      await apiFetch('/communications/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success('Mensagem enviada. Responsáveis foram notificados no app.');
      setTitle('');
      setBody('');
      setCalendarEventId('');
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Erro ao enviar';
      if (raw.includes('403') || raw.toLowerCase().includes('forbidden')) {
        setErr(
          'Sem permissão para esta turma ou escopo. Treinadores só enviam para turmas em que são técnicos (CA-10.01).',
        );
      } else if (raw.includes('404') || raw.toLowerCase().includes('not found')) {
        setErr('Turma não encontrada nesta escolinha ou não existe mais.');
      } else {
        setErr(raw.slice(0, 400));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Comunicações</h1>
          <p className="page-header__subtitle">
            Envie avisos para responsáveis. Escopo global só para administrador; turma para técnicos
            autorizados.
          </p>
        </div>
        <Link to="/comunicacoes/historico" className="btn btn-secondary">
          Meu histórico
        </Link>
      </header>

      {turmas.length === 0 ? (
        <p className="muted card card--lg">
          Nenhuma turma disponível no seu perfil. Peça ao administrador para vincular turmas antes de
          enviar comunicações por turma.
        </p>
      ) : null}

      <div className="card card--lg stack">
        <h2 className="text-h3">Nova mensagem</h2>

        <fieldset className="stack">
          <legend className="text-caption muted">Escopo</legend>
          {isAdmin ? (
            <label className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
              <input
                type="radio"
                name="scope"
                checked={scope === 'GLOBAL'}
                onChange={() => setScope('GLOBAL')}
              />
              <span>Global (todos os responsáveis ativos da escolinha)</span>
            </label>
          ) : null}
          <label className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
            <input
              type="radio"
              name="scope"
              checked={scope === 'TURMA'}
              onChange={() => setScope('TURMA')}
            />
            <span>Turma (responsáveis dos alunos matriculados)</span>
          </label>
          {isAdmin ? (
            <label className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
              <input
                type="radio"
                name="scope"
                checked={scope === 'DIRECT'}
                onChange={() => setScope('DIRECT')}
              />
              <span>Direto (um responsável)</span>
            </label>
          ) : null}
        </fieldset>

        {scope === 'TURMA' ? (
          <label className="stack">
            <span className="muted">Turma</span>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {scope === 'DIRECT' && isAdmin ? (
          <label className="stack">
            <span className="muted">Responsável</span>
            <select
              value={recipientUserId}
              onChange={(e) => setRecipientUserId(e.target.value)}
            >
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.email})
                </option>
              ))}
            </select>
            {responsaveis.length === 0 ? (
              <span className="text-caption muted">Nenhum responsável ativo cadastrado.</span>
            ) : null}
          </label>
        ) : null}

        <label className="stack">
          <span className="muted">Evento do calendário (opcional)</span>
          <select
            value={calendarEventId}
            onChange={(e) => setCalendarEventId(e.target.value)}
          >
            {eventOptions.map((o) => (
              <option key={o.id || 'none'} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="stack">
          <span className="muted">Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="stack">
          <span className="muted">Mensagem</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        </label>

        {err ? (
          <Banner variant="danger" onDismiss={() => setErr(null)}>
            {err}
          </Banner>
        ) : null}

        <button
          type="button"
          className="btn btn-primary"
          disabled={sending || (messageScope === 'TURMA' && !turmaId)}
          onClick={() => void submit()}
        >
          {sending ? 'Enviando…' : 'Enviar mensagem'}
        </button>
      </div>
    </div>
  );
}
