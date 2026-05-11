import { useState } from 'react';
import type { FeedbackDimension } from '../../domain/feedback-dimensions';
import { FeedbackDimensionsEditor } from '../FeedbackDimensionsEditor';
import { Modal } from '../Modal';

type Props = {
  open: boolean;
  eventTitle: string;
  initialDimensions: FeedbackDimension[];
  busy: boolean;
  onClose: () => void;
  onSave: (next: FeedbackDimension[]) => Promise<boolean>;
  onInherit: () => Promise<boolean>;
  onDisable: () => Promise<boolean>;
};

/**
 * Modal puramente apresentacional usado pelo ADMIN para configurar as
 * dimensões de feedback de um evento específico. Suporta três ações:
 * salvar custom, herdar do tenant ou desligar para este evento. Não conhece
 * API: recebe as três callbacks como props.
 */
export function EventDimensionsEditorModal({
  open,
  eventTitle,
  initialDimensions,
  busy,
  onClose,
  onSave,
  onInherit,
  onDisable,
}: Props) {
  const [draft, setDraft] = useState<FeedbackDimension[]>(initialDimensions);
  if (!open) return null;

  return (
    <Modal open title={`Feedback de "${eventTitle}"`} onClose={onClose}>
      <div className="stack">
        <FeedbackDimensionsEditor
          value={draft}
          onChange={setDraft}
          helperText={
            "Personalize as dimensões deste evento. Use o botão 'Herdar do tenant' " +
            "para voltar ao padrão da escolinha, ou 'Desligar' para não pedir " +
            'feedback neste evento.'
          }
        />
        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void onInherit().then((ok) => {
                  if (ok) onClose();
                });
              }}
              disabled={busy}
            >
              Herdar do tenant
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void onDisable().then((ok) => {
                  if (ok) onClose();
                });
              }}
              disabled={busy}
            >
              Desligar neste evento
            </button>
          </div>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void onSave(draft).then((ok) => {
                  if (ok) onClose();
                });
              }}
              disabled={busy}
            >
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
