import type { ReactNode } from 'react';
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <span className="admin-eyebrow">EVOLVE / OPERATIONS</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="admin-actions">{children}</div>
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div className="admin-skeleton" role="status" aria-label="Loading">
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}
export function EmptyState({
  title,
  copy,
  children,
}: {
  title: string;
  copy?: string;
  children?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
      {children}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="admin-error-panel" role="alert">
      <h2>Unable to load this view.</h2>
      <p>{message}</p>
      {retry && (
        <button className="admin-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function StatusBadge({ value }: { value: unknown }) {
  const label = typeof value === 'boolean' ? (value ? 'Active' : 'Inactive') : String(value ?? '—');
  return (
    <span
      className={`admin-status ${['low stock', 'out of stock', 'cancelled', 'failed'].includes(label) ? 'admin-status-warning' : ''}`}
    >
      {label.replaceAll('_', ' ')}
    </span>
  );
}
export function Pagination({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / 20));
  return (
    <div className="admin-pagination">
      <span>
        {count} records · Page {page} of {pages}
      </span>
      <div className="admin-actions">
        <button className="admin-button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button
          className="admin-button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
