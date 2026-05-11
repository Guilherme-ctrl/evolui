import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastContextValue, type ToastVariant } from './toast-context-internal';

type ToastItem = { id: string; variant: ToastVariant; message: string };

const DISMISS_MS = 4500;

/** `crypto.randomUUID` exige contexto seguro (HTTPS); em HTTP pode faltar e derrubar o app ao exibir toast. */
function newToastId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(item.id), DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [item.id, onDismiss]);

  const role = item.variant === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={`toast toast--${item.variant}`}
      onClick={() => onDismiss(item.id)}
    >
      {item.message}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((variant: ToastVariant, message: string) => {
    const text = message.trim() || ' ';
    const id = newToastId();
    setItems((prev) => [...prev, { id, variant, message: text }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m) => show('success', m),
      error: (m) => show('error', m),
      info: (m) => show('info', m),
    }),
    [show],
  );

  const stack =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
            {items.map((item) => (
              <ToastView key={item.id} item={item} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {stack}
    </ToastContext.Provider>
  );
}
