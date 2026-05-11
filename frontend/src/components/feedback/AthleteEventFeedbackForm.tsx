import { useState } from 'react';
import type { FeedbackDimension } from '../../domain/feedback-dimensions';
import { Modal } from '../Modal';

type Props = {
  eventTitle: string;
  dims: FeedbackDimension[];
  /** Pode ter resposta vazia (primeiro envio) ou pré-preenchida. */
  initialScores: Record<string, number>;
  initialNotes: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    scores: Record<string, number>,
    notes: string,
  ) => Promise<boolean>;
};

/**
 * Modal puramente apresentacional para o ATLETA enviar/editar o feedback de um
 * evento de calendário. Estado local controla os botões 1-5 por dimensão e o
 * textarea de notas. Não conhece API: recebe `onSubmit` que devolve `true` se
 * a operação foi bem-sucedida (e nesse caso o modal fecha).
 */
export function AthleteEventFeedbackForm({
  eventTitle,
  dims,
  initialScores,
  initialNotes,
  open,
  onClose,
  onSubmit,
}: Props) {
  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    try {
      const ok = await onSubmit(scores, notes.trim());
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  function setScore(key: string, value: number) {
    setScores((s) => ({ ...s, [key]: value }));
  }

  function clearScore(key: string) {
    setScores((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
  }

  return (
    <Modal open title={`Como foi "${eventTitle}"?`} onClose={onClose}>
      <div className="stack">
        <p className="text-caption muted">
          Avalie de 1 (muito leve) a 5 (muito intenso) cada item abaixo. Você
          pode reabrir e ajustar a qualquer momento.
        </p>
        {dims.map((d) => {
          const value = scores[d.key];
          return (
            <div key={d.key} className="stack" style={{ gap: 'var(--space-1)' }}>
              <div
                className="row"
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <strong>{d.label}</strong>
                <span className="text-caption muted">{value ?? '—'}</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={value === n ? 'btn btn-primary' : 'btn btn-ghost'}
                    style={{ flex: 1 }}
                    onClick={() => setScore(d.key, n)}
                  >
                    {n}
                  </button>
                ))}
                {value != null ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    title="Limpar"
                    onClick={() => clearScore(d.key)}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        <label className="stack">
          <span className="muted">Comentário (opcional)</span>
          <textarea
            className="input"
            rows={3}
            maxLength={280}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: dor no joelho, gostei da intensidade…"
          />
        </label>
        <div
          className="row"
          style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}
        >
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
