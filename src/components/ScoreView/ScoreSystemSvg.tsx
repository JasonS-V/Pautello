import React from 'react';
import { Score, Staff, ScoreItem, TimeSignature, NamingConvention, Clef } from '../../types/music';
import { PlaybackState } from '../../audio/player';
import { SystemInfo } from '../../engraver/layout';
import { staffStepToY, staffStepToPitch, getLedgerLines } from '../../engraver/engraverMath';
import { getAccidentalLayout } from '../../engraver/notation';
import { calculateItemPositions } from '../../engraver/beaming';
import { SVG_PATHS } from '../../engraver/glyphPaths';
import { KEY_SIGNATURE_DATA, formatPitchName } from '../../constants/pitches';
import { StaffItemsRenderer } from './StaffItemsRenderer';
import { MeasureOverlays } from './MeasureOverlays';
import { TimeSignatureGlyphs, renderTimeSignatureGlyphs } from './TimeSignatureGlyphs';
import { metronomeLabel, metricEquivalenceLabel } from '../../utils/musicLabels';
import { ScoreDragState, GhostNoteState } from './types';

export interface ScoreSystemSvgProps {
  system: SystemInfo;
  score: Score;
  displayStaves: Staff[];
  primaryStaff: Staff;
  isGrandStaff: boolean;
  stavesCount: number;
  staffHeight: number;
  lineSpacing: number;
  staffSpacing: number;
  staffTopOffset: number;
  systemHeight: number;
  systemBottomY: number;
  totalMeasures: number;
  effectiveKeySignature: string;
  selectedItemId: string | null;
  selectedMeasureIdx: number;
  selectedStaffIdx: number;
  measureRange: { start: number; end: number } | null;
  hoveredMeasureIdx: number | null;
  setHoveredMeasureIdx: (idx: number | null) => void;
  hoveredBarlineIdx: number | null;
  setHoveredBarlineIdx: React.Dispatch<React.SetStateAction<number | null>>;
  justAddedMeasureIdx: number | null;
  setJustAddedMeasureIdx: (idx: number | null) => void;
  justAddedMeasureTimer: { schedule: (fn: () => void, ms: number) => void };
  playbackState: PlaybackState;
  practiceTargetNote?: { measureIdx: number; itemIdx: number } | null;
  practiceHitResult?: 'correct' | 'incorrect' | null;
  dragState: ScoreDragState | null;
  onSelectItem: (measureIdx: number, itemId: string | null, staffIdx?: number) => void;
  onSelectMeasure?: (measureIdx: number, isShiftKey: boolean, staffIdx?: number) => void;
  onDeleteMeasure: (idx: number) => void;
  onAddMeasureAfter?: (measureIdx: number) => void;
  onStartDrag?: (
    e: React.MouseEvent,
    item: ScoreItem,
    measureIdx: number,
    staffIdx: number
  ) => void;
  handleStaffMouseLeave: () => void;
  handleStaffMouseMove: (
    e: React.MouseEvent<SVGSVGElement>,
    actualMeasureIdx: number,
    availableMeasureWidth: number
  ) => void;
  handleStaffClick: (
    e: React.MouseEvent<SVGSVGElement>,
    actualMeasureIdx: number,
    availableMeasureWidth: number
  ) => void;
  getMeasureTimeSignature: (measureIdx: number) => TimeSignature;
  getKeySignatureOffsets: (clef: Clef) => number[];
  getStaffTopOffset: (sIdx: number) => number;
  ghostNoteState: GhostNoteState;
  showNoteNames: boolean;
  namingConvention: NamingConvention;
  isEditingLyrics?: boolean;
  onUpdateLyric?: (lyric: string) => void;
  onCloseLyrics?: () => void;
  onNavigateNextItem?: () => void;
  onNavigatePreviousItem?: () => void;
}

/** Ancho útil del sistema: encaja en una hoja A4 de 840px con márgenes de 32px. */
const SYSTEM_WIDTH = 776;

const NAVIGATION_TEXT: Readonly<Record<string, string>> = {
  daCapo: 'D.C.',
  dalSegno: 'D.S.',
  daCapoAlFine: 'D.C. al Fine',
  dalSegnoAlCoda: 'D.S. al Coda',
  toCoda: 'To Coda',
  fine: 'Fine',
};

const ScoreSystemSvgComponent: React.FC<ScoreSystemSvgProps> = ({
  system,
  score,
  displayStaves,
  primaryStaff,
  isGrandStaff,
  stavesCount,
  staffHeight,
  lineSpacing,
  systemHeight,
  systemBottomY,
  totalMeasures,
  effectiveKeySignature,
  selectedItemId,
  selectedMeasureIdx,
  measureRange,
  hoveredMeasureIdx,
  hoveredBarlineIdx,
  setHoveredBarlineIdx,
  justAddedMeasureIdx,
  setJustAddedMeasureIdx,
  justAddedMeasureTimer,
  playbackState,
  practiceTargetNote,
  practiceHitResult,
  dragState,
  onSelectItem,
  onSelectMeasure,
  onDeleteMeasure,
  onAddMeasureAfter,
  onStartDrag,
  handleStaffMouseLeave,
  handleStaffMouseMove,
  handleStaffClick,
  getMeasureTimeSignature,
  getKeySignatureOffsets,
  getStaffTopOffset,
  ghostNoteState,
  showNoteNames,
  namingConvention,
  isEditingLyrics,
  onUpdateLyric,
  onCloseLyrics,
  onNavigateNextItem,
  onNavigatePreviousItem,
}) => {
  const systemIdx = system.systemIndex;
  const startMeasureIdx = system.startMeasureIndex;
  const systemMeasures = system.measures;
  const isFirstSystem = systemIdx === 0;

  const headerWidth = isFirstSystem || displayStaves.length > 1 ? 120 : 60;
  const weights = systemMeasures.map((measure, subIndex) => {
    const itemCount = Math.max(
      1,
      ...displayStaves.map((staff) => staff.measures[startMeasureIdx + subIndex]?.items.length ?? 0)
    );
    return (
      1 +
      Math.max(0, itemCount - 1) * 0.65 +
      (measure.timeSignatureChange ? 0.45 : 0) +
      (measure.keySignatureChange ? 0.2 : 0)
    );
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const widths = weights.map((weight) => ((SYSTEM_WIDTH - headerWidth) * weight) / totalWeight);
  const offsets = widths.map(
    (_, i) => headerWidth + widths.slice(0, i).reduce((sum, width) => sum + width, 0)
  );
  const firstTop = getStaffTopOffset(0);
  const keyAccidentalType: '#' | 'b' =
    KEY_SIGNATURE_DATA[effectiveKeySignature as keyof typeof KEY_SIGNATURE_DATA]?.type === 'b'
      ? 'b'
      : '#';
  const anacrusisOffset = primaryStaff.measures[0]?.isAnacrusis ? 0 : 1;

  /** Índice real en `score.staves` de la pauta visible (en vista de parte difiere de sIdx). */
  const resolveStaffIdx = (staff: Staff, sIdx: number): number => {
    const found = score.staves.findIndex((s) => s.id === staff.id);
    return found >= 0 ? found : sIdx;
  };

  const renderGhost = (actualMeasureIdx: number): React.ReactNode => {
    const { hoveredStaffStep, hoveredX, hoveredStaffIdx, isRestMode, activeAccidental } =
      ghostNoteState;
    if (
      hoveredMeasureIdx !== actualMeasureIdx ||
      hoveredBarlineIdx !== null ||
      hoveredStaffStep === null ||
      hoveredX === null ||
      isRestMode ||
      playbackState.isPlaying
    ) {
      return null;
    }
    const targetStaff = score.staves[hoveredStaffIdx] || score.staves[0];
    const clef: Clef = targetStaff?.clef || 'treble';
    const pitch = staffStepToPitch(hoveredStaffStep, clef, activeAccidental);
    const visibleIdx = displayStaves.findIndex((s) => s.id === targetStaff?.id);
    const displaySIdx = visibleIdx >= 0 ? visibleIdx : 0;
    const top = getStaffTopOffset(displaySIdx);
    const noteY = top + staffStepToY(hoveredStaffStep, lineSpacing);
    const accLayout = activeAccidental ? getAccidentalLayout(activeAccidental, -8.5, noteY) : null;
    return (
      <g
        transform={`translate(${Math.max(15, Math.min((widths[hoveredMeasureIdx - startMeasureIdx] ?? 60) - 25, hoveredX))}, 0)`}
        className="ghost-note pointer-events-none no-print opacity-75 text-blue-600 dark:text-blue-400"
      >
        {getLedgerLines(hoveredStaffStep).map((lineY) => (
          <line
            key={`ghost-ledger-${lineY}`}
            x1={-10}
            y1={top + lineY * lineSpacing}
            x2={10}
            y2={top + lineY * lineSpacing}
            stroke="currentColor"
            strokeWidth={1.2}
          />
        ))}
        {accLayout && (
          <svg
            x={accLayout.x}
            y={accLayout.y}
            width={accLayout.width}
            height={accLayout.height}
            viewBox={accLayout.glyph.viewBox}
            className="select-none fill-current"
            aria-hidden="true"
          >
            <path d={accLayout.glyph.d} fill="currentColor" />
          </svg>
        )}
        <ellipse
          cx={0}
          cy={noteY}
          rx={6.5}
          ry={4.5}
          transform={`rotate(-22 0 ${noteY})`}
          fill="currentColor"
        />
        <text
          x={0}
          y={noteY - 10}
          textAnchor="middle"
          className="text-[10px] font-bold fill-current select-none"
        >
          {formatPitchName(pitch, namingConvention)}
        </text>
      </g>
    );
  };

  return (
    <div className="system-container relative mb-10 print:mb-4 w-full">
      <svg
        width={SYSTEM_WIDTH}
        height={systemHeight}
        viewBox={`0 0 ${SYSTEM_WIDTH} ${systemHeight}`}
        className="overflow-visible cursor-pointer print:w-full print:h-auto text-slate-900 dark:text-slate-100"
        onMouseLeave={handleStaffMouseLeave}
      >
        {/* Número del compás inicial del sistema */}
        {systemIdx > 0 &&
          (() => {
            const startNum = startMeasureIdx + anacrusisOffset;
            const badgeWidth = Math.max(20, String(startNum).length * 7.5 + 8);
            const badgeY = firstTop - 26;
            return (
              <g className="system-measure-number select-none pointer-events-none">
                <rect
                  x={0}
                  y={badgeY}
                  width={badgeWidth}
                  height={15}
                  rx={3}
                  className="fill-slate-100 stroke-slate-300"
                  strokeWidth={1}
                />
                <text
                  x={badgeWidth / 2}
                  y={badgeY + 11.5}
                  textAnchor="middle"
                  className="text-[10px] font-bold font-mono fill-slate-800 select-none"
                >
                  {startNum}
                </text>
              </g>
            );
          })()}

        {/* Llave de piano del Gran Pentagrama */}
        {isGrandStaff && (
          <g className="grand-staff-brace select-none">
            <path
              d={`M 12 ${firstTop}
                 C 2 ${firstTop + 20}, 0 ${firstTop + 45}, -7 ${firstTop + 62.5}
                 C 0 ${firstTop + 80}, 2 ${firstTop + 105}, 12 ${getStaffTopOffset(1) + staffHeight}
                 C 6 ${firstTop + 105}, 4 ${firstTop + 80}, -2 ${firstTop + 62.5}
                 C 4 ${firstTop + 45}, 6 ${firstTop + 20}, 12 ${firstTop} Z`}
              className="fill-slate-800 dark:fill-slate-200"
            />
            <line
              x1={12}
              y1={firstTop}
              x2={12}
              y2={getStaffTopOffset(1) + staffHeight}
              stroke="currentColor"
              strokeWidth={2.5}
            />
          </g>
        )}

        {/* Corchete orquestal */}
        {displayStaves.length > 1 && !isGrandStaff && (
          <g className="orchestral-bracket select-none text-slate-800 dark:text-slate-200">
            <line
              x1={4}
              y1={firstTop}
              x2={4}
              y2={systemBottomY}
              stroke="currentColor"
              strokeWidth={3.5}
            />
            <line
              x1={4}
              y1={firstTop}
              x2={14}
              y2={firstTop}
              stroke="currentColor"
              strokeWidth={2.5}
            />
            <line
              x1={4}
              y1={systemBottomY}
              x2={14}
              y2={systemBottomY}
              stroke="currentColor"
              strokeWidth={2.5}
            />
          </g>
        )}

        {/* Barra inicial que une las pautas */}
        <line
          x1={2}
          y1={firstTop}
          x2={2}
          y2={systemBottomY}
          stroke="currentColor"
          strokeWidth={displayStaves.length > 1 ? 2.5 : 1.5}
        />

        {/* Cinco líneas por pauta */}
        {displayStaves.map((st, sIdx) => {
          const curTop = getStaffTopOffset(sIdx);
          return (
            <g key={`staff-lines-${st.id || sIdx}`}>
              {[0, 1, 2, 3, 4].map((lineIdx) => (
                <line
                  key={`line-${sIdx}-${lineIdx}`}
                  x1={0}
                  y1={curTop + lineIdx * lineSpacing}
                  x2={SYSTEM_WIDTH}
                  y2={curTop + lineIdx * lineSpacing}
                  stroke="currentColor"
                  strokeWidth={1.2}
                  className="text-slate-300 dark:text-slate-700/80"
                />
              ))}
            </g>
          );
        })}

        {/* Cabecera: nombre, clave, armadura y métrica */}
        {displayStaves.map((st, sIdx) => {
          const curTop = getStaffTopOffset(sIdx);
          const curClef: Clef = st.clef || 'treble';
          const keySteps = getKeySignatureOffsets(curClef);
          return (
            <g key={`staff-header-${st.id || sIdx}`}>
              {(isFirstSystem || displayStaves.length > 1) && (
                <text
                  x={16}
                  y={curTop - 8}
                  className="text-[10px] font-sans font-bold fill-slate-600 dark:fill-slate-400 select-none"
                >
                  {isFirstSystem ? st.name : st.shortName || st.name}
                </text>
              )}

              {curClef === 'treble' && (
                <svg
                  x={8}
                  y={curTop - 16}
                  width={28}
                  height={72}
                  viewBox="0 0 98.82 256.11"
                  className="pointer-events-none select-none text-slate-900 dark:text-slate-100"
                  aria-hidden="true"
                >
                  <path
                    d="M37.37,254.43c-12.32-3.76-18.78-17.43-14.44-29.03,3.07-8.2,12.21-10.96,19.96-8.5s12.61,10.62,10.83,18.69c-1.87,8.47-9.09,13.39-18.73,13.58,6.49,2.88,13.35,4.14,20.35,3.68,10.19-.67,17.35-7.55,19.86-17.38,3.19-12.46,1.23-25.64-3.26-37.4-19.84,9.27-43.86.82-59.22-13.31-19.77-18.19-14.09-46.98.68-68.92,9.14-13.57,20.52-24.32,33.19-35.02l-3.24-19.77c-2.48-15.1.47-30.09,7.74-43.44C54.73,10.92,61.47.16,65.07,0c1.13-.05,3.14,1.25,3.97,2.36,19.32,25.93,20.89,60.68.03,85.2-4.6,5.41-9.31,9.64-15.17,14.91l6.39,29.39c20.75-1.77,37.5,7.64,38.46,28.1.9,19.07-7.28,27.4-23.47,37.04,2.43,10.33,4.89,20.31,4.77,30.59-.14,12.32-6.95,22.52-18.63,26.41-7.43,2.47-15.79,2.94-24.05.42ZM76.59,23.08c-1.33-3.67-4.73-6.53-7.81-6.97-14.82-2.07-24.04,42.8-19.78,63.48,17.63-13.66,35.46-34.91,27.6-56.52ZM59.95,146.22c-7.92.08-14.85,5.24-17.67,11.33-3.75,8.1-1.9,15.4,3.72,23.14-9.83-2.95-15.93-12.4-14.42-22.67,1.95-13.27,11.71-23.16,25.2-26.07l-5.9-26.68c-9.27,7.14-18.07,14.26-26.15,22.89-11.14,11.9-15.83,27.92-11.02,43.54,7.33,23.76,34.74,33.4,56.88,22.77l-10.64-48.25ZM87.07,161.83c-2.95-10.88-13.1-16.03-23.6-15.64l10.3,46.67c10.81-6.6,16.68-18.59,13.3-31.03Z"
                    fill="currentColor"
                  />
                </svg>
              )}
              {curClef === 'bass' && (
                <svg
                  x={8}
                  y={curTop - 5}
                  width={34}
                  height={37}
                  viewBox="0 0 236.08 255.96"
                  className="pointer-events-none select-none text-slate-900 dark:text-slate-100"
                  aria-hidden="true"
                >
                  <path
                    d="M108.22,175.67c18.97-35.56,23.16-75.5,11.71-113.57-2.6-8.66-6.52-16.14-11.59-23.39-16.04-22.93-47.03-27.71-69.5-10.74-9.59,7.25-22.49,25.62-17.44,34.87,12.54-6.77,26.82-5.32,36.95,4.07,9.37,8.68,12.28,23.03,6.52,35.22s-18.26,18.6-31.83,16.96C11.33,116.45-.4,95.01.01,73.9.72,37.02,28.23,6.79,64.63,1.58c19.87-2.85,39.44-2.12,58.31,4.42,24.43,8.47,42.04,27.28,48.87,52.23,21.76,79.57-51.17,151.66-110.85,195.56-3.82,2.81-7.93,3.09-11.05-.3-8.28-8.99,8.96-15.13,18.9-24.8,15.97-15.53,28.7-32.94,39.41-53.02Z"
                    fill="currentColor"
                  />
                  <circle cx="213.7" cy="136.34" r="22.38" fill="currentColor" />
                  <circle cx="213.7" cy="66.83" r="22.37" fill="currentColor" />
                </svg>
              )}
              {curClef === 'alto' && (
                <svg
                  x={8}
                  y={curTop}
                  width={25}
                  height={40}
                  viewBox="0 0 251.14 401.79"
                  className="pointer-events-none select-none text-slate-900 dark:text-slate-100"
                  aria-hidden="true"
                >
                  <path
                    d="M151.5,363.64c15.42,19.41,50,18.19,67.21,2.29s19.56-45.49,15.18-68c-5.8-29.81-29.15-51.17-59.17-46.62-25.6,3.88-54.13,17.8-78.46,29.37,19.3-26.51,28.93-59.57-1.07-79.77,30.04-20.27,20.3-53.28,1.11-79.76,15.58,7.51,30.12,14.41,45.87,20.28,23.23,8.65,47.09,15.38,69.33,2.1,11.47-6.85,18.73-18.11,21.82-31.3,5.73-24.46,1.9-58.11-16.45-76-17.02-16.61-49.83-17.21-65.42,1.99,6.63,2.12,11.75,5.91,15.54,11.59,8.51,12.77,7.86,29.87-1.78,41.76-6.28,7.75-15.28,11.07-25,9.99-11.61-1.29-21.22-7.9-26.1-18.98-6.47-14.67-6.49-31.93.12-46.75C125.93,9.62,157.65-1.85,185.33.39c35.4,2.87,56.51,29.39,62.94,63.44,5.35,28.34,4.05,65.86-10.91,90.72-16.63,27.63-51.44,30.62-78.37,14.98l-7.74-6.49c-2.99,13.92-8.35,26.97-17.72,37.84,9.21,10.78,14.6,23.52,17.69,37.77,3.24-2.83,6.34-5.64,10.17-7.69,24.83-13.29,54.36-11.17,71.52,12.51,17.9,24.71,20.7,64.72,16.36,94.75-4.34,30.06-20.64,54.59-50.87,61.28-20.43,4.52-41.47,2.31-59.8-7.83-10.35-5.73-18.79-13.88-23.89-24.69-7.15-15.16-7.24-33.16-.36-48.26,5.03-11.03,14.9-17.46,26.49-18.52,9.32-.86,17.88,2.26,24.04,9.64,11.54,13.8,10.63,34.8-2.34,47.43-3.12,3.04-6.93,4.75-11.04,6.37Z"
                    fill="currentColor"
                  />
                  <rect x="0" y="0" width="41.06" height="401.78" fill="currentColor" />
                  <rect
                    x="-127.31"
                    y="191.27"
                    width="401.78"
                    height="19.25"
                    transform="translate(-127.32 274.46) rotate(-90)"
                    fill="currentColor"
                  />
                </svg>
              )}

              <g transform={`translate(${curClef === 'bass' ? 48 : 46}, 0)`}>
                {keySteps.map((step, kIdx) => {
                  const ky = curTop + staffStepToY(step, lineSpacing);
                  const keyLayout = getAccidentalLayout(
                    keyAccidentalType,
                    (kIdx + 1) * 8.5,
                    ky,
                    keyAccidentalType === 'b' ? 19.5 : 16
                  );
                  return (
                    <svg
                      key={`key-acc-${sIdx}-${kIdx}`}
                      x={keyLayout.x}
                      y={keyLayout.y}
                      width={keyLayout.width}
                      height={keyLayout.height}
                      viewBox={keyLayout.glyph.viewBox}
                      className="pointer-events-none select-none fill-current text-slate-800 dark:text-slate-200"
                      aria-hidden="true"
                    >
                      <path d={keyLayout.glyph.d} fill="currentColor" />
                    </svg>
                  );
                })}
              </g>

              {isFirstSystem &&
                renderTimeSignatureGlyphs(
                  score.meterGlyph === 'common' ? 'C' : score.timeSignature.beats,
                  score.timeSignature.beatType,
                  headerWidth - 28,
                  curTop,
                  `header-ts-${st.id || sIdx}`
                )}
            </g>
          );
        })}

        {/* Compases del sistema */}
        {systemMeasures.map((measure, mSubIdx) => {
          const actualMeasureIdx = startMeasureIdx + mSubIdx;
          const measureX = offsets[mSubIdx];
          const availableMeasureWidth = widths[mSubIdx];
          const isSelectedMeasure = selectedMeasureIdx === actualMeasureIdx;
          const isJustAddedMeasure = justAddedMeasureIdx === actualMeasureIdx;
          const inRange =
            measureRange !== null &&
            actualMeasureIdx >= Math.min(measureRange.start, measureRange.end) &&
            actualMeasureIdx <= Math.max(measureRange.start, measureRange.end);
          const isCurrentlyPlaying =
            playbackState.isPlaying && playbackState.currentMeasureIndex === actualMeasureIdx;
          const itemPositions = isCurrentlyPlaying
            ? calculateItemPositions(
                measure.items,
                availableMeasureWidth,
                getMeasureTimeSignature(actualMeasureIdx)
              )
            : [];
          const frameHeight = systemBottomY - firstTop + 24;
          const tempoLabel = [
            measure.tempoText,
            measure.metronomeMark
              ? metronomeLabel(measure.metronomeMark)
              : measure.tempoBpm
                ? `♩ = ${measure.tempoBpm}`
                : null,
          ]
            .filter(Boolean)
            .join(' ');
          const equivalenceLabel = measure.metricEquivalence
            ? metricEquivalenceLabel(measure.metricEquivalence)
            : '';

          return (
            <g
              key={measure.id}
              transform={`translate(${measureX}, 0)`}
              data-measure-idx={actualMeasureIdx}
              className={isJustAddedMeasure ? 'animate-measure-in' : undefined}
              onMouseMove={(e) =>
                handleStaffMouseMove(
                  e as unknown as React.MouseEvent<SVGSVGElement>,
                  actualMeasureIdx,
                  measureX
                )
              }
              onClick={(e) => {
                e.stopPropagation();
                const svgEvent = e as unknown as React.MouseEvent<SVGSVGElement>;
                if (e.shiftKey && onSelectMeasure) {
                  onSelectMeasure(actualMeasureIdx, true, ghostNoteState.hoveredStaffIdx);
                  return;
                }
                const result: unknown = handleStaffClick(
                  svgEvent,
                  actualMeasureIdx,
                  availableMeasureWidth
                );
                if (result !== true && onSelectMeasure) {
                  onSelectMeasure(actualMeasureIdx, false, ghostNoteState.hoveredStaffIdx);
                }
              }}
            >
              <rect
                className="measure-click-area measure-hotspot transition-colors no-print cursor-pointer hover:fill-blue-500/5 dark:hover:fill-blue-500/10"
                x={0}
                y={0}
                width={availableMeasureWidth}
                height={systemHeight}
                fill="transparent"
              />

              {isJustAddedMeasure && (
                <rect
                  x={0}
                  y={firstTop - 8}
                  width={availableMeasureWidth}
                  height={systemBottomY - firstTop + 16}
                  className="meas-pulse animate-measure-flash pointer-events-none fill-blue-500/25 no-print"
                />
              )}

              {/* Destino de arrastre entre compases */}
              {dragState?.hasMoved &&
                dragState.targetMeasureIdx === actualMeasureIdx &&
                actualMeasureIdx !== dragState.sourceMeasureIdx && (
                  <rect
                    x={2}
                    y={firstTop - 14}
                    width={availableMeasureWidth - 4}
                    height={systemBottomY - firstTop + 28}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    rx={6}
                    className="pointer-events-none animate-pulse fill-studio-accent/[0.08] stroke-studio-accent no-print"
                  />
                )}

              {/* Número de compás */}
              <text
                x={4}
                y={firstTop - 12}
                className={`text-[10px] font-mono select-none ${
                  measure.isAnacrusis
                    ? 'fill-emerald-600 dark:fill-emerald-400 font-semibold'
                    : 'fill-slate-400'
                }`}
              >
                {measure.isAnacrusis
                  ? 'Anacrusa'
                  : (measure.printedNumber ?? actualMeasureIdx + anacrusisOffset)}
              </text>

              {measure.rehearsalMark && (
                <g
                  className="rehearsal-mark select-none pointer-events-none"
                  transform={`translate(2, ${firstTop - 42})`}
                >
                  <rect
                    x={0}
                    y={0}
                    width={Math.max(20, measure.rehearsalMark.length * 8 + 10)}
                    height={16}
                    rx={3}
                    className="fill-white stroke-slate-800"
                    strokeWidth={1.6}
                  />
                  <text
                    x={Math.max(10, (measure.rehearsalMark.length * 8 + 10) / 2)}
                    y={12}
                    textAnchor="middle"
                    className="text-[11px] font-sans font-black fill-slate-900"
                  >
                    {measure.rehearsalMark}
                  </text>
                </g>
              )}

              {tempoLabel && (
                <text
                  x={4}
                  y={firstTop - 62}
                  fontSize={Math.max(
                    8,
                    Math.min(11, (availableMeasureWidth - 8) / (tempoLabel.length * 0.58))
                  )}
                  textLength={
                    tempoLabel.length * 8 * 0.58 > availableMeasureWidth - 8
                      ? availableMeasureWidth - 8
                      : undefined
                  }
                  lengthAdjust="spacingAndGlyphs"
                  className="font-serif font-black italic fill-slate-900 dark:fill-slate-100 select-none pointer-events-none"
                >
                  {tempoLabel}
                </text>
              )}
              {equivalenceLabel && (
                <text
                  x={4}
                  y={firstTop - 47}
                  fontSize={Math.max(
                    8,
                    Math.min(11, (availableMeasureWidth - 8) / (equivalenceLabel.length * 0.58))
                  )}
                  textLength={
                    equivalenceLabel.length * 8 * 0.58 > availableMeasureWidth - 8
                      ? availableMeasureWidth - 8
                      : undefined
                  }
                  lengthAdjust="spacingAndGlyphs"
                  className="font-serif font-bold fill-slate-900 dark:fill-slate-100 select-none pointer-events-none"
                >
                  {equivalenceLabel}
                </text>
              )}

              {measure.navigationMark === 'segno' && (
                <svg
                  x={availableMeasureWidth / 2 - 10}
                  y={getStaffTopOffset(0) - 43}
                  width={20}
                  height={18}
                  viewBox="0 0 255.93 223.53"
                  className="pointer-events-none select-none text-slate-900 dark:text-slate-100"
                  aria-hidden="true"
                >
                  <path
                    d="M225.41,201.75c-23.27,27.71-65.31,28.61-89.15,1.59-9.18-10.41-8.61-26.16-.29-36.8s23.43-14.27,36.38-8.01c11.79,5.7,18.67,19.19,15.52,33.82,13.52-3.89,23.07-16.49,21.94-30.57-2.53-31.57-47.37-34.46-75.96-35.09l-96.84,96.84-20.79-20.81,77.68-77.72c-15.76-2.05-28.84-5.04-41.88-11.03C18.18,98.42,6.15,57.51,26.46,26.82s62.75-35.31,89.76-10.17c10.72,9.98,12.92,25.69,5.1,37.95-7.65,12.01-23.02,17.03-36.55,11.21s-20.29-19.87-17.08-34.58c-12.53,3.38-19.95,13.59-21.36,24.49-1.56,12.15,4.2,23.6,15.02,29.71,16.33,9.22,40.95,11.22,60.64,11.49L218.92,0l20.81,20.81-77.82,77.82c23.33,3.11,46.31,8.55,62.08,25.96,19.94,22,20.76,54.12,1.42,77.16Z"
                    fill="currentColor"
                  />
                  <circle cx="241.2" cy="82.28" r="14.73" fill="currentColor" />
                  <circle cx="14.73" cy="141.33" r="14.73" fill="currentColor" />
                </svg>
              )}
              {measure.navigationMark === 'coda' && (
                <g
                  transform={`translate(${availableMeasureWidth / 2 - 10}, ${firstTop - 42}) scale(0.85)`}
                  className="text-slate-900 dark:text-slate-100 pointer-events-none select-none"
                >
                  <path d={SVG_PATHS.coda} fill="none" stroke="currentColor" strokeWidth={1.8} />
                </g>
              )}
              {measure.navigationMark && NAVIGATION_TEXT[measure.navigationMark] && (
                <text
                  x={availableMeasureWidth - 6}
                  y={firstTop - 12}
                  textAnchor="end"
                  fontSize={Math.max(
                    8,
                    Math.min(
                      11,
                      (availableMeasureWidth - 8) /
                        (NAVIGATION_TEXT[measure.navigationMark].length * 0.58)
                    )
                  )}
                  textLength={
                    NAVIGATION_TEXT[measure.navigationMark].length * 8 * 0.58 >
                    availableMeasureWidth - 8
                      ? availableMeasureWidth - 8
                      : undefined
                  }
                  lengthAdjust="spacingAndGlyphs"
                  className="font-serif font-black italic fill-slate-900 dark:fill-slate-100 select-none pointer-events-none"
                >
                  {NAVIGATION_TEXT[measure.navigationMark]}
                </text>
              )}

              {measure.caesura && (
                <g
                  transform={`translate(${availableMeasureWidth - 14}, ${firstTop + 4})`}
                  className="text-slate-900 dark:text-slate-100 pointer-events-none select-none"
                >
                  <path
                    d={SVG_PATHS.caesura}
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </g>
              )}
              {measure.breathMark && (
                <g
                  transform={`translate(${availableMeasureWidth - 10}, ${firstTop - 8}) scale(0.8)`}
                  className="text-slate-900 dark:text-slate-100 pointer-events-none select-none"
                >
                  <path d={SVG_PATHS.breathMark} fill="currentColor" />
                </g>
              )}

              {measure.isMeasureRepeat && (
                <g
                  transform={`translate(${availableMeasureWidth / 2 - 12}, ${firstTop + 8}) scale(0.95)`}
                  className="text-slate-800 dark:text-slate-200 pointer-events-none select-none"
                >
                  <path
                    d={SVG_PATHS.measureRepeat}
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="currentColor"
                  />
                </g>
              )}

              {/* Cambio de métrica local */}
              {measure.timeSignatureChange &&
                displayStaves.map((_, sIdx) => (
                  <TimeSignatureGlyphs
                    key={`meas-ts-${actualMeasureIdx}-${sIdx}`}
                    beats={
                      measure.meterGlyph === 'common' ? 'C' : measure.timeSignatureChange!.beats
                    }
                    beatType={measure.timeSignatureChange!.beatType}
                    centerX={12}
                    staffTop={getStaffTopOffset(sIdx)}
                    keyPrefix={`meas-ts-${actualMeasureIdx}-${sIdx}`}
                  />
                ))}

              {/* Selección por rango y compás seleccionado */}
              {inRange && (
                <rect
                  x={0}
                  y={firstTop - 12}
                  width={availableMeasureWidth}
                  height={frameHeight}
                  strokeWidth={2}
                  rx={4}
                  className="pointer-events-none fill-studio-selectionLight/[0.12] stroke-studio-selectionLight no-print"
                />
              )}
              {isSelectedMeasure && !measureRange && (
                <rect
                  x={0}
                  y={firstTop - 12}
                  width={availableMeasureWidth}
                  height={frameHeight}
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  rx={4}
                  className="stroke-blue-500 opacity-70 pointer-events-none no-print"
                />
              )}

              {displayStaves.map((curStaff, sIdx) => {
                if (!curStaff.measures[actualMeasureIdx]) return null;
                return (
                  <g key={`meas-staff-${curStaff.id || sIdx}-${actualMeasureIdx}`}>
                    <StaffItemsRenderer
                      score={score}
                      primaryStaff={primaryStaff}
                      staffIdx={resolveStaffIdx(curStaff, sIdx)}
                      actualMeasureIdx={actualMeasureIdx}
                      isSystemStart={mSubIdx === 0 && actualMeasureIdx > 0}
                      baseTopOffset={getStaffTopOffset(sIdx)}
                      lineSpacing={lineSpacing}
                      staffHeight={staffHeight}
                      availableMeasureWidth={availableMeasureWidth}
                      selectedItemId={selectedItemId}
                      onSelectItem={onSelectItem}
                      playbackState={playbackState}
                      practiceTargetNote={practiceTargetNote}
                      practiceHitResult={practiceHitResult}
                      dragState={dragState}
                      onStartDrag={onStartDrag}
                      showNoteNames={showNoteNames}
                      namingConvention={namingConvention}
                      isEditingLyrics={isEditingLyrics}
                      onUpdateLyric={onUpdateLyric}
                      onCloseLyrics={onCloseLyrics}
                      onNavigateNextItem={onNavigateNextItem}
                      onNavigatePreviousItem={onNavigatePreviousItem}
                      getMeasureTimeSignature={getMeasureTimeSignature}
                    />
                  </g>
                );
              })}

              {renderGhost(actualMeasureIdx)}

              <MeasureOverlays
                measure={measure}
                actualMeasureIdx={actualMeasureIdx}
                availableMeasureWidth={availableMeasureWidth}
                systemBottomY={systemBottomY}
                getStaffTopOffset={getStaffTopOffset}
                stavesCount={stavesCount}
                lineSpacing={lineSpacing}
                playbackState={playbackState}
                itemPositions={itemPositions}
                isLastMeasureOfScore={actualMeasureIdx === totalMeasures - 1}
              />
            </g>
          );
        })}

        {/* Botones (+) de inserción rápida entre compases */}
        {systemMeasures.map((measure, mSubIdx) => {
          const actualMeasureIdx = startMeasureIdx + mSubIdx;
          const barlineX = offsets[mSubIdx] + widths[mSubIdx];
          const isHovered = hoveredBarlineIdx === actualMeasureIdx;
          const barlineCenterY = (firstTop + systemBottomY) / 2;
          const showAddMeasureButton = isHovered && !dragState && !playbackState.isPlaying;

          return (
            <g
              key={`barline-add-${measure.id}`}
              className="barline-intersection-control no-print select-none"
              onMouseEnter={() => setHoveredBarlineIdx(actualMeasureIdx)}
              onMouseLeave={() =>
                setHoveredBarlineIdx((current) => (current === actualMeasureIdx ? null : current))
              }
            >
              <rect
                x={barlineX - 14}
                y={firstTop - 8}
                width={28}
                height={systemBottomY - firstTop + 16}
                fill="transparent"
                className="cursor-pointer"
              />
              <g
                className={`transition-all duration-150 ease-out ${
                  showAddMeasureButton
                    ? 'cursor-pointer opacity-100 scale-100'
                    : 'pointer-events-none opacity-0 scale-75'
                }`}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onAddMeasureAfter?.(actualMeasureIdx);
                  setHoveredBarlineIdx(null);
                  setJustAddedMeasureIdx(actualMeasureIdx + 1);
                  justAddedMeasureTimer.schedule(() => setJustAddedMeasureIdx(null), 650);
                }}
              >
                <title>{`Añadir compás después del compás ${actualMeasureIdx + 1}`}</title>
                <rect
                  x={barlineX - 8}
                  y={barlineCenterY - 8}
                  width={16}
                  height={16}
                  rx={4}
                  strokeWidth={1}
                  className={`fill-white drop-shadow-sm transition-colors ${
                    isHovered ? 'stroke-blue-400' : 'stroke-slate-300'
                  }`}
                />
                <path
                  d={`M ${barlineX - 4} ${barlineCenterY} L ${barlineX + 4} ${barlineCenterY} M ${barlineX} ${barlineCenterY - 4} L ${barlineX} ${barlineCenterY + 4}`}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  className="pointer-events-none stroke-blue-600"
                />
              </g>
            </g>
          );
        })}
      </svg>

      {/* Borrado del compás seleccionado (visible sin hover; excluido en selección por rango) */}
      {!measureRange &&
        systemMeasures.some((_, smIdx) => startMeasureIdx + smIdx === selectedMeasureIdx) && (
          <div className="absolute right-0 top-0 no-print">
            <button
              type="button"
              onClick={() => onDeleteMeasure(selectedMeasureIdx)}
              className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              title={`Eliminar compás ${selectedMeasureIdx + 1}`}
              aria-label={`Eliminar compás ${selectedMeasureIdx + 1}`}
            >
              Borrar C{selectedMeasureIdx + 1}
            </button>
          </div>
        )}
    </div>
  );
};

export const ScoreSystemSvg = React.memo(ScoreSystemSvgComponent);
ScoreSystemSvg.displayName = 'ScoreSystemSvg';
