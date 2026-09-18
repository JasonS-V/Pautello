import React from 'react';
import { AlertTriangle, Copy, Check, Download, RotateCcw, Trash2 } from './ui/icons';
import { downloadBlob } from '../audio/wavExport';
import { clearStoredScore, readStoredScoreJson } from '../utils/storage';
import { buildDiagnosticReport, recordFailure, type ErrorLog } from '../utils/errorLog';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  log: ErrorLog | null;
  copied: boolean;
}

/**
 * Red de seguridad de la interfaz. Sin esto, cualquier error al dibujar una
 * partitura (un MusicXML raro, un compás vacío) deja la pantalla en blanco y el
 * usuario sin acceso a su trabajo, que sigue autoguardado pero invisible.
 *
 * Al recuperar, React desmonta el subárbol con error, así que reintentar
 * reconstruye la app desde cero y vuelve a leer el autoguardado.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, log: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  /**
   * Sin telemetría, el contador local es la única memoria de que la app falla:
   * se anota el fallo antes de mostrar la pantalla de rescate, para que el
   * usuario pueda pegar un informe real en vez de solo el mensaje suelto.
   */
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('La interfaz no pudo dibujar la partitura:', error, info.componentStack);
    this.setState({ log: recordFailure(error, info.componentStack) });
  }

  private handleRetry = (): void => {
    this.setState({ error: null, log: null, copied: false });
  };

  private resetCopied = (): void => {
    window.setTimeout(() => this.setState({ copied: false }), 3000);
  };

  /** Copia el diagnóstico al portapapeles; si no hay, lo descarga como archivo. */
  private handleCopyDiagnostics = (): void => {
    const { error, log } = this.state;
    if (!error) return;

    const report = buildDiagnosticReport({
      error,
      log,
      storedScoreChars: readStoredScoreJson()?.length ?? null,
    });

    const downloadReport = (): void => {
      downloadBlob(
        new Blob([report], { type: 'text/plain' }),
        `pautello-diagnostico-${new Date().toISOString().slice(0, 10)}.txt`
      );
    };

    if (!navigator.clipboard?.writeText) {
      downloadReport();
      return;
    }

    navigator.clipboard
      .writeText(report)
      .then(() => {
        this.setState({ copied: true });
        this.resetCopied();
      })
      .catch(downloadReport);
  };

  /** Rescata el autoguardado en crudo: se conserva el trabajo incluso si la app no arranca. */
  private handleDownloadBackup = (): void => {
    const raw = readStoredScoreJson();
    if (!raw) return;
    downloadBlob(
      new Blob([raw], { type: 'application/json' }),
      `partitura-rescate-${new Date().toISOString().slice(0, 10)}.json`
    );
  };

  /** Última salida: descarta el autoguardado dañado y arranca limpio. */
  private handleStartFresh = (): void => {
    clearStoredScore();
    window.location.reload();
  };

  render(): React.ReactNode {
    const { error, log, copied } = this.state;
    if (!error) return this.props.children;

    const hasBackup = readStoredScoreJson() !== null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-studio-bg text-slate-900 dark:text-slate-100 p-6">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-studio-elevated p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
            <h1 className="text-lg font-bold">Algo se rompió al dibujar la partitura</h1>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Tu partitura sigue autoguardada. Descarga una copia antes de nada y, si el problema
            persiste, empieza de cero para recuperar la aplicación.
          </p>

          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-slate-100 dark:bg-black/40 p-3 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400 whitespace-pre-wrap">
            {error.message || String(error)}
          </pre>

          {log && log.failures > 1 && (
            <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
              Es el fallo nº {log.failures} en este navegador (el primero fue el{' '}
              {new Date(log.firstAt).toLocaleString()}). El registro se queda en tu equipo.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Reintentar
            </button>

            {hasBackup && (
              <button
                type="button"
                onClick={this.handleDownloadBackup}
                className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Descargar copia (.json)
              </button>
            )}

            <button
              type="button"
              onClick={this.handleCopyDiagnostics}
              className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 text-sm font-medium transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
              {copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}
              <span className="sr-only">
                (se guarda en este equipo, no se envía a ningún servidor)
              </span>
            </button>

            <button
              type="button"
              onClick={this.handleStartFresh}
              className="flex items-center gap-2 rounded-lg border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3 py-2 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Empezar de cero
            </button>
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            &quot;Empezar de cero&quot; borra la partitura autoguardada y recarga la aplicación.
          </p>
        </div>
      </div>
    );
  }
}
