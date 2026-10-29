import { useRef, useState } from 'react';
import type { OmrResult } from '../../omr/omrEngine';
import type { OmrSourceSpan } from '../../omr/omrDecode';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader, ModalFooter } from '../ui/ModalChrome';
import { modalButton } from '../ui/modalButton';
import { Layers, AlertTriangle, Activity } from '../ui/icons';

export function OmrReviewPanel({
  result,
  focusSource,
  reviewedWarningIds = [],
  onToggleReviewed,
  onSelectWarning,
}: {
  result: OmrResult;
  focusSource?: OmrSourceSpan;
  reviewedWarningIds?: string[];
  onToggleReviewed?: (id: string) => void;
  onSelectWarning?: (index: number) => void;
}) {
  const [activeWarning, setActiveWarning] = useState(0);
  const [wholePage, setWholePage] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const previewRef = useRef<SVGSVGElement>(null);
  const warning = result.warnings[activeWarning];
  const activeSource = focusSource ?? warning?.src;
  const page =
    result.sourcePages?.find((p) => p.pageNumber === (activeSource?.page ?? warning?.page)) ??
    result.sourcePages?.[0];
  const region = activeSource?.bbox;
  const regionIsOnPage = activeSource?.page === page?.pageNumber;
  const contextWidth =
    page && region ? Math.min(page.width, Math.max(region[2] + 100, page.width * 0.3)) : 1;
  const contextHeight = page && region ? Math.min(page.height, region[3] + 60) : 1;
  const viewBox =
    page && region && regionIsOnPage && !wholePage
      ? `${Math.max(0, Math.min(region[0] - 50, page.width - contextWidth))} ${Math.max(0, Math.min(region[1] - 30, page.height - contextHeight))} ${contextWidth} ${contextHeight}`
      : `0 0 ${page?.width ?? 1} ${page?.height ?? 1}`;

  return (
    <section aria-label="Revisión de lectura OMR" className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
      {result.warnings.length > 0 && (
        <details className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 text-amber-950 dark:text-amber-100">
          <summary className="cursor-pointer font-bold select-none text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Revisar {result.warnings.length} aviso(s) de lectura</span>
            </span>
            <span className="font-mono text-[10px] bg-amber-200/80 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
              {activeWarning + 1} / {result.warnings.length}
            </span>
          </summary>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={activeWarning === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700/80 bg-white/80 dark:bg-studio-surface text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-studio-hover disabled:opacity-40 transition-colors cursor-pointer"
              onClick={() => {
                const next = activeWarning - 1;
                setActiveWarning(next);
                onSelectWarning?.(next);
              }}
            >
              &larr; Aviso anterior
            </button>
            <button
              type="button"
              disabled={activeWarning >= result.warnings.length - 1}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700/80 bg-white/80 dark:bg-studio-surface text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-studio-hover disabled:opacity-40 transition-colors cursor-pointer"
              onClick={() => {
                const next = activeWarning + 1;
                setActiveWarning(next);
                onSelectWarning?.(next);
              }}
            >
              Aviso siguiente &rarr;
            </button>
          </div>
          <ul
            className="mt-2.5 max-h-48 overflow-y-auto space-y-2 pr-1"
            aria-label="Avisos de lectura OMR"
          >
            {result.warnings.map((entry, index) => (
              <li
                key={`${entry.code}-${index}`}
                className={`p-2.5 rounded-lg border transition-colors ${
                  index === activeWarning
                    ? 'border-amber-400 bg-amber-100/70 dark:border-amber-600/70 dark:bg-amber-950/60'
                    : 'border-amber-200/70 dark:border-amber-900/40 bg-white/60 dark:bg-studio-surface/60'
                }`}
              >
                <div className="font-semibold text-xs text-amber-950 dark:text-amber-100">
                  {index === activeWarning ? 'Seleccionado — ' : ''}
                  Página {entry.page ?? entry.src?.page ?? '?'}
                  {(entry.system ?? entry.src?.system) !== undefined
                    ? `, sistema ${(entry.system ?? entry.src!.system) + 1}`
                    : ''}
                  {(entry.staff ?? entry.src?.staff) !== undefined
                    ? `, pauta ${(entry.staff ?? entry.src!.staff) + 1}`
                    : ''}
                  : {entry.message}
                </div>
                {onToggleReviewed && (
                  <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewedWarningIds.includes(`${entry.code}-${index}`)}
                      onChange={() => onToggleReviewed(`${entry.code}-${index}`)}
                      className="w-3.5 h-3.5 accent-studio-accent rounded cursor-pointer"
                    />
                    <span>
                      {reviewedWarningIds.includes(`${entry.code}-${index}`)
                        ? 'Revisado por persona'
                        : 'Pendiente'}
                    </span>
                  </label>
                )}
                {entry.src && (
                  <div className="mt-1 flex items-center justify-between gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                    <span className="text-[10px] font-mono text-amber-800/80 dark:text-amber-400/80">
                      Región: x={Math.round(entry.src.bbox[0])}, y={Math.round(entry.src.bbox[1])}
                    </span>
                    {result.sourcePages?.some((p) => p.pageNumber === entry.src?.page) && (
                      <button
                        type="button"
                        aria-label={`Ver región del aviso ${index + 1}`}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-900 transition-colors cursor-pointer"
                        onClick={() => {
                          setActiveWarning(index);
                          setWholePage(false);
                          onSelectWarning?.(index);
                          previewRef.current?.focus();
                        }}
                      >
                        Ver región
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {Boolean(result.editorial?.unclassified.length) && (
        <details className="rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated p-3.5 text-xs text-slate-800 dark:text-slate-200">
          <summary className="cursor-pointer font-bold select-none text-xs">
            Otro texto de la fuente
          </summary>
          <ul className="mt-2.5 max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {result.editorial?.unclassified
              .filter((line) => line.text.length >= 3 && !/^\d+$/.test(line.text))
              .map((line) => (
                <li
                  key={line.id}
                  className="p-2 rounded-lg bg-white dark:bg-studio-surface border border-slate-200/70 dark:border-studio-line text-slate-700 dark:text-slate-300 font-mono text-[11px]"
                >
                  Página {line.page}, x={Math.round(line.bbox[0])}, y={Math.round(line.bbox[1])}:{' '}
                  <span className="font-sans font-semibold text-slate-900 dark:text-slate-100">{line.text}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
      {page && (
        <figure className="space-y-2.5 rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated p-3 text-xs text-slate-700 dark:text-slate-300">
          <figcaption className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Fuente, página {page.pageNumber}. Ubicación aproximada del registro.
            </span>
            <div className="flex items-center gap-1.5">
              {result.pageDiagnostics?.length ? (
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-700 dark:text-slate-200 text-xs font-semibold hover:border-studio-accent transition-colors cursor-pointer"
                  aria-pressed={showRegions}
                  onClick={() => setShowRegions(!showRegions)}
                >
                  {showRegions ? 'Ocultar regiones conservadas' : 'Ver regiones conservadas'}
                </button>
              ) : null}
              {region && regionIsOnPage && (
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-studio-line bg-white dark:bg-studio-surface text-slate-700 dark:text-slate-200 text-xs font-semibold hover:border-studio-accent transition-colors cursor-pointer"
                  onClick={() => setWholePage(!wholePage)}
                >
                  {wholePage ? 'Ampliar región' : 'Ver página completa'}
                </button>
              )}
            </div>
          </figcaption>
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-studio-line shadow-inner bg-slate-900/5 dark:bg-black/30">
            <svg
              ref={previewRef}
              role="img"
              aria-label={`Fuente, página ${page.pageNumber}`}
              tabIndex={-1}
              viewBox={viewBox}
              className="w-full max-h-80 bg-white focus:outline-2 focus:outline-amber-600 block"
            >
              <image
                href={page.imageUrl}
                width={page.width}
                height={page.height}
                transform={
                  page.coordinates === 'original'
                    ? undefined
                    : `rotate(${-page.deskewAngleDeg} ${page.width / 2} ${page.height / 2})`
                }
              />
              {showRegions &&
                result.pageDiagnostics
                  ?.find((p) => p.pageNumber === page.pageNumber)
                  ?.regions.map((entry) => (
                    <rect
                      key={entry.id}
                      x={entry.bbox[0]}
                      y={entry.bbox[1]}
                      width={entry.bbox[2]}
                      height={entry.bbox[3]}
                      fill="none"
                      stroke={entry.route === 'review' ? '#b45309' : '#2563eb'}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>
                        {entry.route === 'review'
                          ? 'Indicación o símbolo pendiente'
                          : 'Región musical completa'}
                      </title>
                    </rect>
                  ))}
              {region && regionIsOnPage && (
                <rect
                  x={region[0]}
                  y={region[1]}
                  width={region[2]}
                  height={region[3]}
                  fill="none"
                  stroke="#b45309"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
        </figure>
      )}
      {(result.report ||
        result.pageDiagnostics?.some((page) => page.regions.some((r) => r.route === 'review')) ||
        result.acceptedProposals?.length ||
        result.reviewStatus ||
        result.acceptedIndicationIds?.length ||
        result.interventionCount !== undefined ||
        result.reviewDurationSeconds !== undefined) && (
        <div className="rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated p-3.5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span>Diagnóstico y estado de la lectura</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.report && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-studio-surface border border-slate-200/70 dark:border-studio-line">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Eventos
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {result.report.representedEvents} eventos representados; {result.report.pendingEvents}{' '}
                  pendientes en la fuente.
                  {result.report.unparseableRecords > 0 &&
                    ` Además, ${result.report.unparseableRecords} registros ilegibles por revisar.`}
                </p>
              </div>
            )}
            {result.reviewStatus && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-studio-surface border border-slate-200/70 dark:border-studio-line">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Estado
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Estado:{' '}
                  {result.reviewStatus === 'reviewed'
                    ? 'revisado por persona'
                    : result.reviewStatus === 'automatic'
                      ? 'lectura automática'
                      : 'importado con pendientes'}
                  . {result.reviewedMeasureIds?.length ?? 0} compás(es) verificados por persona.
                </p>
              </div>
            )}
            {result.pageDiagnostics?.some((page) =>
              page.regions.some((region) => region.route === 'review')
            ) && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-studio-surface border border-slate-200/70 dark:border-studio-line">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Regiones de origen
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {result.pageDiagnostics.reduce(
                    (total, page) =>
                      total + page.regions.filter((region) => region.route === 'review').length,
                    0
                  )}{' '}
                  región(es) de la fuente pendiente(s) de revisar.
                </p>
              </div>
            )}
            {Boolean(result.acceptedProposals?.length) && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-studio-surface border border-slate-200/70 dark:border-studio-line">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Propuestas aceptadas
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {result.acceptedProposals!.length} propuesta(s) aceptada(s); se conserva el borrador
                  reconocido.
                </p>
              </div>
            )}
            {Boolean(result.acceptedIndicationIds?.length) && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-studio-surface border border-slate-200/70 dark:border-studio-line">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Indicaciones asignadas
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {result.acceptedIndicationIds!.length} indicación(es) asignadas por persona.
                </p>
              </div>
            )}
            {(result.interventionCount !== undefined || result.reviewDurationSeconds !== undefined) && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-studio-surface border border-slate-200/70 dark:border-studio-line">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Esfuerzo de revisión
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Esfuerzo de revisión registrado: {result.interventionCount ?? 0} intervención(es),{' '}
                  {result.reviewDurationSeconds ?? 0} s.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <details className="rounded-xl border border-slate-200 dark:border-studio-lineSoft bg-slate-50/70 dark:bg-studio-elevated p-3.5 text-xs text-slate-700 dark:text-slate-300">
        <summary className="cursor-pointer font-bold select-none text-slate-800 dark:text-slate-200">
          Alcance, niveles de resultado y límites del lector OMR
        </summary>
        <ul className="mt-2.5 list-disc pl-4 space-y-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Restauración nativa (lossless-metadata):</strong> recupera la partitura exacta
            cuando el PDF/PNG conserva el bloque de metadatos de Pautello.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Lectura automática OMR (neural-onnx):</strong> inferencia óptica CRNN-CTC en
            WebAssembly; el porcentaje mostrado es probabilidad media de tokens CTC y{' '}
            <strong className="text-slate-800 dark:text-slate-200">nunca equivale a exactitud musical</strong>.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Propuestas por revisar:</strong> divisiones de compases sobrellenos,
            indicaciones con anclaje dudoso y textos editoriales con confianza OCR requieren
            aceptación explícita.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Resultado confirmado:</strong> queda marcado como <em>revisado por persona</em>{' '}
            solo cuando todos los compases, avisos e indicaciones han sido verificados sin eventos
            pendientes; de lo contrario se identifica como <em>importado con pendientes</em>.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Límites técnicos:</strong> hasta 20 páginas PDF o 16 MB (20 MPx por página),
            claves de Sol (G2) y Fa en cuarta (F4), una voz monofónica por pauta. Fotografías con
            sombras, inclinación extrema o compresión agresiva pueden requerir corrección manual o
            re-reconocimiento regional.
          </li>
        </ul>
      </details>
    </section>
  );
}

export function OmrReviewModal({ result, onClose }: { result: OmrResult; onClose: () => void }) {
  return (
    <ModalBase isOpen onClose={onClose} ariaLabel="Revisar lectura OMR" maxWidth="max-w-3xl">
      <ModalHeader
        icon={<Layers className="w-4 h-4" />}
        title="Revisar lectura OMR"
        subtitle="La fuente, las decisiones y los avisos se conservan en el borrador local."
        onClose={onClose}
        className="mb-4"
      />
      <OmrReviewPanel result={result} />
      <ModalFooter className="mt-4">
        <button type="button" onClick={onClose} className={modalButton.secondary}>
          Cerrar
        </button>
      </ModalFooter>
    </ModalBase>
  );
}
