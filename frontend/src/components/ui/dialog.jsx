import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onClose, children }) {
  const backdropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose?.(); }}
    >
      {children}
    </div>
  );
}

export function DialogContent({ className, children, onClose, title }) {
  return (
    <div className={cn('relative w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-700', className)}>
      {(title || onClose) && (
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          {title && <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
          {onClose && (
            <button onClick={onClose} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
