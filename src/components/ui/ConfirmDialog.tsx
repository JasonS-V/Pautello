import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from './icons';
import { ModalBase } from './ModalBase';
import { modalButton } from './modalButton';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  /** Consecuencias concretas que se muestran al usuario antes de decidir. */
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmacion de acciones destructivas en dos pasos, dentro de la capa modal.
 * Sustituye a `window.confirm`, que ignora el tema, no se puede estilizar y en
 * Electron congela la ventana.
 *
 * Paso 1: se explica que se va a perder y el boton lleva al paso 2.
 * Paso 2: confirmacion final con el verbo explicito de la accion.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  details,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Cada apertura empieza en el paso 1: nunca se confirma en dos clics seguidos.
  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);

  const toneClasses =
    tone === 'danger'
      ? {
          icon: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
          button: modalButton.danger,
        }
      : {
          icon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          button: modalButton.primary,
        };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} ariaLabel={title} maxWidth="max-w-md">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses.icon}`}
          aria-hidden="true"
        >
          <AlertTriangle className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>

          {details && details.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-studio-border dark:bg-studio-surface">
              {details.map((detail) => (
                <li
                  key={detail}
                  className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"
                >
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}

          {step === 2 && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Esta acción no se puede deshacer con Ctrl+Z.
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className={modalButton.secondary}>
              <X className="w-3.5 h-3.5" />
              {step === 2 ? 'Volver' : cancelLabel}
            </button>
            {step === 1 ? (
              <button type="button" onClick={() => setStep(2)} className={toneClasses.button}>
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={toneClasses.button}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalBase>
  );
};
