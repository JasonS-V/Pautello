/**
 * Modo sin conexión del build web.
 *
 * El service worker (`dist/sw.js`, generado en el build) precarga la app para
 * que funcione sin red. No siempre se puede ni se debe registrar:
 *   - En Electron el contenido se carga desde `file://`, donde no existen los
 *     service workers; intentarlo solo ensucia la consola.
 *   - En desarrollo el servidor de Vite sirve módulos sueltos con HMR: cachear
 *     eso deja la app sirviendo código viejo.
 */

export interface OfflineEnvironment {
  /** Build de producción (`import.meta.env.PROD`). */
  isProductionBuild: boolean;
  /** `window.location.protocol`, por ejemplo `https:`. */
  protocol: string;
  supportsServiceWorker: boolean;
}

/** Decide si este entorno puede y debe usar el service worker. */
export function canRegisterOfflineSupport({
  isProductionBuild,
  protocol,
  supportsServiceWorker,
}: OfflineEnvironment): boolean {
  return isProductionBuild && supportsServiceWorker && /^https?:$/.test(protocol);
}

/** Registra el service worker si el entorno lo permite. Nunca lanza. */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  const allowed = canRegisterOfflineSupport({
    isProductionBuild: import.meta.env.PROD,
    protocol: window.location.protocol,
    supportsServiceWorker: 'serviceWorker' in navigator,
  });
  if (!allowed) return;

  window.addEventListener('load', () => {
    // Ruta relativa: el build usa `base: './'` y puede servirse desde un
    // subdirectorio, así que el ámbito del worker es el de su propio archivo.
    navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
      console.warn('No se pudo activar el modo sin conexión:', error);
    });
  });
}
