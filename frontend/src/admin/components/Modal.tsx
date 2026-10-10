import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="admin-modal-heading">
        <h2>{title}</h2>
        <button type="button" className="admin-icon" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  copy,
  pending,
  onClose,
  onConfirm,
}: {
  title: string;
  copy?: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>
        {copy ||
          'This action may affect the storefront and existing references. Referenced records cannot be deleted.'}
      </p>
      <div className="admin-actions">
        <button className="admin-button" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button className="admin-button admin-primary" onClick={onConfirm} disabled={pending}>
          {pending ? 'Working…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
