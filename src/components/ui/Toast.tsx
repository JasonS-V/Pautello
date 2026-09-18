import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, X, AlertOctagon } from './icons';
import {
  ToastContext,
  type ToastApi,
  type ToastInput,
  type ToastRecord,
  type ToastTone,
} from './toastContext';

/**
 * Sistema de avisos de la aplicacion. Existe porque hasta ahora cualquier fallo
 * (cuota de almacenamiento agotada, exportacion imposible, enlace ilegible)
 * terminaba en `console.error`: el usuario creia haber guardado y no era asi.
 *
 * Reglas:
 * - Capa `z-toast`, por encima de modales y del tour.
 * - `role="alert"` para errores (se anuncia de inmediato), `role="status"` para
 *   el resto (se anuncia cuando el lector termina lo que estaba leyendo).
 * - Como maximo cuatro avisos simultaneos; los mas antiguos se descartan.
 * - El temporizador se pausa mientras el puntero esta encima del aviso.
 */

export const MAX_VISIBLE_TOASTS = 4;
const DEFAULT_DURATION_MS = 4200;
const ERROR_DURATION_MS = 8000;

const toneStyles: Record<ToastTone, { icon: React.ReactNode; ring: string; badge: string }> = {
  success: {
    icon: <Check className="w-4 h-4" />,
    ring: 'ring-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: <AlertOctagon className="w-4 h-4" />,
    ring: 'ring-rose-500/30',
    badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    ring: 'ring-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    ring: 'ring-sky-500/30',
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
};

let toastSequence = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, durationMs: number) => {
      if (durationMs <= 0) return;
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs)
      );
    },
    [dismiss]
  );

  const show = useCallback(
    (input: ToastInput) => {
      toastSequence += 1;
      const id = `toast-${toastSequence}`;
      const tone = input.tone ?? 'info';
      const record: ToastRecord = {
        ...input,
        id,
        tone,
        durationMs:
          input.durationMs ?? (tone === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS),
      };
      setToasts((prev) => [...prev, record].slice(-MAX_VISIBLE_TOASTS));
      scheduleDismiss(id, record.durationMs);
      return id;
    },
    [scheduleDismiss]
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, message) => show({ tone: 'success', title, message }),
      error: (title, message, action) => show({ tone: 'error', title, message, action }),
      warning: (title, message) => show({ tone: 'warning', title, message }),
      info: (title, message) => show({ tone: 'info', title, message }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="no-print fixed bottom-4 right-4 z-toast flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
            aria-live="polite"
          >
            {toasts.map((toast) => {
              const styles = toneStyles[toast.tone];
              return (
                <div
                  key={toast.id}
                  role={toast.tone === 'error' ? 'alert' : 'status'}
                  onMouseEnter={() => {
                    const timer = timersRef.current.get(toast.id);
                    if (timer) {
                      clearTimeout(timer);
                      timersRef.current.delete(toast.id);
                    }
                  }}
                  onMouseLeave={() => scheduleDismiss(toast.id, toast.durationMs)}
                  className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-studio-dropdown ring-1 backdrop-blur-sm dark:border-studio-border dark:bg-studio-card/95 animate-toast-in ${styles.ring}`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${styles.badge}`}
                    aria-hidden="true"
                  >
                    {styles.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {toast.title}
                    </p>
                    {toast.message && (
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        {toast.message}
                      </p>
                    )}
                    {toast.action && (
                      <button
                        type="button"
                        onClick={() => {
                          toast.action?.onAction();
                          dismiss(toast.id);
                        }}
                        className="mt-2 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-100 active:scale-95 dark:border-studio-line dark:text-slate-200 dark:hover:bg-studio-hover"
                      >
                        {toast.action.label}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="Cerrar aviso"
                    className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-90 dark:hover:bg-studio-hover dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};
