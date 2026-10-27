import { useRef, useState } from 'react';
import type { OmrResult } from '../../omr/omrEngine';
import { ModalBase } from '../ui/ModalBase';
import { ModalHeader } from '../ui/ModalChrome';

export function OmrReviewPanel({ result }: { result: OmrResult }) {
  const [activeWarning, setActiveWarning] = useState(0);
  const [wholePage, setWholePage] = useState(false);
  const previewRef = useRef<SVGSVGElement>(null);
  const warning = result.warnings[activeWarning];
  const page =
    result.sourcePages?.find((p) => p.pageNumber === (warning?.src?.page ?? warning?.page)) ??
    result.sourcePages?.[0];
  const region = warning?.src?.bbox;
  const regionIsOnPage = warning?.src?.page === page?.pageNumber;
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
      {page && (
        <figure className="space-y-2 rounded-xl border border-slate-300 dark:border-studio-lineSoft p-3">
          <figcaption className="flex flex-wrap items-center justify-between gap-2">
            <span>Fuente, página {page.pageNumber}. Ubicación aproximada del registro.</span>
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
              transform={`rotate(${-page.deskewAngleDeg} ${page.width / 2} ${page.height / 2})`}
            />
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
      {Boolean(result.acceptedProposals?.length) && (
        <p>
          {result.acceptedProposals!.length} propuesta(s) aceptada(s); se conserva el borrador
          reconocido.
        </p>
      )}
    </section>
  );
}

export function OmrReviewModal({ result, onClose }: { result: OmrResult; onClose: () => void }) {
  return (
    <ModalBase isOpen onClose={onClose} ariaLabel="Revisar lectura OMR" maxWidth="max-w-3xl">
      <ModalHeader
        title="Revisar lectura OMR"
        subtitle="La fuente y los avisos se conservan durante esta sesión de la aplicación."
        onClose={onClose}
      />
      <OmrReviewPanel result={result} />
    </ModalBase>
  );
}
