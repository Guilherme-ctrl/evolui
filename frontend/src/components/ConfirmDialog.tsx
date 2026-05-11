import { useEffect, useId, useState, type ReactNode } from 'react';
import { runDeferredEffect } from '../lib/run-deferred';
import { Modal } from './Modal';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /** Optional text field (e.g. cancel reason). */
  prompt?: {
    label: string;
    placeholder?: string;
    optional?: boolean;
  };
  onConfirm: (promptValue?: string) => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  busy,
  prompt,
  onConfirm,
}: ConfirmDialogProps) {
  const [value, setValue] = useState('');
  const descId = useId();

  useEffect(() => {
    if (open) return;
    return runDeferredEffect(() => setValue(''));
  }, [open]);

  async function handleConfirm() {
    await onConfirm(prompt ? value.trim() : undefined);
  }

  const footer = (
    <div className="ds-modal__actions">
      <button
        type="button"
        className="btn btn-ghost"
        disabled={busy}
        onClick={() => onOpenChange(false)}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        className={danger ? 'btn btn-danger' : 'btn btn-primary'}
        disabled={busy}
        onClick={() => void handleConfirm()}
      >
        {busy ? 'Aguarde…' : confirmLabel}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={() => !busy && onOpenChange(false)}
      title={title}
      descriptionId={description ? descId : undefined}
      footer={footer}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      {description ? (
        <div id={descId} className="text-body">
          {description}
        </div>
      ) : null}
      {prompt ? (
        <label className="stack">
          <span className="muted">{prompt.label}</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={prompt.placeholder}
            disabled={busy}
            autoComplete="off"
          />
        </label>
      ) : null}
    </Modal>
  );
}
