import { useRef, useState } from 'react';
import type { OmrResult } from '../../omr/omrEngine';
import type { OmrSourceSpan } from '../../omr/omrDecode';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader } from '../ui/ModalChrome';

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
    <section aria-label="Revisión de lectura OMR" className="space-y-3 text-xs">
      {result.warnings.length > 0 && (
        <details className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3.5 text-amber-950 dark:text-amber-100">
          <summary className="cursor-pointer font-semibold">
            Revisar {result.warnings.length} aviso(s) de lectura
          </summary>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={activeWarning === 0}
              className="underline disabled:opacity-50"
              onClick={() => {
                const next = activeWarning - 1;
                setActiveWarning(next);
                onSelectWarning?.(next);
              }}
            >
              Aviso anterior
            </button>
            <button
              type="button"
              disabled={activeWarning >= result.warnings.length - 1}
              className="underline disabled:opacity-50"
              onClick={() => {
                const next = activeWarning + 1;
                setActiveWarning(next);
                onSelectWarning?.(next);
              }}
            >
              Aviso siguiente
            </button>
          </div>
          <ul
            className="mt-2 max-h-48 overflow-y-auto space-y-2"
            aria-label="Avisos de lectura OMR"
          >
            {result.warnings.map((entry, index) => (
              <li
                key={`${entry.code}-${index}`}
                className="border-t border-amber-200 dark:border-amber-900/60 pt-2"
              >
                <span className="font-semibold">
                  {index === activeWarning ? 'Seleccionado — ' : ''}
                  Página {entry.page ?? entry.src?.page ?? '?'}
                  {(entry.system ?? entry.src?.system) !== undefined
                    ? `, sistema ${(entry.system ?? entry.src!.system) + 1}`
                    : ''}
                  {(entry.staff ?? entry.src?.staff) !== undefined
                    ? `, pauta ${(entry.staff ?? entry.src!.staff) + 1}`
                    : ''}
                  :
                </span>{' '}
                {entry.message}
                {onToggleReviewed && (
                  <label className="ml-2 inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={reviewedWarningIds.includes(`${entry.code}-${index}`)}
                      onChange={() => onToggleReviewed(`${entry.code}-${index}`)}
                    />
                    {reviewedWarningIds.includes(`${entry.code}-${index}`)
                      ? 'Revisado por persona'
                      : 'Pendiente'}
                  </label>
                )}
                {entry.src && (
                  <>
                    <span className="block text-[11px] opacity-80">
                      Región: x={Math.round(entry.src.bbox[0])}, y={Math.round(entry.src.bbox[1])}
                    </span>
                    {result.sourcePages?.some((p) => p.pageNumber === entry.src?.page) && (
                      <button
                        type="button"
                        aria-label={`Ver región del aviso ${index + 1}`}
                        className="mt-1 underline font-semibold"
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
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {Boolean(result.editorial?.unclassified.length) && (
        <details className="rounded-xl border border-slate-300 dark:border-studio-lineSoft p-3.5">
          <summary className="cursor-pointer font-semibold">Otro texto de la fuente</summary>
          <ul className="mt-2 max-h-36 overflow-y-auto space-y-1">
            {result.editorial?.unclassified
              .filter((line) => line.text.length >= 3 && !/^\d+$/.test(line.text))
              .map((line) => (
                <li key={line.id}>
                  Página {line.page}, x={Math.round(line.bbox[0])}, y={Math.round(line.bbox[1])}:{' '}
                  {line.text}
                </li>
              ))}
          </ul>
        </details>
      )}
      {page && (
        <figure className="space-y-2 rounded-xl border border-slate-300 dark:border-studio-lineSoft p-3">
          <figcaption className="flex flex-wrap items-center justify-between gap-2">
            <span>Fuente, página {page.pageNumber}. Ubicación aproximada del registro.</span>
            {result.pageDiagnostics?.length ? (
              <button
                type="button"
                className="underline font-semibold"
                aria-pressed={showRegions}
                onClick={() => setShowRegions(!showRegions)}
              >
                {showRegions ? 'Ocultar regiones conservadas' : 'Ver regiones conservadas'}
              </button>
            ) : null}
            {region && regionIsOnPage && (
              <button
                type="button"
                className="underline font-semibold"
                onClick={() => setWholePage(!wholePage)}
              >
                {wholePage ? 'Ampliar región' : 'Ver página completa'}
              </button>
            )}
          </figcaption>
          <svg
            ref={previewRef}
            role="img"
            aria-label={`Fuente, página ${page.pageNumber}`}
            tabIndex={-1}
            viewBox={viewBox}
            className="w-full max-h-80 bg-white border border-slate-200 focus:outline-2 focus:outline-amber-600"
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
        </figure>
      )}
      {result.report && (
        <p>
          {result.report.representedEvents} eventos representados; {result.report.pendingEvents}{' '}
          pendientes en la fuente.
          {result.report.unparseableRecords > 0 &&
            ` Además, ${result.report.unparseableRecords} registros ilegibles por revisar.`}
        </p>
      )}
      {result.pageDiagnostics?.some((page) =>
        page.regions.some((region) => region.route === 'review')
      ) && (
        <p>
          {result.pageDiagnostics.reduce(
            (total, page) =>
              total + page.regions.filter((region) => region.route === 'review').length,
            0
          )}{' '}
          región(es) de la fuente pendiente(s) de revisar.
        </p>
      )}
      {Boolean(result.acceptedProposals?.length) && (
        <p>
          {result.acceptedProposals!.length} propuesta(s) aceptada(s); se conserva el borrador
          reconocido.
        </p>
      )}
      {result.reviewStatus && (
        <p>
          Estado:{' '}
          {result.reviewStatus === 'reviewed'
            ? 'revisado por persona'
            : result.reviewStatus === 'automatic'
              ? 'lectura automática'
              : 'importado con pendientes'}
          . {result.reviewedMeasureIds?.length ?? 0} compás(es) verificados por persona.
        </p>
      )}
      {Boolean(result.acceptedIndicationIds?.length) && (
        <p>{result.acceptedIndicationIds!.length} indicación(es) asignadas por persona.</p>
      )}
      {(result.interventionCount !== undefined || result.reviewDurationSeconds !== undefined) && (
        <p>
          Esfuerzo de revisión registrado: {result.interventionCount ?? 0} intervención(es),{' '}
          {result.reviewDurationSeconds ?? 0} s.
        </p>
      )}
      <details className="rounded-xl border border-slate-300 dark:border-studio-lineSoft p-3.5">
        <summary className="cursor-pointer font-semibold">
          Alcance, niveles de resultado y límites del lector OMR
        </summary>
        <ul className="mt-2 list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
          <li>
            <strong>Restauración nativa (lossless-metadata):</strong> recupera la partitura exacta
            cuando el PDF/PNG conserva el bloque de metadatos de Pautello.
          </li>
          <li>
            <strong>Lectura automática OMR (neural-onnx):</strong> inferencia óptica CRNN-CTC en
            WebAssembly; el porcentaje mostrado es probabilidad media de tokens CTC y{' '}
            <strong>nunca equivale a exactitud musical</strong>.
          </li>
          <li>
            <strong>Propuestas por revisar:</strong> divisiones de compases sobrellenos,
            indicaciones con anclaje dudoso y textos editoriales con confianza OCR requieren
            aceptación explícita.
          </li>
          <li>
            <strong>Resultado confirmado:</strong> queda marcado como <em>revisado por persona</em>{' '}
            solo cuando todos los compases, avisos e indicaciones han sido verificados sin eventos
            pendientes; de lo contrario se identifica como <em>importado con pendientes</em>.
          </li>
          <li>
            <strong>Límites técnicos:</strong> hasta 20 páginas PDF o 16 MB (20 MPx por página),
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
        title="Revisar lectura OMR"
        subtitle="La fuente, las decisiones y los avisos se conservan en el borrador local."
        onClose={onClose}
      />
      <OmrReviewPanel result={result} />
    </ModalBase>
  );
}
