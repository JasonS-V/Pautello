import React from 'react';
import { Score, Staff } from '../../types/music';
import { TRANSPOSITION_PRESETS } from '../../utils/transposition';
import { PageInfo as LayoutPage, SystemInfo } from '../../engraver/layout';
import { Lightbulb } from '../ui/icons';
import { formatEmbeddedScoreMarker } from '../../omr/scorePayloadCodec';
import { metronomeLabel } from '../../utils/musicLabels';

export interface ScorePageChromeProps {
  score: Score;
  pages: LayoutPage[];
  systems: SystemInfo[];
  layoutMode: 'continuous' | 'paged';
  isPartView: boolean;
  effectiveStaffIdx: number;
  transpositionSemitones: number;
  effectiveKeySignature: string;
  totalMeasures: number;
  isGrandStaff: boolean;
  primaryStaff: Staff;
  renderSystem: (system: SystemInfo) => React.ReactNode;
}

const NOTE_SYMBOL = '\u2669';
const SEPARATOR = '\u2022';

const ScorePageChromeComponent: React.FC<ScorePageChromeProps> = ({
  score,
  pages,
  systems,
  layoutMode,
  isPartView,
  effectiveStaffIdx,
  transpositionSemitones,
  effectiveKeySignature,
  totalMeasures,
  isGrandStaff,
  primaryStaff,
  renderSystem,
}) => {
  const activeStaffName = score.staves[effectiveStaffIdx]?.name;

  const transpositionLabel =
    transpositionSemitones !== 0
      ? `(${
          TRANSPOSITION_PRESETS.find((p) => p.semitones === transpositionSemitones)?.shortLabel ||
          `+${transpositionSemitones}`
        })`
      : '';

  const viewLabel = isPartView
    ? `Particella (${activeStaffName || 'Instr.'})`
    : isGrandStaff
      ? 'Gran Pentagrama'
      : score.staves.length > 1
        ? `Partitura General (${score.staves.length} pentagramas)`
        : `Clave ${primaryStaff.clef.toUpperCase()}`;

  const guideMessage = isGrandStaff
    ? 'Gran pentagrama activo: haz clic en el pentagrama superior o en el inferior para colocar notas.'
    : score.staves.length > 1
      ? 'Modo Ensamble: haz clic sobre cualquier pentagrama para ingresar notas en ese instrumento.'
      : 'Haz clic en el pentagrama para insertar notas. Usa las teclas A-G o el piano inferior.';

  const embeddedPayload = formatEmbeddedScoreMarker(score);

  const titleBlock = (
    <div className="text-center pt-2 pb-6 border-b border-slate-100 mb-6">
      <div
        aria-hidden="true"
        className="text-[0.1px] leading-none text-transparent select-none pointer-events-none overflow-hidden h-0 w-0 print:block print:h-auto print:w-auto"
      >
        {embeddedPayload}
      </div>
      {isPartView && (
        <div className="inline-block mb-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700 border border-blue-200">
          Particella: {activeStaffName || 'Instrumento'} {transpositionLabel}
        </div>
      )}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif text-slate-900">
        {score.title || 'Sin Título'}
      </h1>
      {score.subtitle && (
        <h2 className="text-sm sm:text-base font-serif italic text-slate-600 mt-0.5">
          {score.subtitle}
        </h2>
      )}
      <div className="flex justify-between items-end text-xs text-slate-500 mt-3 px-2">
        <div className="text-left font-serif italic">
          {score.lyricist && (
            <div className="text-slate-700 font-medium">Letra / Arr.: {score.lyricist}</div>
          )}
          <div className="font-mono text-[11px] text-slate-400 mt-0.5">
            {score.metronomeMark
              ? metronomeLabel(score.metronomeMark)
              : `${NOTE_SYMBOL} = ${score.tempo}`}{' '}
            ({score.timeSignature.beats}/{score.timeSignature.beatType}) {SEPARATOR}{' '}
            {effectiveKeySignature}
          </div>
        </div>
        <div className="text-right">
          <span className="font-serif italic font-medium text-sm text-slate-800">
            {score.composer || 'Compositor'}
          </span>
          {score.partName && !isPartView && (
            <div className="text-[11px] font-sans text-slate-400 font-medium mt-0.5">
              {score.partName}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {layoutMode === 'paged' ? (
        <div className="score-pages-wrapper flex flex-col items-center gap-8 py-4 print:py-0 print:gap-0 print:block w-full">
          {pages.map((page) => (
            <div
              key={`page-${page.pageNumber}`}
              className="score-page relative bg-white text-slate-900 shadow-xl border border-slate-200 dark:border-slate-300 rounded-sm w-[840px] min-w-[840px] shrink-0 min-h-[1188px] p-8 flex flex-col justify-between print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:min-w-0 print:max-w-full print:min-h-0 print:block box-border shadow-slate-300/50 dark:shadow-black/50"
              style={{ breakAfter: 'page', pageBreakAfter: 'always' }}
            >
              {page.pageIndex === 0 ? (
                titleBlock
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100 mb-6 select-none">
                  <span className="font-serif italic font-bold truncate max-w-[360px] text-slate-800">
                    {score.title || 'Partitura'}{' '}
                    {isPartView && activeStaffName ? `- ${activeStaffName}` : ''}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-400">
                    - {page.pageNumber} -
                  </span>
                  <span className="font-serif truncate max-w-[200px] text-slate-700">
                    {score.composer || ''}
                  </span>
                </div>
              )}

              <div className="flex-1 flex flex-col gap-6">
                {page.systems.map((system) => renderSystem(system))}
              </div>

              <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between select-none">
                <span>
                  {score.copyright || 'Pautello Engraver - Todos los derechos reservados'}
                </span>
                <span className="font-mono">
                  Pág. {page.pageNumber} / {pages.length}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full">
          {titleBlock}
          {systems.map((system) => renderSystem(system))}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 no-print">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            <span>Guía Rápida:</span>
          </span>
          <span>{guideMessage}</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Total compases: {totalMeasures} {SEPARATOR} Instrumentos: {score.staves.length}{' '}
          {SEPARATOR} Vista: {viewLabel}
        </div>
      </div>
    </>
  );
};

export const ScorePageChrome = React.memo(ScorePageChromeComponent);
ScorePageChrome.displayName = 'ScorePageChrome';
