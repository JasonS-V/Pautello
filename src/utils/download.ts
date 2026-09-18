/**
 * Entrega de archivos al usuario. En el navegador se dispara una descarga; en
 * la app de escritorio se prefiere el dialogo nativo de guardado para que el
 * usuario elija carpeta y nombre (ver `electron/preload.cjs`).
 */

export interface SaveFileResult {
  ok: boolean;
  /** El usuario cerro el dialogo nativo sin guardar. */
  cancelled?: boolean;
  path?: string;
  error?: unknown;
}

/** API que expone el proceso principal de Electron a la ventana. */
export interface PautelloDesktopBridge {
  saveFile: (options: {
    defaultFileName: string;
    mimeType: string;
    data: ArrayBuffer | Uint8Array | string;
  }) => Promise<SaveFileResult>;
  printToPdf: (options: { defaultFileName: string }) => Promise<SaveFileResult>;
  platform: string;
  version: string;
}

/** Alias heredados de nombres anteriores; se conservan por compatibilidad. */
export type StavioDesktopBridge = PautelloDesktopBridge;
export type SonataDesktopBridge = PautelloDesktopBridge;

declare global {
  interface Window {
    pautello?: PautelloDesktopBridge;
    stavio?: PautelloDesktopBridge;
    sonata?: PautelloDesktopBridge;
  }
}

export function getDesktopBridge(): PautelloDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return window.pautello ?? window.stavio ?? window.sonata ?? null;
}

export function isDesktopApp(): boolean {
  return getDesktopBridge() !== null;
}

function triggerBrowserDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // El objeto URL se libera en el siguiente ciclo para no cortar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Guarda `data` como `filename`. Devuelve el resultado en lugar de lanzar para
 * que quien llama pueda avisar al usuario sin `try/catch` alrededor del JSX.
 */
export async function saveFile(
  filename: string,
  data: Blob | string,
  mimeType = 'application/octet-stream'
): Promise<SaveFileResult> {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
  const bridge = getDesktopBridge();

  if (bridge) {
    try {
      const buffer = await blob.arrayBuffer();
      return await bridge.saveFile({
        defaultFileName: filename,
        mimeType: blob.type || mimeType,
        data: new Uint8Array(buffer),
      });
    } catch (error) {
      return { ok: false, error };
    }
  }

  try {
    triggerBrowserDownload(filename, blob);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Nombre de archivo seguro (sin caracteres prohibidos en Windows/macOS). */
export function safeFileName(input: string, fallback = 'pautello-partitura'): string {
  const cleaned = input
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : fallback;
}
