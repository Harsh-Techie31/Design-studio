import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = "max-w-md",
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col ${maxWidthClass} rounded-xl bg-surface shadow-2xl animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <h2 className="font-display text-lg font-semibold tracking-tight text-bone">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted transition-colors hover:text-accent"
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pt-4 pb-6">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
