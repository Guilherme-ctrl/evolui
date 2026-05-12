import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, ClipboardCheck, Star, DollarSign, MessageSquare } from 'lucide-react';
import { apiFetch, errorMessageFromUnknown } from '../lib/api';
import type { UserRole } from '../layout/nav-config';

type StudentRow = { id: string; fullName: string };
type TurmaRow = { id: string; name: string };

type Shortcut = { to: string; label: string; hint: string };
type QuickAction = { to: string; label: string; icon: React.ReactNode };

const STAFF_SHORTCUTS: Shortcut[] = [
  { to: '/alunos', label: 'Alunos', hint: 'Lista de atletas' },
  { to: '/turmas', label: 'Turmas', hint: 'Turmas e matrículas' },
  { to: '/calendario', label: 'Calendário', hint: 'Agenda da escolinha' },
  { to: '/financeiro/inadimplencia', label: 'Inadimplência', hint: 'Cobranças vencidas' },
  { to: '/comunicacoes', label: 'Comunicações', hint: 'Avisos e envios' },
  { to: '/avaliacoes', label: 'Avaliações', hint: 'Desempenho dos alunos' },
  { to: '/relatorios', label: 'Relatórios', hint: 'Relatórios para as famílias' },
];

const ATHLETE_SHORTCUTS: Shortcut[] = [
  { to: '/filhos', label: 'Meus filhos', hint: 'Alunos vinculados' },
  { to: '/calendario', label: 'Calendário', hint: 'Agenda' },
  { to: '/avisos', label: 'Avisos', hint: 'Mensagens' },
  { to: '/notificacoes', label: 'Notificações', hint: 'Alertas do sistema' },
];

const COACH_QUICK_ACTIONS: QuickAction[] = [
  { to: '/presenca', label: 'Registrar presença', icon: <ClipboardCheck size={15} strokeWidth={2} aria-hidden /> },
  { to: '/avaliacoes', label: 'Nova avaliação', icon: <Star size={15} strokeWidth={2} aria-hidden /> },
  { to: '/comunicacoes', label: 'Enviar mensagem', icon: <MessageSquare size={15} strokeWidth={2} aria-hidden /> },
];

const ADMIN_QUICK_ACTIONS: QuickAction[] = [
  { to: '/financeiro/inadimplencia', label: 'Ver inadimplência', icon: <DollarSign size={15} strokeWidth={2} aria-hidden /> },
  { to: '/avaliacoes', label: 'Registrar avaliação', icon: <Star size={15} strokeWidth={2} aria-hidden /> },
  { to: '/comunicacoes', label: 'Enviar comunicado', icon: <MessageSquare size={15} strokeWidth={2} aria-hidden /> },
];

type HitItem =
  | { kind: 'shortcut'; to: string; label: string; hint: string }
  | { kind: 'student'; to: string; label: string }
  | { kind: 'turma'; to: string; label: string }
  | { kind: 'action'; to: string; label: string; icon: React.ReactNode };

export type GlobalSearchModalProps = {
  open: boolean;
  onClose: () => void;
  role: UserRole;
};

export function GlobalSearchModal({ open, onClose, role }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const staff = role === 'ADMIN' || role === 'TREINADOR';
  const shortcuts = staff ? STAFF_SHORTCUTS : ATHLETE_SHORTCUTS;
  const quickActions = role === 'TREINADOR' ? COACH_QUICK_ACTIONS : role === 'ADMIN' ? ADMIN_QUICK_ACTIONS : [];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setQ('');
      setActiveIdx(0);
      setLoadErr(null);
      if (!staff) {
        setStudents([]);
        setTurmas([]);
        return;
      }
      void (async () => {
        try {
          const [sRaw, tRaw] = await Promise.all([
            apiFetch<unknown[]>('/students?take=300'),
            apiFetch<unknown[]>('/turmas?take=150'),
          ]);
          if (cancelled) return;
          setStudents(
            (Array.isArray(sRaw) ? sRaw : []).map((r) => {
              const row = r as Record<string, unknown>;
              return { id: row.id as string, fullName: (row.fullName as string) ?? '—' };
            }),
          );
          setTurmas(
            (Array.isArray(tRaw) ? tRaw : []).map((r) => {
              const row = r as Record<string, unknown>;
              return { id: row.id as string, name: (row.name as string) ?? '—' };
            }),
          );
        } catch (e) {
          if (!cancelled) setLoadErr(errorMessageFromUnknown(e, 'Não foi possível carregar dados.'));
        }
      })();
    });
    return () => { cancelled = true; };
  }, [open, staff]);

  const ql = q.trim().toLowerCase();

  const hits = useMemo<HitItem[]>(() => {
    const result: HitItem[] = [];

    if (!ql) {
      quickActions.forEach((a) =>
        result.push({ kind: 'action', to: a.to, label: a.label, icon: a.icon }),
      );
      shortcuts.forEach((s) =>
        result.push({ kind: 'shortcut', to: s.to, label: s.label, hint: s.hint }),
      );
    } else {
      shortcuts
        .filter((s) => s.label.toLowerCase().includes(ql) || s.hint.toLowerCase().includes(ql))
        .forEach((s) => result.push({ kind: 'shortcut', to: s.to, label: s.label, hint: s.hint }));
      students
        .filter((s) => s.fullName.toLowerCase().includes(ql))
        .slice(0, 10)
        .forEach((s) => result.push({ kind: 'student', to: `/alunos/${s.id}`, label: s.fullName }));
      turmas
        .filter((t) => t.name.toLowerCase().includes(ql))
        .slice(0, 8)
        .forEach((t) => result.push({ kind: 'turma', to: `/turmas/${t.id}`, label: t.name }));
    }

    return result;
  }, [ql, shortcuts, quickActions, students, turmas]);

  // Reset active index when hits change
  useEffect(() => setActiveIdx(0), [hits.length]);

  const go = useCallback(
    (to: string) => {
      onClose();
      navigate(to);
    },
    [navigate, onClose],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && hits[activeIdx]) {
        e.preventDefault();
        go(hits[activeIdx].to);
      }
    },
    [onClose, hits, activeIdx, go],
  );

  if (!open) return null;

  // Grouping for display
  const actionHits = hits.filter((h) => h.kind === 'action');
  const shortcutHits = hits.filter((h) => h.kind === 'shortcut');
  const studentHits = hits.filter((h) => h.kind === 'student');
  const turmaHits = hits.filter((h) => h.kind === 'turma');

  const hitIndex = (h: HitItem) => hits.indexOf(h);

  return (
    <div
      className="global-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-search-title"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="global-search-backdrop"
        aria-label="Fechar busca"
        onClick={onClose}
      />
      <div className="global-search-dialog card card--lg stack">
        {/* Input */}
        <div className="global-search-input-row">
          <Search size={18} aria-hidden style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            id="global-search-title"
            className="global-search-input"
            autoFocus
            placeholder={staff ? 'Buscar atletas, turmas, páginas…' : 'Buscar atalhos…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Busca global"
            aria-autocomplete="list"
          />
          {q ? (
            <button type="button" className="global-search-clear" onClick={() => setQ('')} aria-label="Limpar busca">
              <X size={16} aria-hidden />
            </button>
          ) : (
            <button type="button" className="btn btn-ghost global-search-esc" onClick={onClose} aria-label="Fechar">
              <kbd>Esc</kbd>
            </button>
          )}
        </div>

        {loadErr ? <p className="text-caption muted">{loadErr}</p> : null}

        <div className="global-search-results" role="listbox" aria-label="Resultados">
          {hits.length === 0 && ql ? (
            <p className="muted text-caption" style={{ padding: 'var(--space-3) var(--space-4)' }}>
              Nenhum resultado para &ldquo;{q.trim()}&rdquo;.
            </p>
          ) : null}

          {/* Ações rápidas */}
          {actionHits.length > 0 ? (
            <div className="global-search-section">
              <span className="global-search-section__label">Ações rápidas</span>
              {actionHits.map((h) => {
                const idx = hitIndex(h);
                return (
                  <button
                    key={h.to + h.label}
                    type="button"
                    role="option"
                    aria-selected={activeIdx === idx}
                    className={`global-search-hit global-search-hit--action${activeIdx === idx ? ' global-search-hit--active' : ''}`}
                    onClick={() => go(h.to)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    {'icon' in h ? <span className="global-search-hit__icon">{h.icon}</span> : null}
                    <span>{h.label}</span>
                    <ArrowRight size={13} strokeWidth={2} aria-hidden style={{ marginLeft: 'auto', opacity: 0.4 }} />
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Atalhos de página */}
          {shortcutHits.length > 0 ? (
            <div className="global-search-section">
              <span className="global-search-section__label">{ql ? 'Páginas' : 'Navegação'}</span>
              {shortcutHits.map((h) => {
                const idx = hitIndex(h);
                return (
                  <button
                    key={h.to}
                    type="button"
                    role="option"
                    aria-selected={activeIdx === idx}
                    className={`global-search-hit${activeIdx === idx ? ' global-search-hit--active' : ''}`}
                    onClick={() => go(h.to)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span>{h.label}</span>
                    {'hint' in h ? <span className="global-search-hit__meta">{h.hint}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Atletas */}
          {studentHits.length > 0 ? (
            <div className="global-search-section">
              <span className="global-search-section__label">Atletas</span>
              {studentHits.map((h) => {
                const idx = hitIndex(h);
                return (
                  <button
                    key={h.to}
                    type="button"
                    role="option"
                    aria-selected={activeIdx === idx}
                    className={`global-search-hit${activeIdx === idx ? ' global-search-hit--active' : ''}`}
                    onClick={() => go(h.to)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span>{h.label}</span>
                    <span className="global-search-hit__meta">atleta</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Turmas */}
          {turmaHits.length > 0 ? (
            <div className="global-search-section">
              <span className="global-search-section__label">Turmas</span>
              {turmaHits.map((h) => {
                const idx = hitIndex(h);
                return (
                  <button
                    key={h.to}
                    type="button"
                    role="option"
                    aria-selected={activeIdx === idx}
                    className={`global-search-hit${activeIdx === idx ? ' global-search-hit--active' : ''}`}
                    onClick={() => go(h.to)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span>{h.label}</span>
                    <span className="global-search-hit__meta">turma</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Rodapé de atalhos de teclado */}
        <div className="global-search-footer">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
