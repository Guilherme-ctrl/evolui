import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

export type ModalProps = {
  open: boolean;
  titleId?: string;
  descriptionId?: string;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Backdrop click closes (default true). */
  closeOnBackdrop?: boolean;
  /** Escape closes (default true). */
  closeOnEscape?: boolean;
};

function collectFocusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll<HTMLElement>(sel)].filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  );
}

export function Modal({
  open,
  titleId: titleIdProp,
  descriptionId,
  onClose,
  title,
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const autoTitleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const titleId = titleIdProp ?? autoTitleId;

  /** Só depende de `open` / `closeOnEscape`: `onClose` costuma ser inline no pai e mudaria a cada tecla, refocando o 1º controle e roubando o foco do textarea. */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = collectFocusables(panel);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const focusTimer = window.setTimeout(() => first?.focus(), 0);

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closeOnEscape]);

  if (!open) return null;

  function onBackdropClick(e: ReactMouseEvent) {
    if (e.target !== e.currentTarget) return;
    if (closeOnBackdrop) onClose();
  }

  function onPanelKeyDown(e: ReactKeyboardEvent) {
    e.stopPropagation();
  }

  return createPortal(
    <div
      className="ds-modal-backdrop"
      role="presentation"
      onMouseDown={onBackdropClick}
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
    >
      <div
        ref={panelRef}
        className="ds-modal-panel card card--lg stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <div className="ds-modal__head">
          <h2 id={titleId} className="text-h3" style={{ margin: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-ghost ds-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="ds-modal__body stack">{children}</div>
        {footer ? <div className="ds-modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
