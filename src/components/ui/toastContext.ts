import { createContext, useContext } from 'react';

/**
 * Estado compartido del sistema de avisos. Vive aparte de `Toast.tsx` por dos
 * motivos: el proveedor queda como un módulo que solo exporta componentes (lo
 * que exige Fast Refresh) y quien consume avisos no arrastra el proveedor.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  message?: string;
  action?: ToastAction;
  /** 0 mantiene el aviso hasta que el usuario lo cierre. */
  durationMs?: number;
}

export interface ToastRecord extends ToastInput {
  id: string;
  tone: ToastTone;
  durationMs: number;
}

export interface ToastApi {
  show: (input: ToastInput) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string, action?: ToastAction) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

const noopApi: ToastApi = {
  show: () => '',
  dismiss: () => {},
  success: () => '',
  error: () => '',
  warning: () => '',
  info: () => '',
};

/**
 * Acceso a los avisos. Fuera del proveedor devuelve una implementacion vacia:
 * un componente no debe romperse por no poder avisar de algo.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noopApi;
}
