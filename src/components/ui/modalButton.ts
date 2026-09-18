/**
 * Jerarquía de acciones compartida de los modales (ver `ModalChrome.tsx`):
 * - `primary`: una sola por modal; usa el acento editorial ámbar.
 * - `secondary`: alternativas neutras (cerrar, volver, cambiar archivo).
 * - `danger`: acciones destructivas. Nunca conviven con una primaria en el
 *   mismo pie; los flujos de eliminación se confirman con `ConfirmDialog`.
 */
const baseButton =
  'inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none';

export const modalButton = {
  primary: `${baseButton} bg-studio-accent hover:bg-amber-600 dark:hover:bg-amber-400 text-slate-950 shadow-xs`,
  secondary: `${baseButton} bg-slate-100 hover:bg-slate-200 dark:bg-studio-hover dark:hover:bg-studio-lineSoft text-slate-700 dark:text-slate-300`,
  danger: `${baseButton} bg-rose-600 hover:bg-rose-500 text-white shadow-xs`,
} as const;
