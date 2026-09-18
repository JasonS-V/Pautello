import { es, type Copy } from './es';

export type { Copy };

/** Idiomas disponibles. Hoy solo espanol; anadir uno es anadir su diccionario. */
const DICTIONARIES: Record<string, Copy> = { es };

export const AVAILABLE_LANGUAGES = Object.keys(DICTIONARIES);
export const DEFAULT_LANGUAGE = 'es';

/**
 * Copia de la interfaz en el idioma activo. Se lee como `t.storage.failedTitle`
 * (con autocompletado y error de compilacion si la clave no existe).
 */
export function getCopy(language: string = DEFAULT_LANGUAGE): Copy {
  return DICTIONARIES[language] ?? es;
}

export const t: Copy = getCopy();
