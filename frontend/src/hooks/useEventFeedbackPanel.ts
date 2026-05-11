import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../components/useToast';
import {
  describeOverrideState,
  validateDimensions,
  type FeedbackDimension,
  type OverrideState,
} from '../domain/feedback-dimensions';
import {
  canConfigureTenantDefaults,
  canSeeFeedbackReport,
  isAdmin as roleIsAdmin,
  isAthlete as roleIsAthlete,
} from '../domain/rbac';
import { errorMessageFromUnknown } from '../lib/api';
import { calendarApi, type EventFeedbackDimsAction } from '../services/calendar';
import type { EventFeedbackReport } from '../services/types';

type EventLite = {
  id: string;
  title: string;
  startsAt: string;
  feedbackDimensions: FeedbackDimension[] | null;
  effectiveFeedbackDimensions: FeedbackDimension[];
};

export type EventFeedbackViewModel = {
  // Permissões derivadas
  role: 'ADMIN' | 'TREINADOR' | 'ATLETA' | undefined;
  isAdmin: boolean;
  isAthlete: boolean;
  isStaff: boolean;
  canConfigure: boolean;
  canSeeReport: boolean;

  // Estado das dimensões
  dims: FeedbackDimension[];
  overrideState: OverrideState;

  // Resposta do ATLETA (corrente)
  hasMyFeedback: boolean;
  myScores: Record<string, number>;
  myNotes: string;
  loadingMyFeedback: boolean;

  // Relatório (lazy, só carrega ao pedir)
  report: EventFeedbackReport | null;
  reportLoading: boolean;

  // Ações (assíncronas, já com toast/errors centralizados)
  setEventDimensions(action: EventFeedbackDimsAction): Promise<boolean>;
  loadReport(): Promise<void>;
  submitAthleteFeedback(
    scores: Record<string, number>,
    notes: string,
  ): Promise<boolean>;

  // Setters expostos para a UI (controle dos inputs do modal de feedback)
  setMyScores(next: Record<string, number>): void;
  setMyNotes(next: string): void;
};

/**
 * Encapsula todo o estado e as chamadas de API do painel de feedback de um
 * evento de calendário. O componente que renderiza recebe só o `vm` retornado
 * por este hook e fica puramente apresentacional.
 *
 * `onChanged` é chamado depois de mutações relevantes (override salvo,
 * feedback enviado) para que o consumidor recarregue o evento/lista.
 */
export function useEventFeedbackPanel(
  event: EventLite,
  onChanged?: () => void,
): EventFeedbackViewModel {
  const { user, activeStudentId } = useAuth();
  const toast = useToast();
  const role = user?.role;
  const isAdmin = roleIsAdmin(user);
  const isAthlete = roleIsAthlete(user);
  const isStaff = role === 'ADMIN' || role === 'TREINADOR';
  const canConfigure = canConfigureTenantDefaults(user);
  const canSeeReport = canSeeFeedbackReport(user);

  const dims = event.effectiveFeedbackDimensions ?? [];
  const overrideState = describeOverrideState(event.feedbackDimensions);

  const [myScores, setMyScores] = useState<Record<string, number>>({});
  const [myNotes, setMyNotes] = useState('');
  const [hasMyFeedback, setHasMyFeedback] = useState(false);
  const [loadingMyFeedback, setLoadingMyFeedback] = useState(false);

  const [report, setReport] = useState<EventFeedbackReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Carrega resposta atual do ATLETA quando entra em cena. O reset síncrono
  // quando muda o aluno/dimensões zeradas é intencional para evitar mostrar a
  // resposta de outro contexto enquanto a próxima chega.
  useEffect(() => {
    if (!isAthlete || !activeStudentId || dims.length === 0) {
      setHasMyFeedback(false);
      setMyScores({});
      setMyNotes('');
      return;
    }
    let aborted = false;
    setLoadingMyFeedback(true);
    calendarApi
      .getAthleteEventFeedback(activeStudentId, event.id)
      .then((existing) => {
        if (aborted) return;
        if (existing && existing.id) {
          setHasMyFeedback(true);
          setMyScores(existing.scores ?? {});
          setMyNotes(existing.notes ?? '');
        } else {
          setHasMyFeedback(false);
          setMyScores({});
          setMyNotes('');
        }
      })
      .catch(() => {
        if (aborted) return;
        setHasMyFeedback(false);
        setMyScores({});
        setMyNotes('');
      })
      .finally(() => {
        if (!aborted) setLoadingMyFeedback(false);
      });
    return () => {
      aborted = true;
    };
  }, [isAthlete, activeStudentId, event.id, dims.length]);

  const setEventDimensions = useCallback(
    async (action: EventFeedbackDimsAction): Promise<boolean> => {
      if (action.type === 'set') {
        const err = validateDimensions(action.dimensions);
        if (err) {
          toast.error(err);
          return false;
        }
      }
      try {
        await calendarApi.setEventFeedbackDimensions(event.id, action);
        const msg =
          action.type === 'inherit'
            ? 'Voltou a herdar as dimensões padrão.'
            : action.type === 'disable'
              ? 'Feedback desligado para este evento.'
              : 'Dimensões do evento salvas.';
        toast.success(msg);
        onChanged?.();
        return true;
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, 'Falha ao salvar.'));
        return false;
      }
    },
    [event.id, onChanged, toast],
  );

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const r = await calendarApi.getEventFeedbackReport(event.id);
      setReport(r);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, 'Falha ao carregar respostas.'));
    } finally {
      setReportLoading(false);
    }
  }, [event.id, toast]);

  const submitAthleteFeedback = useCallback(
    async (scores: Record<string, number>, notes: string): Promise<boolean> => {
      if (!activeStudentId) return false;
      if (Object.keys(scores).length === 0) {
        toast.error('Responda ao menos uma dimensão antes de enviar.');
        return false;
      }
      try {
        await calendarApi.submitAthleteEventFeedback(
          activeStudentId,
          event.id,
          { scores, notes },
        );
        setHasMyFeedback(true);
        toast.success('Feedback enviado.');
        onChanged?.();
        return true;
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, 'Falha ao enviar feedback.'));
        return false;
      }
    },
    [activeStudentId, event.id, onChanged, toast],
  );

  return {
    role,
    isAdmin,
    isAthlete,
    isStaff,
    canConfigure,
    canSeeReport,
    dims,
    overrideState,
    hasMyFeedback,
    myScores,
    myNotes,
    loadingMyFeedback,
    report,
    reportLoading,
    setEventDimensions,
    loadReport,
    submitAthleteFeedback,
    setMyScores,
    setMyNotes,
  };
}
