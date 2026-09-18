import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nombre accesible del diálogo (se anuncia al abrirlo con lector de pantalla). */
  ariaLabel: string;
  /** Ancho máximo del panel (p. ej. 'max-w-md', 'max-w-xl'). */
  maxWidth?: string;
  /**
   * Recorta el panel con overflow-hidden. Úsalo cuando el contenido lleva
   * decoraciones absolutas (halos de color) que no deben desbordarse; como el
   * panel deja de hacer scroll, el contenido largo debe traer su propio scroll.
   */
  clipPanel?: boolean;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Capa modal única de la aplicación (Fase 0 del plan de UI `PLAN_MEJORA_UI.md`):
 * - Renderiza mediante portal sobre document.body, en la capa z-modal.
 * - Escape cierra el modal, salvo que haya un menú/listbox abierto dentro (para
 *   no pisar el cierre propio de Dropdown/CustomSelect).
 * - Trampa de foco con Tab / Shift+Tab y devolución del foco al elemento que
 *   abrió el modal.
 * - Bloquea el scroll del body mientras está abierta.
 */
export const ModalBase: React.FC<ModalBaseProps> = ({
  isOpen,
  onClose,
  ariaLabel,
  maxWidth = 'max-w-lg',
  clipPanel = false,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Si hay un menú o listbox abierto dentro del panel, su propio
        // controlador se encarga de cerrarlo; el modal permanece abierto.
        if (panel?.querySelector('[role="listbox"], [role="menu"]')) return;
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active && !panel.contains(active)) {
        // El foco se escapó del panel (p. ej. al body): devolverlo al inicio.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-fade-in no-print"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} ${
          clipPanel ? 'overflow-hidden' : 'max-h-[90vh] overflow-y-auto'
        } bg-white dark:bg-studio-card text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-studio-border shadow-2xl p-6 outline-none animate-modal-pop`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
