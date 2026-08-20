"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info";

type ToastInput = {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type Toast = Required<Pick<ToastInput, "type" | "message" | "duration">> & {
  id: number;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  showToast: (toast: ToastInput | string, type?: ToastType) => void;
  addToast: (toast: ToastInput | string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toastLabels: Record<ToastType, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Notice",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput | string, type: ToastType = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const nextToast: Toast = typeof toast === "string"
      ? { id, type, title: toastLabels[type], message: toast, duration: 4200 }
      : {
          id,
          type: toast.type || type,
          title: toast.title,
          message: toast.message,
          duration: toast.duration ?? 4200,
          actionLabel: toast.actionLabel,
          onAction: toast.onAction,
        };

    setToasts((current) => [nextToast, ...current].slice(0, 5));
    if (nextToast.duration > 0) {
      window.setTimeout(() => dismissToast(id), nextToast.duration);
    }
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, addToast: showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <article key={toast.id} className={`app-toast ${toast.type}`}>
            <span aria-hidden="true" />
            <div>
              <b>{toast.title || toastLabels[toast.type]}</b>
              <p>{toast.message}</p>
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    toast.onAction?.();
                    dismissToast(toast.id);
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
              x
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
