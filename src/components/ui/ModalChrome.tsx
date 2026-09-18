import React from 'react';
import { X } from './icons';

/**
 * Patrón compartido de composición para todos los modales de Pautello
 * (plan de mejora visual, tarea 7):
 *
 *   <ModalBase>
 *     <ModalHeader icon={…} title="…" subtitle="…" onClose={onClose} />
 *     …contenido…
 *     <ModalFooter hint={…opcional…}>
 *       <button className={modalButton.secondary}>Cancelar</button>
 *       <button className={modalButton.primary}>Acción principal</button>
 *     </ModalFooter>
 *   </ModalBase>
 *
 * Las clases de acción (`modalButton.primary | secondary | danger`) viven en
 * `./modalButton.ts`; los flujos destructivos se confirman con
 * `ConfirmDialog`, la "zona de peligro" de dos pasos de la aplicación.
 */

interface ModalHeaderProps {
  /** Icono semántico del panel; decorativo, la accesibilidad la da el título. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Acciones extra junto al botón de cierre (pestañas, refrescar, badges…). */
  actions?: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  /** Quita el margen inferior cuando el contenido ya gestiona su separación. */
  flush?: boolean;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  icon,
  title,
  subtitle,
  actions,
  onClose,
  closeLabel = 'Cerrar ventana',
  flush = false,
  className = '',
}) => (
  <div
    className={`flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-studio-border ${flush ? '' : 'mb-4'} ${className}`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && (
        <span
          aria-hidden="true"
          className="w-8 h-8 rounded-xl bg-studio-accent/10 dark:bg-studio-accent/15 text-amber-700 dark:text-studio-accent flex items-center justify-center shrink-0"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="font-bold text-base leading-tight text-slate-900 dark:text-white truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>
        )}
      </div>
    </div>

    <div className="flex items-center gap-2 shrink-0">
      {actions}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-studio-hover transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

interface ModalFooterProps {
  /** Nota informativa a la izquierda (estado, ayuda breve). */
  hint?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ hint, children, className = '' }) => (
  <div
    className={`mt-5 pt-3 border-t border-slate-200 dark:border-studio-border flex items-center gap-2 ${
      hint ? 'justify-between' : 'justify-end'
    } ${className}`}
  >
    {hint && <div className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0">{hint}</div>}
    {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
  </div>
);
