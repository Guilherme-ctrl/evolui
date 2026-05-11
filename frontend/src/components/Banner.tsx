import type { HTMLAttributes, ReactNode } from 'react';

export type BannerVariant = 'info' | 'warning' | 'danger';

export type BannerProps = {
  variant: BannerVariant;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export function Banner({
  variant,
  children,
  onDismiss,
  dismissLabel = 'Dispensar aviso',
  className = '',
  ...rest
}: BannerProps) {
  const role = variant === 'danger' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={`banner banner--${variant} ${className}`.trim()}
      {...rest}
    >
      <div className="banner__content">{children}</div>
      {onDismiss ? (
        <button type="button" className="btn btn-ghost banner__dismiss" onClick={onDismiss}>
          {dismissLabel}
        </button>
      ) : null}
    </div>
  );
}
