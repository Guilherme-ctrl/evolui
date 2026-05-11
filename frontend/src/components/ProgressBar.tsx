export type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  /** Visually hidden label for screen readers when `label` is decorative. */
  ariaLabel?: string;
  className?: string;
};

export function ProgressBar({
  value,
  max = 100,
  label,
  ariaLabel,
  className = '',
}: ProgressBarProps) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((100 * value) / max)));
  const idLabel = ariaLabel ?? label;

  return (
    <div className={`progress-bar-wrap ${className}`.trim()}>
      {(label || ariaLabel) && (
        <div className="progress-bar-wrap__label row" style={{ justifyContent: 'space-between' }}>
          {label ? <span className="text-caption muted">{label}</span> : null}
          <span className="text-caption tabular-nums muted" aria-hidden={!!ariaLabel}>
            {pct}%
          </span>
        </div>
      )}
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={idLabel}
      >
        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
