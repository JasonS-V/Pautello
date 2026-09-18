/**
 * Registro local de fallos de la interfaz.
 *
 * Pautello no tiene cuentas ni telemetría, así que cuando la app se rompe el
 * usuario pierde el único rastro que existe: el `console.error` desaparece al
 * recargar. Aquí se guarda en `localStorage` un resumen (cuántos fallos, cuándo
 * empezaron, el último mensaje y la pila de componentes) que el `ErrorBoundary`
 * ofrece copiar para pegarlo en un informe.
 *
 * Nada sale del navegador: no hay red en este módulo, por diseño.
 */

export const ERROR_LOG_KEY = 'pautello_error_log';

/** El mensaje guardado se recorta para no llenar la cuota con una traza enorme. */
const MAX_MESSAGE_CHARS = 500;
const MAX_COMPONENT_STACK_CHARS = 2000;

export interface ErrorLogLast {
  message: string;
  componentStack: string | null;
  at: number;
}

export interface ErrorLog {
  /** Fallos acumulados en este navegador. */
  failures: number;
  firstAt: number;
  lastAt: number;
  last: ErrorLogLast;
}

export interface DiagnosticInput {
  error: Error;
  log: ErrorLog | null;
  /** Tamaño en caracteres del autoguardado, o `null` si no hay nada guardado. */
  storedScoreChars: number | null;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Almacenamiento bloqueado o no disponible.
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function trim(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function parse(raw: string | null): ErrorLog | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.last)) return null;

    const { failures, firstAt, lastAt, last } = parsed;
    if (typeof failures !== 'number' || typeof last.message !== 'string') return null;

    const at = typeof last.at === 'number' ? last.at : 0;
    return {
      failures,
      firstAt: typeof firstAt === 'number' ? firstAt : at,
      lastAt: typeof lastAt === 'number' ? lastAt : at,
      last: {
        message: last.message,
        componentStack: typeof last.componentStack === 'string' ? last.componentStack : null,
        at,
      },
    };
  } catch {
    // Registro corrupto: se ignora y se empieza de nuevo al siguiente fallo.
    return null;
  }
}

/** Registro actual, o `null` si no hay ninguno o no se puede leer. */
export function readErrorLog(): ErrorLog | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return parse(storage.getItem(ERROR_LOG_KEY));
  } catch {
    return null;
  }
}

/**
 * Suma un fallo al registro y devuelve el estado resultante. Nunca lanza: si el
 * almacenamiento está lleno o bloqueado, el informe se genera igual con los
 * datos que se devuelven aquí.
 */
export function recordFailure(error: Error, componentStack?: string | null): ErrorLog {
  const now = Date.now();
  const previous = readErrorLog();

  const log: ErrorLog = {
    failures: (previous?.failures ?? 0) + 1,
    firstAt: previous?.firstAt ?? now,
    lastAt: now,
    last: {
      message: trim(error.message || String(error), MAX_MESSAGE_CHARS),
      componentStack: componentStack ? trim(componentStack, MAX_COMPONENT_STACK_CHARS) : null,
      at: now,
    },
  };

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(ERROR_LOG_KEY, JSON.stringify(log));
    } catch {
      // Sin espacio: el registro vive solo en memoria mientras dure la sesión.
    }
  }

  return log;
}

/** Borra el registro (por ejemplo si el usuario ya reportó el fallo). */
export function clearErrorLog(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(ERROR_LOG_KEY);
  } catch {
    // Almacenamiento no disponible.
  }
}

function describeEnvironment(): string[] {
  if (typeof navigator === 'undefined') return [];

  const lines = [`Navegador: ${navigator.userAgent}`];
  if (navigator.language) lines.push(`Idioma: ${navigator.language}`);

  // Solo origen y ruta: el hash puede llevar una partitura compartida entera y
  // no hace falta para diagnosticar.
  try {
    if (typeof window !== 'undefined' && window.location) {
      lines.push(`Pantalla: ${window.location.origin}${window.location.pathname}`);
      lines.push(`Ventana: ${window.innerWidth}×${window.innerHeight}`);
    }
  } catch {
    // Entorno sin `location`.
  }

  return lines;
}

/**
 * Informe en texto plano listo para pegar en un informe de fallo. Se compone
 * solo con datos del propio navegador.
 */
export function buildDiagnosticReport({ error, log, storedScoreChars }: DiagnosticInput): string {
  const lines: string[] = [
    'Pautello — informe de diagnóstico',
    `Generado: ${new Date().toISOString()}`,
  ];

  if (log) {
    lines.push(
      `Fallos registrados en este navegador: ${log.failures}`,
      `Primer fallo: ${new Date(log.firstAt).toISOString()}`,
      `Último fallo: ${new Date(log.lastAt).toISOString()}`
    );
  } else {
    lines.push('Fallos registrados en este navegador: sin registro');
  }

  lines.push(
    `Partitura autoguardada: ${
      storedScoreChars === null ? 'ninguna' : `${storedScoreChars} caracteres`
    }`
  );

  const stack = error.stack ?? `${error.name}: ${error.message}`;
  lines.push('', 'Error:', error.message || String(error), '', 'Pila:', stack);

  if (log?.last.componentStack) {
    lines.push('', 'Componentes:', log.last.componentStack);
  }

  const environment = describeEnvironment();
  if (environment.length > 0) {
    lines.push('', ...environment);
  }

  lines.push('', 'Este informe se ha generado en local y no se ha enviado a ningún servidor.');

  return lines.join('\n');
}
