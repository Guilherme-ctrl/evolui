import { useEffect, useState } from 'react';
import {
  sanitizeDimensionKey,
  validateDimensions as validateDimensionsCore,
  type FeedbackDimension as DomainFeedbackDimension,
} from '../domain/feedback-dimensions';

/**
 * Reexports de compatibilidade: outros arquivos importam `FeedbackDimension` e
 * `validateDimensions` daqui. O ponto de verdade agora é
 * `domain/feedback-dimensions.ts`; este componente é puramente apresentacional.
 */
export type FeedbackDimension = DomainFeedbackDimension;
export const validateDimensions = validateDimensionsCore;

type Props = {
  value: FeedbackDimension[];
  onChange: (next: FeedbackDimension[]) => void;
  /** Limite de dimensões. Default 5 (alinhado com backend). */
  max?: number;
  /** Texto opcional de ajuda exibido no topo. */
  helperText?: string;
};

/**
 * Editor reutilizável de dimensões de feedback físico (1-5). Lista editável de
 * `{ key, label, order }` com chips, reordenação ↑↓ e botão de remover. Sem
 * estado interno persistente — controlado pelo pai via `value/onChange` para
 * casar com formulários maiores (modal de evento, preferências do tenant,
 * editor de Workout). A validação final fica no backend (slug, unique key,
 * tamanho ≤ max); este componente faz o lifting básico de UX (sanitiza key
 * enquanto digita, bloqueia adicionar acima do limite).
 */
export function FeedbackDimensionsEditor({
  value,
  onChange,
  max = 5,
  helperText,
}: Props) {
  // Espelho local apenas para garantir ordem normalizada ao mudar de fora.
  const [items, setItems] = useState<FeedbackDimension[]>(
    value.map((d, i) => ({ ...d, order: i })),
  );

  useEffect(() => {
    setItems(value.map((d, i) => ({ ...d, order: i })));
  }, [value]);

  function commit(next: FeedbackDimension[]) {
    const normalized = next.map((d, i) => ({ ...d, order: i }));
    setItems(normalized);
    onChange(normalized);
  }

  function add() {
    if (items.length >= max) return;
    commit([
      ...items,
      { key: `dim_${items.length + 1}`, label: '', order: items.length },
    ]);
  }

  function remove(idx: number) {
    commit(items.filter((_, i) => i !== idx));
  }

  function move(idx: number, delta: -1 | 1) {
    const j = idx + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  }

  function setLabel(idx: number, label: string) {
    commit(items.map((it, i) => (i === idx ? { ...it, label } : it)));
  }

  function setKey(idx: number, raw: string) {
    const sanitized = sanitizeDimensionKey(raw);
    commit(items.map((it, i) => (i === idx ? { ...it, key: sanitized } : it)));
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      {helperText ? (
        <p className="text-caption muted" style={{ margin: 0 }}>
          {helperText}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Nenhuma dimensão configurada. Os alunos não verão o pedido de feedback.
        </p>
      ) : (
        <ul
          className="stack"
          style={{
            listStyle: 'none',
            padding: 0,
            gap: 'var(--space-2)',
            margin: 0,
          }}
        >
          {items.map((d, i) => (
            <li
              key={i}
              className="row"
              style={{
                gap: 'var(--space-2)',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                className="input"
                placeholder="Nome (ex: Desgaste físico)"
                value={d.label}
                onChange={(e) => setLabel(i, e.target.value)}
                maxLength={40}
                style={{ flex: '2 1 220px' }}
              />
              <input
                className="input"
                placeholder="key"
                value={d.key}
                onChange={(e) => setKey(i, e.target.value)}
                maxLength={31}
                style={{ flex: '1 1 140px', fontFamily: 'monospace' }}
              />
              <div className="row" style={{ gap: 4 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  title="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => remove(i)}
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={add}
          disabled={items.length >= max}
        >
          + Adicionar dimensão {items.length >= max ? `(máx ${max})` : ''}
        </button>
      </div>
    </div>
  );
}
