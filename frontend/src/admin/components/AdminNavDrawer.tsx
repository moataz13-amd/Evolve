import { useEffect, useRef, useCallback, type ReactNode } from 'react';

export function AdminNavDrawer({
  children,
  onClose,
}: {
  children: (close: () => void) => ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    ref.current?.classList.add('is-closing');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(onClose, reduceMotion ? 0 : 180);
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('[aria-label="Close admin navigation"]')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer.current);
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 851px)');
    const resize = () => {
      if (desktop.matches) close();
    };
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  }, [close]);

  return (
    <dialog
      ref={ref}
      className="admin-nav-drawer"
      id="admin-nav-drawer"
      aria-label="EVOLVE dashboard navigation"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          close();
      }}
    >
      {children(close)}
    </dialog>
  );
}
