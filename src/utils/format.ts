/**
 * Formato de cifras para la interfaz, siempre con `Intl` y locale espanol:
 * antes se concatenaban cadenas a mano y el resultado dependia del navegador.
 */

const LOCALE = 'es-ES';

const countFormatter = new Intl.NumberFormat(LOCALE);

/** 1234 -> "1.234" */
export function formatCount(value: number): string {
  return countFormatter.format(value);
}

/** 95 -> "1:35"; 3725 -> "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(remaining)}` : `${minutes}:${pad(remaining)}`;
}

/** Tamanos de archivo legibles: 1536 -> "1,5 kB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  const formatter = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: value >= 10 || exponent === 0 ? 0 : 1,
  });
  return `${formatter.format(value)} ${units[exponent]}`;
}

/** Porcentaje con un decimal como maximo: 0.923 -> "92,3 %". */
export function formatPercent(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(clamped);
}

/** Cents de afinacion con signo explicito: 12 -> "+12 ¢". */
export function formatCents(cents: number): string {
  const rounded = Math.round(Number.isFinite(cents) ? cents : 0);
  return `${rounded > 0 ? '+' : ''}${rounded} ¢`;
}

/** Texto de duracion abreviado para la barra de estado en pantallas estrechas. */
export function formatCompactSummary(
  measures: number,
  notes: number,
  duration: string
): { compact: string; full: string } {
  return {
    compact: `${measures} c. · ${notes} n. · ${duration}`,
    full: `${formatCount(measures)} compases · ${formatCount(notes)} notas · ${duration}`,
  };
}
