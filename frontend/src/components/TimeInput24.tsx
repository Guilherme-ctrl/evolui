import { useEffect, useState, type ChangeEvent } from 'react';

export type TimeInput24Props = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
};

/**
 * Input de horário **24h** com máscara `HH:MM`.
 *
 * Por que não `<input type="time">`? O Chrome/Safari escolhem 12h vs 24h
 * pela preferência do **navegador/SO**, não pelo `lang` do input — em
 * macOS com região "United States" eles renderizam AM/PM mesmo com
 * `lang="pt-BR"`. Para honrar a regra de produto "horário sempre em 24h",
 * usamos um input de texto com máscara controlada.
 *
 * - Aceita apenas dígitos; insere `:` automaticamente após o 2º dígito.
 * - Clamp em `00:00..23:59` quando o usuário digita números fora do range.
 * - Valor exposto via `onChange` segue o mesmo contrato que `<input type="time">`
 *   tinha antes: `"HH:MM"` (string vazia enquanto incompleto).
 */
export function TimeInput24({
  value,
  onChange,
  required,
  disabled,
  id,
  name,
  className,
  ...aria
}: TimeInput24Props) {
  const [draft, setDraft] = useState<string>(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  function formatDigits(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length === 0) return '';

    let hh = digits.slice(0, 2);
    let mm = digits.slice(2, 4);

    // Auto-clamp parcial enquanto digita: se primeiro dígito >= 3, força "0X"
    // para o usuário não ficar travado (ex.: ao digitar "9" vira "09").
    if (hh.length === 1 && Number(hh) > 2) hh = `0${hh}`;
    if (hh.length === 2) {
      const n = Number(hh);
      if (n > 23) hh = '23';
    }
    if (mm.length === 2) {
      const n = Number(mm);
      if (n > 59) mm = '59';
    }

    return mm.length > 0 ? `${hh}:${mm}` : hh;
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = formatDigits(e.target.value);
    setDraft(next);
    // Só propaga quando completo (HH:MM) ou vazio — mantém compatibilidade
    // com o contrato anterior de input type="time".
    if (next === '' || /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(next)) {
      onChange(next);
    }
  }

  function handleBlur() {
    // No blur, normaliza valor parcial: completa com "00" se faltar minutos.
    if (draft.length === 0) {
      onChange('');
      return;
    }
    let normalized = draft;
    const digitsOnly = draft.replace(/\D/g, '');
    if (digitsOnly.length === 1) normalized = `0${digitsOnly}:00`;
    else if (digitsOnly.length === 2) normalized = `${digitsOnly}:00`;
    else if (digitsOnly.length === 3)
      normalized = `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2)}0`;
    normalized = formatDigits(normalized);
    if (/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(normalized)) {
      setDraft(normalized);
      onChange(normalized);
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
      placeholder="HH:MM"
      maxLength={5}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      required={required}
      disabled={disabled}
      id={id}
      name={name}
      className={`time-input-24 ${className ?? ''}`.trim()}
      aria-label={aria['aria-label']}
    />
  );
}
