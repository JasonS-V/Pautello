import React, { useState, useRef, useMemo } from 'react';
import {
  Score,
  Measure,
  Clef,
  Pitch,
  ScoreItem,
  NoteDuration,
  Accidental,
  NamingConvention,
  getItemPitches,
  isPianoGrandStaff,
} from '../../types/music';
import {
  pitchToStaffStep,
  staffStepToY,
  yToStaffStep,
  staffStepToPitch,
  getLedgerLines,
} from '../../engraver/engraverMath';
import {
  formatPitchName,
  KEY_SIGNATURE_DATA,
  pitchToMidi,
  getItemBeats,
} from '../../constants/pitches';
import { SVG_PATHS, TIME_SIG_GLYPHS } from '../../engraver/glyphPaths';
import { calculateItemPositions, detectBeamGroups, BeamedNoteInfo } from '../../engraver/beaming';
import { getFlagCount, getNoteFlagPath, getRestGlyph, getAccidentalLayout } from '../../engraver/notation';
import { PlaybackState } from '../../audio/player';
import { audioEngine } from '../../audio/synth';
import { pitchToGuitarTab } from '../../utils/guitarTab';
import { computeSystems, computePages, SystemInfo } from '../../engraver/layout';
import {
  getTransposedKeySignature,
  transposeStaffMeasures,
  TRANSPOSITION_PRESETS,
} from '../../utils/transposition';
import { getCapacityFromTimings, getMeasureTimings } from '../../utils/measureTiming';
import { canMeasureFitItem } from '../../hooks/useScore';
import { useTimeout } from '../../hooks/useTimeout';

interface ScoreViewProps {
  score: Score;
  selectedItemId: string | null;
  selectedMeasureIdx: number;
  selectedStaffIdx?: number;
  onSelectItem: (measureIdx: number, itemId: string | null, staffIdx?: number) => void;
  onInsertNoteAt: (measureIdx: number, pitch: Pitch, staffIdx?: number) => void;
  onInsertRestAt: (measureIdx: number, staffIdx?: number) => void;
  onDeleteMeasure: (idx: number) => void;
  activeDuration: NoteDuration;
  isDotted?: boolean;
  activeAccidental: Accidental;
  isRestMode: boolean;
  namingConvention: NamingConvention;
  showNoteNames: boolean;
  showTablature?: boolean;
  isTuplet?: boolean;
  practiceTargetNote?: { measureIdx: number; itemIdx: number } | null;
  practiceHitResult?: 'correct' | 'incorrect' | null;
  playbackState: PlaybackState;
  viewMode?: 'full' | 'part';
  activePartStaffIdx?: number;
  layoutMode?: 'continuous' | 'paged';
  measuresPerSystem?: number;
  onToggleSystemBreak?: (measureIdx: number) => void;
  onTogglePageBreak?: (measureIdx: number) => void;
  onSetMultimeasureRest?: (measureIdx: number, count?: number) => void;
  measureRange?: { start: number; end: number } | null;
  onSelectMeasure?: (measureIdx: number, isShiftKey: boolean, staffIdx?: number) => void;
  activeOctave?: number;
  isOctaveLockEnabled?: boolean;
  onMoveItem?: (
    sourceMeasureIdx: number,
    sourceItemId: string,
    targetMeasureIdx: number,
    targetItemIdx: number | null,
    targetPitch?: Pitch,
    staffIdx?: number
  ) => void;
  activeVoice?: 1 | 2;
  isEditingLyrics?: boolean;
  onUpdateLyric?: (lyric: string) => void;
  onCloseLyrics?: () => void;
  onNavigateNextItem?: () => void;
  onNavigatePreviousItem?: () => void;
  onAddMeasureAfter?: (measureIdx: number) => void;
}

/**
 * Silencio de una figura: bloque para la redonda/blanca y glifo (con las plicas
 * apiladas) para el resto. La decisión vive en engraver/notation.ts.
 */
const RestNotation: React.FC<{
  duration: NoteDuration;
  topOffset: number;
  isPlaying: boolean;
}> = ({ duration, topOffset, isPlaying }) => {
  const glyph = getRestGlyph(duration);
  const colorClass = isPlaying ? 'fill-amber-500' : 'fill-current';

  if (glyph.kind === 'block') {
    return (
      <rect
        x={-glyph.width / 2}
        y={topOffset + glyph.offsetY}
        width={glyph.width}
        height={glyph.height}
        fill="currentColor"
        className={colorClass}
      />
    );
  }

  return (
    <g
      transform={`translate(${glyph.offsetX}, ${topOffset + glyph.offsetY}) scale(${glyph.scale})`}
      className={colorClass}
    >
      {glyph.strokes.map((stroke, index) => (
        <path
          key={index}
          d={glyph.path}
          transform={
            stroke.dx === 0 && stroke.dy === 0 ? undefined : `translate(${stroke.dx}, ${stroke.dy})`
          }
        />
      ))}
    </g>
  );
};

/**
 * Renders SMuFL Bravura vector time signature glyphs (classical music engraving).
 * Numerator digit(s) sit between line 5 (top) and line 3 (middle) (height = 20px).
 * Denominator digit(s) sit between line 3 (middle) and line 1 (bottom) (height = 20px).
 */
function renderTimeSignatureGlyphs(
  beats: number | string,
  beatType: number | string,
  centerX: number,
  staffTop: number,
  keyPrefix: string = 'ts'
): React.ReactNode {
  const FONT_SCALE = 20 / 720; // 720 font units = 2 staff spaces = 20px

  const beatsStr = String(beats);
  if (beatsStr === 'C' || beatsStr === 'c' || beatsStr === 'cutC' || beatsStr === 'allaBreve') {
    const isCut = beatsStr === 'cutC' || beatsStr === 'allaBreve';
    const glyph = TIME_SIG_GLYPHS[isCut ? 'cutC' : 'C'];
    if (glyph) {
      const w = glyph.width * FONT_SCALE;
      const y = isCut
        ? staffTop + 20 - (glyph.height * FONT_SCALE) / 2
        : staffTop + 10;
      return (
        <g
          key={keyPrefix}
          className="time-signature select-none pointer-events-none text-slate-900 dark:text-slate-100"
        >
          <g transform={`translate(${centerX - w / 2}, ${y}) scale(${FONT_SCALE})`}>
            <path d={glyph.d} fill="currentColor" />
          </g>
        </g>
      );
    }
  }

  const renderDigitGroup = (val: number | string, groupY: number, subKey: string) => {
    const str = String(val);
    const chars = str.split('');
    let totalWidth = 0;
    const items: { d: string; width: number; xOffset: number }[] = [];

    for (const ch of chars) {
      const glyph = TIME_SIG_GLYPHS[ch];
      if (glyph) {
        const w = glyph.width * FONT_SCALE;
        items.push({ d: glyph.d, width: w, xOffset: totalWidth });
        totalWidth += w + 0.8;
      }
    }

    if (items.length > 0) {
      totalWidth -= 0.8;
    } else {
      return (
        <text
          key={`${keyPrefix}-${subKey}-fallback`}
          x={centerX}
          y={groupY + 16}
          textAnchor="middle"
          className="font-serif font-bold text-[17px] fill-current"
        >
          {val}
        </text>
      );
    }

    const startX = centerX - totalWidth / 2;

    return (
      <g
        key={`${keyPrefix}-${subKey}`}
        transform={`translate(${startX}, ${groupY})`}
      >
        {items.map((item, idx) => (
          <g
            key={`${keyPrefix}-${subKey}-${idx}`}
            transform={`translate(${item.xOffset}, 0) scale(${FONT_SCALE})`}
          >
            <path d={item.d} fill="currentColor" />
          </g>
        ))}
      </g>
    );
  };

  return (
    <g
      key={keyPrefix}
      className="time-signature select-none pointer-events-none text-slate-900 dark:text-slate-100"
    >
      {/* Numerator: staff line 5 (top) to line 3 (middle) */}
      {renderDigitGroup(beats, staffTop, 'num')}
      {/* Denominator: staff line 3 (middle) to line 1 (bottom) */}
      {renderDigitGroup(beatType, staffTop + 20, 'den')}
    </g>
  );
}

export const ScoreView: React.FC<ScoreViewProps> = ({
  score,
  selectedItemId,
  selectedMeasureIdx,
  selectedStaffIdx = 0,
  onSelectItem,
  onInsertNoteAt,
  onInsertRestAt,
  onDeleteMeasure,
  activeDuration,
  isDotted = false,
  isTuplet = false,
  activeAccidental,
  isRestMode,
  namingConvention,
  showNoteNames,
  showTablature = false,
  practiceTargetNote = null,
  practiceHitResult = null,
  playbackState,
  viewMode = 'full',
  activePartStaffIdx = 0,
  layoutMode = 'continuous',
  measuresPerSystem = 3,
  onToggleSystemBreak,
  onTogglePageBreak,
  measureRange = null,
  onSelectMeasure,
  activeOctave = 4,
  isOctaveLockEnabled = true,
  onMoveItem,
  onAddMeasureAfter,
}) => {
  const [hoveredMeasureIdx, setHoveredMeasureIdx] = useState<number | null>(null);
  const [hoveredBarlineIdx, setHoveredBarlineIdx] = useState<number | null>(null);
  // Compás recién creado con el botón '+' del pentagrama: alimenta su animación
  // de entrada y se limpia solo cuando la animación ya ha terminado.
  const [justAddedMeasureIdx, setJustAddedMeasureIdx] = useState<number | null>(null);
  const justAddedMeasureTimer = useTimeout();
  const [hoveredStaffStep, setHoveredStaffStep] = useState<number | null>(null);
  const [hoveredStaffIdx, setHoveredStaffIdx] = useState<number>(0);
  const [hoveredX, setHoveredX] = useState<number | null>(null);

  // Estado para arrastrar figuras de notas (Drag & Drop para cambiar altura/compás)
  const [dragState, setDragState] = useState<{
    itemId: string;
    sourceMeasureIdx: number;
    sourceStaffIdx: number;
    initialPitch: Pitch;
    currentPitch: Pitch;
    targetMeasureIdx: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hasMoved: boolean;
  } | null>(null);
  const wasDraggedRef = useRef<boolean>(false);
  const lastPlayedPitchRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const isPartView = viewMode === 'part';
  const effectiveStaffIdx = isPartView
    ? Math.max(0, Math.min(activePartStaffIdx, score.staves.length - 1))
    : 0;

  const currentPartStaff = score.staves[effectiveStaffIdx] || score.staves[0];
  const transpositionSemitones = isPartView ? currentPartStaff?.transposition || 0 : 0;
  const effectiveKeySignature =
    transpositionSemitones !== 0
      ? getTransposedKeySignature(score.keySignature, transpositionSemitones)
      : score.keySignature;

  const displayStaves = isPartView
    ? [
        {
          ...currentPartStaff,
          measures:
            transpositionSemitones !== 0
              ? transposeStaffMeasures(
                  currentPartStaff.measures,
                  transpositionSemitones,
                  effectiveKeySignature
                )
              : currentPartStaff.measures,
        },
      ]
    : score.staves;

  const primaryStaff = displayStaves[0] || {
    id: 'staff-1',
    name: 'Voz',
    clef: 'treble' as Clef,
    measures: [],
  };

  const isGrandStaff = !isPartView && isPianoGrandStaff(score);

  const lineSpacing = 10;
  const staffHeight = 40;
  const staffSpacing = 85;
  const staffTopOffset = 58;
  const getStaffTopOffset = (sIdx: number) => staffTopOffset + sIdx * staffSpacing;

  const stavesCount = displayStaves.length;
  const systemBottomPadding = showTablature ? 80 : 35;
  const systemHeight =
    staffTopOffset + (stavesCount - 1) * staffSpacing + staffHeight + systemBottomPadding;

  const tabTopOffset = staffTopOffset + (stavesCount - 1) * staffSpacing + staffHeight + 25;
  const tabLineSpacing = 7.5;

  // Group measures dynamically into systems respecting system/page breaks
  const effectiveMeasuresPerSystem = measuresPerSystem || 3;
  const totalMeasures = primaryStaff.measures.length;
  const systems = computeSystems(primaryStaff.measures, effectiveMeasuresPerSystem);
  const pages = computePages(systems, systemHeight, {
    pageHeight: 1188,
    firstPageTopMargin: 130,
    pageTopMargin: 65,
    pageBottomMargin: 60,
    systemGap: 36,
  });

  const keyData = KEY_SIGNATURE_DATA[effectiveKeySignature] || { accidentals: 0, type: 'none' };

  // Calculate Key Signature sharp/flat vertical steps
  const getKeySignatureOffsets = (clef: Clef) => {
    const offsets: { step: number; type: '#' | 'b' }[] = [];
    if (keyData.type === '#') {
      const sharpStepsTreble = [0, 3, -1, 2, 5, 1, 4]; // F5, C5, G5, D5, A4, E5, B4
      const sharpStepsBass = [2, 5, 1, 4, 7, 3, 6];
      const sharpStepsAlto = [-1, 2, 5, 1, 4, 0, 3];
      const sourceSteps =
        clef === 'bass' ? sharpStepsBass : clef === 'alto' ? sharpStepsAlto : sharpStepsTreble;
      for (let i = 0; i < keyData.accidentals; i++) {
        offsets.push({ step: sourceSteps[i], type: '#' });
      }
    } else if (keyData.type === 'b') {
      const flatStepsTreble = [4, 1, 5, 2, 6, 3, 7]; // B4, E5, A4, D5, G4, C5, F4
      const flatStepsBass = [6, 3, 7, 4, 8, 5, 9];
      const flatStepsAlto = [3, 0, 4, 1, 5, 2, 6];
      const sourceSteps =
        clef === 'bass' ? flatStepsBass : clef === 'alto' ? flatStepsAlto : flatStepsTreble;
      for (let i = 0; i < keyData.accidentals; i++) {
        offsets.push({ step: sourceSteps[i], type: 'b' });
      }
    }
    return offsets;
  };

  const handleStaffMouseMove = (
    e: React.MouseEvent<SVGElement>,
    mIdx: number,
    measureX: number
  ) => {
    const svgEl = e.currentTarget.ownerSVGElement || (e.currentTarget as unknown as SVGSVGElement);
    const svgRect = svgEl.getBoundingClientRect();
    const svgY = e.clientY - svgRect.top;
    const svgX = e.clientX - svgRect.left;
    const relX = svgX - measureX;

    let targetDisplayStaffIdx = 0;
    if (displayStaves.length > 1) {
      let minDist = Infinity;
      displayStaves.forEach((_, sIdx) => {
        const staffCenterY = getStaffTopOffset(sIdx) + staffHeight / 2;
        const dist = Math.abs(svgY - staffCenterY);
        if (dist < minDist) {
          minDist = dist;
          targetDisplayStaffIdx = sIdx;
        }
      });
    }

    const curTopOffset = getStaffTopOffset(targetDisplayStaffIdx);
    const relY = svgY - curTopOffset;
    const step = yToStaffStep(relY, lineSpacing);

    const actualStaffIdx = isPartView ? effectiveStaffIdx : targetDisplayStaffIdx;

    setHoveredMeasureIdx(mIdx);
    setHoveredStaffStep(step);
    setHoveredStaffIdx(actualStaffIdx);
    setHoveredX(relX);
  };

  const handleStaffMouseLeave = () => {
    setHoveredMeasureIdx(null);
    setHoveredBarlineIdx(null);
    setHoveredStaffStep(null);
    setHoveredX(null);
  };

  // Cambios locales de compás/tempo ya resueltos, heredados hacia adelante.
  const measureTimings = useMemo(() => getMeasureTimings(score), [score]);
  const getMeasureTimeSignature = (measureIdx: number) =>
    measureTimings[measureIdx]?.timeSignature ?? score.timeSignature;

  const activeItemBeats = getItemBeats(
    activeDuration,
    isDotted,
    isTuplet ? { actual: 3, normal: 2 } : undefined
  );

  /**
   * ¿Cabe la figura activa en ese compás? Delega en la misma validación que usa
   * el modelo (incluida la anacrusis) para que el lienzo no prometa de más.
   */
  const canStaffMeasureFit = (targetMeasure?: Measure, measureIdx: number = 0) => {
    if (!targetMeasure) return false;
    const maxBeats = getCapacityFromTimings(measureTimings, measureIdx, score.timeSignature);
    return canMeasureFitItem(targetMeasure, activeItemBeats, maxBeats);
  };

  const handleStaffClick = (mIdx: number): boolean => {
    const targetStaff = score.staves[hoveredStaffIdx] || score.staves[0];

    if (isRestMode) {
      onInsertRestAt(mIdx, hoveredStaffIdx);
      return true;
    }
    if (hoveredStaffStep !== null) {
      const targetClef = targetStaff?.clef || 'treble';
      const naturalPitch = staffStepToPitch(hoveredStaffStep, targetClef, activeAccidental);
      let pitch: Pitch = naturalPitch;

      if (isOctaveLockEnabled && activeOctave !== undefined) {
        // En el recuadro de la octava activa, asegurar la octava elegida;
        // fuera de él, permitir libremente la altura natural del clic
        const stepHigh = pitchToStaffStep(
          { step: 'B', octave: activeOctave, accidental: null },
          targetClef
        );
        const stepLow = pitchToStaffStep(
          { step: 'C', octave: activeOctave, accidental: null },
          targetClef
        );
        const minStep = Math.min(stepHigh, stepLow);
        const maxStep = Math.max(stepHigh, stepLow);
        const isInsideLane = hoveredStaffStep >= minStep - 1 && hoveredStaffStep <= maxStep + 1;

        if (isInsideLane) {
          pitch = {
            ...naturalPitch,
            octave: activeOctave,
          };
        }
      }

      onInsertNoteAt(mIdx, pitch, hoveredStaffIdx);
      return true;
    }
    return false;
  };

  /**
   * Renders the note & rest items for a specific staff in a measure
   */
  const renderStaffItems = (
    targetItems: ScoreItem[],
    targetClef: Clef,
    baseTopOffset: number,
    staffIdx: number,
    actualMeasureIdx: number,
    availableMeasureWidth: number
  ) => {
    const measureObj = (score.staves[staffIdx] || primaryStaff)?.measures[actualMeasureIdx];
    if (measureObj?.multimeasureRest && measureObj.multimeasureRest > 1) {
      const midX = availableMeasureWidth / 2;
      const midY = baseTopOffset + 2 * lineSpacing; // 3rd line of staff
      return (
        <g className="multimeasure-rest select-none" key={`tacet-${staffIdx}-${actualMeasureIdx}`}>
          {/* Thick horizontal H-bar */}
          <rect
            x={midX - 28}
            y={midY - 3.5}
            width={56}
            height={7}
            rx={1}
            className="fill-slate-800 dark:fill-slate-200"
          />
          {/* Left vertical serif line */}
          <line
            x1={midX - 28}
            y1={midY - 11}
            x2={midX - 28}
            y2={midY + 11}
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-slate-800 dark:text-slate-200"
          />
          {/* Right vertical serif line */}
          <line
            x1={midX + 28}
            y1={midY - 11}
            x2={midX + 28}
            y2={midY + 11}
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-slate-800 dark:text-slate-200"
          />
          {/* Number of measures above the bar */}
          <text
            x={midX}
            y={midY - 14}
            textAnchor="middle"
            className="text-sm font-black font-serif fill-slate-800 dark:fill-slate-200 select-none"
          >
            {measureObj.multimeasureRest}
          </text>
        </g>
      );
    }

    // El espaciado y el beameo siguen la métrica vigente en el compás, no la global.
    const measureTimeSignature = getMeasureTimeSignature(actualMeasureIdx);
    const itemPositions = calculateItemPositions(
      targetItems,
      availableMeasureWidth,
      measureTimeSignature
    );
    const getItemX = (idx: number) => itemPositions[idx]?.x ?? 20 + idx * 40;

    const { beamGroups, beamedItemIndices } = detectBeamGroups(
      targetItems,
      itemPositions,
      targetClef,
      baseTopOffset,
      lineSpacing,
      measureTimeSignature
    );

    const beamedInfoMap = new Map<number, BeamedNoteInfo>();
    beamGroups.forEach((bg) => {
      bg.notes.forEach((bn) => {
        beamedInfoMap.set(bn.itemIdx, bn);
      });
    });

    // Detect tuplet groups
    const tupletGroups: {
      startIndex: number;
      endIndex: number;
      actual: number;
      normal: number;
    }[] = [];

    let currentTupletGroup: {
      startIndex: number;
      endIndex: number;
      actual: number;
      normal: number;
    } | null = null;

    targetItems.forEach((it, idx) => {
      if (it.tuplet) {
        if (!currentTupletGroup) {
          currentTupletGroup = {
            startIndex: idx,
            endIndex: idx,
            actual: it.tuplet.actual,
            normal: it.tuplet.normal,
          };
        } else if (
          currentTupletGroup.actual === it.tuplet.actual &&
          currentTupletGroup.normal === it.tuplet.normal
        ) {
          currentTupletGroup.endIndex = idx;
        } else {
          tupletGroups.push(currentTupletGroup);
          currentTupletGroup = {
            startIndex: idx,
            endIndex: idx,
            actual: it.tuplet.actual,
            normal: it.tuplet.normal,
          };
        }
      } else {
        if (currentTupletGroup) {
          tupletGroups.push(currentTupletGroup);
          currentTupletGroup = null;
        }
      }
    });
    if (currentTupletGroup) {
      tupletGroups.push(currentTupletGroup);
    }

    const renderedItems = targetItems.map((item, itemIdx) => {
      const itemX = getItemX(itemIdx);
      const isItemSelected = selectedItemId === item.id;
      const isItemPlaying =
        playbackState.isPlaying &&
        playbackState.currentMeasureIndex === actualMeasureIdx &&
        playbackState.currentItemIndex === itemIdx &&
        staffIdx === 0;

      if (item.type === 'rest') {
        const restY = baseTopOffset + 20;
        return (
          <g
            key={item.id}
            transform={`translate(${itemX}, 0)`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectItem(actualMeasureIdx, item.id, staffIdx);
            }}
            className="cursor-pointer group"
          >
            {isItemSelected && (
              <>
                <circle
                  cx="0"
                  cy={restY}
                  r="14"
                  fill="none"
                  className="stroke-studio-selection no-print"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
                {/* Visual Caret Bar */}
                <g className="pointer-events-none animate-pulse text-blue-600 dark:text-blue-400 no-print">
                  <line
                    x1="12"
                    y1={baseTopOffset - 6}
                    x2="12"
                    y2={baseTopOffset + staffHeight + 6}
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`12,${baseTopOffset - 6} 9,${baseTopOffset - 10} 15,${baseTopOffset - 10}`}
                    fill="currentColor"
                  />
                  <polygon
                    points={`12,${baseTopOffset + staffHeight + 6} 9,${baseTopOffset + staffHeight + 10} 15,${baseTopOffset + staffHeight + 10}`}
                    fill="currentColor"
                  />
                </g>
              </>
            )}

            <RestNotation
              duration={item.duration}
              topOffset={baseTopOffset}
              isPlaying={isItemPlaying}
            />

            {item.isDotted && (
              <circle
                cx={item.duration === 'w' || item.duration === 'h' ? 12 : 11}
                cy={baseTopOffset + 15}
                r="2"
                className={isItemPlaying ? 'fill-studio-accent' : 'fill-current'}
              />
            )}

            {item.chord && (
              <text
                x="0"
                y={baseTopOffset - 18}
                textAnchor="middle"
                className="text-xs font-sans font-black fill-amber-600 dark:fill-pastel-amber select-none tracking-tight"
              >
                {item.chord}
              </text>
            )}
          </g>
        );
      }

      // Note item
      const itemPitches = getItemPitches(item);
      if (itemPitches.length === 0) return null;

      const isItemDragged = dragState?.itemId === item.id && dragState.hasMoved;

      // When dragging, use the live dragged pitch (and transpose chord notes proportionally)
      const effectivePitches = isItemDragged
        ? itemPitches.map((p, pIdx) => {
            if (pIdx === 0) return dragState.currentPitch;
            const deltaMidi =
              pitchToMidi(dragState.currentPitch) - pitchToMidi(dragState.initialPitch);
            const currentM = pitchToMidi(p);
            const newM = Math.max(12, Math.min(127, currentM + deltaMidi));
            const oct = Math.floor(newM / 12) - 1;
            const semi = ((newM % 12) + 12) % 12;
            const semiMap: { step: Pitch['step']; acc: Accidental }[] = [
              { step: 'C', acc: null },
              { step: 'C', acc: '#' },
              { step: 'D', acc: null },
              { step: 'E', acc: 'b' },
              { step: 'E', acc: null },
              { step: 'F', acc: null },
              { step: 'F', acc: '#' },
              { step: 'G', acc: null },
              { step: 'A', acc: 'b' },
              { step: 'A', acc: null },
              { step: 'B', acc: 'b' },
              { step: 'B', acc: null },
            ];
            return {
              step: semiMap[semi].step,
              octave: oct,
              accidental: semiMap[semi].acc,
            };
          })
        : itemPitches;

      // Calculate staffStep, noteY, ledgerLines for each pitch in the chord
      // Sort descending by staffStep (lowest note / largest staffStep first)
      const pitchInfos = effectivePitches
        .map((p) => {
          const staffStep = pitchToStaffStep(p, targetClef);
          const noteY = baseTopOffset + staffStepToY(staffStep, lineSpacing);
          const ledgerLines = getLedgerLines(staffStep);
          return { pitch: p, staffStep, noteY, ledgerLines };
        })
        .sort((a, b) => b.staffStep - a.staffStep);

      const avgStaffStep =
        pitchInfos.reduce((acc, pi) => acc + pi.staffStep, 0) / pitchInfos.length;

      const beamedNote = beamedInfoMap.get(itemIdx);
      const isBeamed = beamedItemIndices.has(itemIdx) && !!beamedNote;
      const stemUp = isBeamed ? beamedNote.stemUp : avgStaffStep > 4;

      // Notehead X offset to prevent collision on seconds (notes 1 staff step apart)
      const noteheadPositions = pitchInfos.map((pi, pIdx) => {
        let offsetX = 0;
        if (pIdx > 0) {
          const prev = pitchInfos[pIdx - 1];
          if (Math.abs(pi.staffStep - prev.staffStep) === 1) {
            offsetX = stemUp ? 11.5 : -11.5;
          }
        }
        return { ...pi, offsetX };
      });

      // Stem vertical bounds: spans from lowest notehead to highest notehead
      const minY = Math.min(...pitchInfos.map((pi) => pi.noteY));
      const maxY = Math.max(...pitchInfos.map((pi) => pi.noteY));
      const stemX = stemUp ? 5.8 : -5.8;
      const stemStartY = stemUp ? maxY : minY;
      const stemEndY = isBeamed ? beamedNote.stemEndY : stemUp ? minY - 30 : maxY + 30;

      // Collect deduplicated ledger lines
      const uniqueLedgerLines = Array.from(new Set(pitchInfos.flatMap((pi) => pi.ledgerLines)));

      const isPracticeTarget =
        practiceTargetNote?.measureIdx === actualMeasureIdx &&
        practiceTargetNote?.itemIdx === itemIdx &&
        staffIdx === 0;

      const dragDeltaX = isItemDragged ? dragState.currentX - dragState.startX : 0;

      return (
        <g
          key={item.id}
          transform={`translate(${itemX + dragDeltaX}, 0)`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            const startPitch = itemPitches[0];
            if (!startPitch) return;
            try {
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
            } catch (err) {
              void err;
            }
            wasDraggedRef.current = false;
            lastPlayedPitchRef.current = `${startPitch.step}${startPitch.accidental || ''}${startPitch.octave}`;
            setDragState({
              itemId: item.id,
              sourceMeasureIdx: actualMeasureIdx,
              sourceStaffIdx: staffIdx,
              initialPitch: { ...startPitch },
              currentPitch: { ...startPitch },
              targetMeasureIdx: actualMeasureIdx,
              startX: e.clientX,
              startY: e.clientY,
              currentX: e.clientX,
              currentY: e.clientY,
              hasMoved: false,
            });
          }}
          onPointerMove={(e) => {
            if (!dragState || dragState.itemId !== item.id) return;
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            if (!dragState.hasMoved && Math.hypot(dx, dy) < 4) return;

            // Compute vertical pitch change based on half-step staff distance (5px per line/space step)
            const stepDelta = Math.round(dy / (lineSpacing / 2));
            const initialStep = pitchToStaffStep(dragState.initialPitch, targetClef);
            const newStep = initialStep + stepDelta;
            const newPitch = staffStepToPitch(
              newStep,
              targetClef,
              dragState.initialPitch.accidental
            );

            const pitchKey = `${newPitch.step}${newPitch.accidental || ''}${newPitch.octave}`;
            if (pitchKey !== lastPlayedPitchRef.current) {
              lastPlayedPitchRef.current = pitchKey;
              audioEngine.playMidi(pitchToMidi(newPitch), 0.2, 0.7);
            }

            // Detect target measure under pointer
            let targetMIdx = actualMeasureIdx;
            const origPointerEvents = (e.currentTarget as SVGElement).style.pointerEvents;
            (e.currentTarget as SVGElement).style.pointerEvents = 'none';
            const underEl = document.elementFromPoint(e.clientX, e.clientY);
            (e.currentTarget as SVGElement).style.pointerEvents = origPointerEvents;
            const measEl = underEl?.closest('[data-measure-idx]');
            if (measEl) {
              const parsed = parseInt(measEl.getAttribute('data-measure-idx')!, 10);
              const maxMeas = score.staves[staffIdx]?.measures.length || 0;
              if (!isNaN(parsed) && parsed >= 0 && parsed < maxMeas) {
                targetMIdx = parsed;
              }
            }

            setDragState((prev) =>
              prev
                ? {
                    ...prev,
                    hasMoved: true,
                    currentPitch: newPitch,
                    targetMeasureIdx: targetMIdx,
                    currentX: e.clientX,
                    currentY: e.clientY,
                  }
                : null
            );
          }}
          onPointerUp={(e) => {
            if (!dragState || dragState.itemId !== item.id) return;
            try {
              (e.currentTarget as Element).releasePointerCapture(e.pointerId);
            } catch (err) {
              void err;
            }

            if (dragState.hasMoved) {
              wasDraggedRef.current = true;

              // Find final target measure
              let targetMIdx = dragState.targetMeasureIdx;
              const origPointerEvents = (e.currentTarget as SVGElement).style.pointerEvents;
              (e.currentTarget as SVGElement).style.pointerEvents = 'none';
              const underEl = document.elementFromPoint(e.clientX, e.clientY);
              (e.currentTarget as SVGElement).style.pointerEvents = origPointerEvents;
              const measEl = underEl?.closest('[data-measure-idx]');
              if (measEl) {
                const parsed = parseInt(measEl.getAttribute('data-measure-idx')!, 10);
                const maxMeas = score.staves[staffIdx]?.measures.length || 0;
                if (!isNaN(parsed) && parsed >= 0 && parsed < maxMeas) {
                  targetMIdx = parsed;
                }
              }

              // Determine targetItemIdx within target measure
              let targetItemIdx: number | null = null;
              const dx = e.clientX - dragState.startX;
              if (targetMIdx !== actualMeasureIdx || Math.abs(dx) >= 20) {
                const targetMeasure = score.staves[staffIdx]?.measures[targetMIdx];
                const measRect = measEl?.getBoundingClientRect();
                if (targetMeasure && measRect) {
                  const relX = Math.max(0, e.clientX - measRect.left);
                  const timeSig = getMeasureTimeSignature(targetMIdx);
                  const positions = calculateItemPositions(
                    targetMeasure.items,
                    measRect.width,
                    timeSig
                  );
                  targetItemIdx = targetMeasure.items.length;
                  for (let i = 0; i < positions.length; i++) {
                    if (relX < positions[i].x) {
                      targetItemIdx = i;
                      break;
                    }
                  }
                }
              }

              onMoveItem?.(
                actualMeasureIdx,
                item.id,
                targetMIdx,
                targetItemIdx,
                dragState.currentPitch,
                staffIdx
              );
            }
            setDragState(null);
          }}
          onPointerCancel={(e) => {
            try {
              (e.currentTarget as Element).releasePointerCapture(e.pointerId);
            } catch (err) {
              void err;
            }
            setDragState(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (wasDraggedRef.current) {
              wasDraggedRef.current = false;
              return;
            }
            onSelectItem(actualMeasureIdx, item.id, staffIdx);
            pitchInfos.forEach((pi) => {
              audioEngine.playMidi(pitchToMidi(pi.pitch), 0.35);
            });
          }}
          className={
            isItemDragged
              ? 'cursor-grabbing select-none'
              : 'cursor-grab active:cursor-grabbing group select-none'
          }
        >
          {/* Dragged Glow Ring */}
          {isItemDragged &&
            noteheadPositions.map((np, nIdx) => (
              <circle
                key={`drag-halo-${nIdx}`}
                cx={np.offsetX}
                cy={np.noteY}
                r="15"
                className="animate-pulse fill-studio-accent/20 stroke-studio-accent"
                strokeWidth="2.5"
              />
            ))}

          {/* Live pitch name tooltip while dragging */}
          {isItemDragged && (
            <g transform={`translate(0, ${minY - 24})`} className="pointer-events-none select-none">
              <rect
                x="-26"
                y="-10"
                width="52"
                height="18"
                rx="4"
                className="fill-studio-accent shadow-md"
              />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                className="text-[10px] font-sans font-extrabold fill-white tracking-tight"
              >
                {formatPitchName(dragState.currentPitch, namingConvention)}
              </text>
            </g>
          )}
          {/* Selected Halo Ring */}
          {isItemSelected &&
            noteheadPositions.map((np, nIdx) => (
              <circle
                key={`halo-${nIdx}`}
                cx={np.offsetX}
                cy={np.noteY}
                r="13"
                fill="none"
                className="animate-pulse stroke-studio-accent no-print"
                strokeWidth="2.5"
              />
            ))}

          {/* Insertion Caret cursor */}
          {isItemSelected && (
            <g className="pointer-events-none animate-pulse text-blue-600 dark:text-blue-400 no-print">
              <line
                x1={stemUp ? 14 : 12}
                y1={baseTopOffset - 6}
                x2={stemUp ? 14 : 12}
                y2={baseTopOffset + staffHeight + 6}
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <polygon
                points={`${stemUp ? 14 : 12},${baseTopOffset - 6} ${(stemUp ? 14 : 12) - 3},${baseTopOffset - 10} ${(stemUp ? 14 : 12) + 3},${baseTopOffset - 10}`}
                fill="currentColor"
              />
              <polygon
                points={`${stemUp ? 14 : 12},${baseTopOffset + staffHeight + 6} ${(stemUp ? 14 : 12) - 3},${baseTopOffset + staffHeight + 10} ${(stemUp ? 14 : 12) + 3},${baseTopOffset + staffHeight + 10}`}
                fill="currentColor"
              />
            </g>
          )}

          {/* Practice Target Ring */}
          {isPracticeTarget && (
            <g className="pointer-events-none">
              <circle
                cx="0"
                cy={minY}
                r="18"
                fill="none"
                className={`animate-ping opacity-75 ${
                  practiceHitResult === 'correct'
                    ? 'stroke-studio-success'
                    : practiceHitResult === 'incorrect'
                      ? 'stroke-studio-dangerStrong'
                      : 'stroke-pastel-limeDark'
                }`}
                strokeWidth="3"
              />
              <circle
                cx="0"
                cy={minY}
                r="15"
                fill="none"
                className={`${practiceHitResult === 'correct' ? 'stroke-studio-success' : practiceHitResult === 'incorrect' ? 'stroke-studio-dangerStrong' : 'stroke-pastel-lime'}`}
                strokeWidth="2"
              />
            </g>
          )}

          {/* Ledger lines */}
          {uniqueLedgerLines.map((lineY, lIdx) => (
            <line
              key={`ledger-${lIdx}`}
              x1="-10"
              y1={baseTopOffset + lineY * lineSpacing}
              x2="10"
              y2={baseTopOffset + lineY * lineSpacing}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          ))}

          {/* Accidental Glyphs for Chord Notes */}
          {noteheadPositions.map((np, nIdx) => {
            if (!np.pitch.accidental) return null;
            const rightAnchor =
              np.offsetX - 8.5 - (nIdx % 2 === 1 && noteheadPositions.length > 1 ? 6 : 0);
            const accLayout = getAccidentalLayout(np.pitch.accidental, rightAnchor, np.noteY);
            return (
              <svg
                key={`acc-${nIdx}`}
                x={accLayout.x}
                y={accLayout.y}
                width={accLayout.width}
                height={accLayout.height}
                viewBox={accLayout.glyph.viewBox}
                className="pointer-events-none select-none fill-current text-slate-900 dark:text-slate-100"
                aria-hidden="true"
              >
                <path d={accLayout.glyph.d} fill="currentColor" />
              </svg>
            );
          })}

          {/* Noteheads for Chord Notes */}
          {noteheadPositions.map((np, nIdx) => {
            if (item.noteType === 'slash') {
              return (
                <line
                  key={`notehead-${nIdx}`}
                  x1={np.offsetX - 6}
                  y1={np.noteY + 7}
                  x2={np.offsetX + 6}
                  y2={np.noteY - 7}
                  strokeWidth="3.2"
                  strokeLinecap="square"
                  className={`group-hover:opacity-80 transition-opacity ${
                    isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'
                  }`}
                />
              );
            }
            const isGrace = item.noteType === 'grace';
            return (
              <ellipse
                key={`notehead-${nIdx}`}
                cx={np.offsetX}
                cy={np.noteY}
                rx={isGrace ? '4.5' : '6.5'}
                ry={isGrace ? '3.0' : '4.5'}
                transform={`rotate(-22 ${np.offsetX} ${np.noteY})`}
                strokeWidth={item.duration === 'w' || item.duration === 'h' ? '2.5' : '1'}
                className={`group-hover:opacity-80 transition-opacity ${
                  isPracticeTarget && practiceHitResult === 'correct'
                    ? 'fill-studio-success stroke-studio-success'
                    : isPracticeTarget && practiceHitResult === 'incorrect'
                      ? 'fill-studio-dangerStrong stroke-studio-dangerStrong'
                      : isItemPlaying
                        ? 'fill-studio-accent stroke-studio-accent'
                        : item.duration === 'w' || item.duration === 'h'
                          ? 'fill-none stroke-current'
                          : 'fill-current stroke-current'
                }`}
              />
            );
          })}

          {/* Common Stem for Chord */}
          {item.duration !== 'w' && (
            <>
              <line
                x1={stemX}
                y1={stemStartY}
                x2={stemX}
                y2={stemEndY}
                className={isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'}
                strokeWidth="1.5"
              />
              {/* Acciaccatura stroke through stem */}
              {item.noteType === 'grace' && item.graceType === 'acciaccatura' && (
                <line
                  x1={stemX - 4}
                  y1={stemEndY + (stemUp ? 6 : -6)}
                  x2={stemX + 6}
                  y2={stemEndY + (stemUp ? -2 : 2)}
                  className={isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'}
                  strokeWidth="1.4"
                />
              )}
            </>
          )}

          {/* Flag(s) - Only drawn when note is NOT beamed. El recuento y la
              geometría de las plicas viven en engraver/notation.ts */}
          {!isBeamed &&
            Array.from({ length: getFlagCount(item.duration) }, (_, flagIndex) => (
              <path
                key={flagIndex}
                d={getNoteFlagPath(stemX, stemEndY, stemUp, flagIndex)}
                className={isItemPlaying ? 'stroke-studio-accent' : 'stroke-current'}
                strokeWidth="2.5"
                fill="none"
              />
            ))}

          {/* Dotted Note Dot */}
          {item.isDotted && (
            <circle
              cx="10"
              cy={minY - 1}
              r="2"
              className={isItemPlaying ? 'fill-studio-accent' : 'fill-current'}
            />
          )}

          {/* Pedagogical Note Label(s) */}
          {showNoteNames &&
            (() => {
              const labelText = pitchInfos
                .map((pi) => formatPitchName(pi.pitch, namingConvention))
                .reverse()
                .join('/');
              const labelWidth = Math.max(22, labelText.length * 6.5 + 8);
              const noteTopY = stemUp && item.duration !== 'w' ? Math.min(minY, stemEndY) : minY;
              const labelY = noteTopY - 14;

              return (
                <g transform={`translate(0, ${labelY})`}>
                  <rect
                    x={-labelWidth / 2}
                    y={-7}
                    width={labelWidth}
                    height={14}
                    rx={3}
                    className="fill-white/95 stroke-blue-200/80 stroke-[0.5]"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[9px] font-bold fill-blue-600 select-none pointer-events-none"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })()}

          {/* Lyrics beneath staff */}
          {item.lyric && (
            <text
              x="0"
              y={baseTopOffset + staffHeight + 25}
              textAnchor="middle"
              className="text-[11px] font-serif italic fill-slate-800 dark:fill-slate-200 select-none"
            >
              {item.lyric}
            </text>
          )}

          {/* Chord symbol above staff */}
          {item.chord && (
            <text
              x="0"
              y={baseTopOffset - 18}
              textAnchor="middle"
              className="text-xs font-sans font-black fill-amber-600 dark:fill-pastel-amber select-none tracking-tight"
            >
              {item.chord}
            </text>
          )}

          {/* Articulation Symbol */}
          {item.articulation &&
            (() => {
              const artY =
                item.articulation === 'fermata'
                  ? Math.min(minY - 14, baseTopOffset - 12)
                  : stemUp
                    ? maxY + 12
                    : minY - 12;

              if (item.articulation === 'staccato') {
                return <circle cx="0" cy={artY} r="2.2" fill="currentColor" />;
              }
              if (item.articulation === 'accent') {
                return (
                  <path
                    d={`M -5.5 ${artY - 3} L 5 ${artY} L -5.5 ${artY + 3}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }
              if (item.articulation === 'tenuto') {
                return (
                  <line
                    x1="-6"
                    y1={artY}
                    x2="6"
                    y2={artY}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                );
              }
              if (item.articulation === 'marcato') {
                const marcY = stemUp ? maxY + 14 : minY - 14;
                return (
                  <path
                    d={`M -4.5 ${marcY + 4} L 0 ${marcY - 3} L 4.5 ${marcY + 4}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }
              if (item.articulation === 'staccatissimo') {
                const staccY = stemUp ? maxY + 12 : minY - 12;
                return (
                  <polygon
                    points={
                      stemUp
                        ? `0,${staccY + 6} -2.5,${staccY} 2.5,${staccY}`
                        : `0,${staccY - 6} -2.5,${staccY} 2.5,${staccY}`
                    }
                    fill="currentColor"
                  />
                );
              }
              if (item.articulation === 'portato') {
                return (
                  <g>
                    <line
                      x1="-5.5"
                      y1={artY}
                      x2="5.5"
                      y2={artY}
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="0" cy={stemUp ? artY + 5 : artY - 5} r="1.8" fill="currentColor" />
                  </g>
                );
              }
              if (item.articulation === 'downBow') {
                const bowY = minY - 16;
                return (
                  <path
                    d={`M -4.5 ${bowY + 6} L -4.5 ${bowY} L 4.5 ${bowY} L 4.5 ${bowY + 6}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="square"
                  />
                );
              }
              if (item.articulation === 'upBow') {
                const bowY = minY - 16;
                return (
                  <path
                    d={`M -4.5 ${bowY} L 0 ${bowY + 7} L 4.5 ${bowY}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }
              if (item.articulation === 'harmonic') {
                const harmY = minY - 16;
                return (
                  <circle
                    cx="0"
                    cy={harmY}
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                );
              }
              if (item.articulation === 'fermata') {
                return (
                  <g transform={`translate(0, ${artY})`}>
                    <path
                      d="M -7 0 C -7 -8 7 -8 7 0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <circle cx="0" cy="-2.5" r="1.6" fill="currentColor" />
                  </g>
                );
              }
              return null;
            })()}

          {/* Ornaments */}
          {item.ornament === 'trill' && (
            <text
              x="0"
              y={minY - 14}
              textAnchor="middle"
              className="font-serif italic font-bold text-xs fill-slate-800 dark:fill-slate-200 select-none"
            >
              tr
            </text>
          )}
          {item.ornament === 'mordent' && (
            <g
              transform={`translate(0, ${minY - 14}) scale(0.75)`}
              className="fill-current text-slate-800 dark:text-slate-200"
            >
              <path d={SVG_PATHS.mordent} stroke="currentColor" strokeWidth="1.6" fill="none" />
            </g>
          )}
          {item.ornament === 'turn' && (
            <g
              transform={`translate(0, ${minY - 14}) scale(0.85)`}
              className="fill-current text-slate-800 dark:text-slate-200"
            >
              <path d={SVG_PATHS.turn} stroke="currentColor" strokeWidth="1.6" fill="none" />
            </g>
          )}
          {item.ornament === 'arpeggio' && (
            <g className="text-slate-800 dark:text-slate-200">
              <path
                d={`M -14 ${minY} Q -17 ${(minY + maxY) / 2} -14 ${maxY}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeDasharray="2 2"
              />
            </g>
          )}

          {/* Fingering number */}
          {item.fingering && (
            <text
              x="0"
              y={stemUp && item.duration !== 'w' ? minY - 16 : maxY + 18}
              textAnchor="middle"
              className="text-[10px] font-sans font-bold fill-slate-700 dark:fill-slate-300 select-none"
            >
              {item.fingering}
            </text>
          )}

          {/* Piano Pedal Markings */}
          {item.pedal === 'start' && (
            <text
              x="0"
              y={baseTopOffset + staffHeight + 36}
              textAnchor="middle"
              className="text-[11px] font-serif font-black italic fill-slate-800 dark:fill-slate-200 select-none"
            >
              Ped.
            </text>
          )}
          {item.pedal === 'stop' && (
            <text
              x="0"
              y={baseTopOffset + staffHeight + 36}
              textAnchor="middle"
              className="text-sm font-serif font-bold fill-slate-800 dark:fill-slate-200 select-none"
            >
              *
            </text>
          )}

          {/* Dynamic Mark beneath staff */}
          {item.dynamic && (
            <text
              x="0"
              y={baseTopOffset + 4 * lineSpacing + 20}
              textAnchor="middle"
              className="font-serif italic font-black text-xs fill-slate-800 dark:fill-slate-200 select-none tracking-tighter"
            >
              {item.dynamic}
            </text>
          )}

          {/* Guitar Tablature Fret Number(s) (only for staff 0) */}
          {showTablature && staffIdx === 0 && (
            <g className="pointer-events-none select-none">
              {pitchInfos.map((pi, pIdx) => {
                const tabPos = pitchToGuitarTab(pi.pitch);
                if (!tabPos) return null;
                const tabY = tabTopOffset + (tabPos.stringNumber - 1) * tabLineSpacing;
                return (
                  <React.Fragment key={`tab-${pIdx}`}>
                    <rect
                      x="-6"
                      y={tabY - 5.5}
                      width="12"
                      height="11"
                      rx="2"
                      className="fill-white"
                    />
                    <text
                      x="0"
                      y={tabY + 3.5}
                      textAnchor="middle"
                      className={`text-[9.5px] font-mono font-bold select-none ${
                        isItemPlaying ? 'fill-amber-500 font-black' : 'fill-slate-800'
                      }`}
                    >
                      {tabPos.fret}
                    </text>
                  </React.Fragment>
                );
              })}
            </g>
          )}
        </g>
      );
    });

    const renderedTupletBrackets = tupletGroups.map((tg, tgIdx) => {
      const x1 = getItemX(tg.startIndex);
      const x2 = getItemX(tg.endIndex);

      let minY = baseTopOffset;
      for (let i = tg.startIndex; i <= tg.endIndex; i++) {
        const it = targetItems[i];
        if (it?.pitch) {
          const step = pitchToStaffStep(it.pitch, targetClef);
          const y = baseTopOffset + staffStepToY(step, lineSpacing);
          if (y < minY) minY = y;
        }
      }
      const bracketY = Math.min(baseTopOffset - 8, minY - 24);
      const midX = (x1 + x2) / 2;

      if (tg.startIndex === tg.endIndex) {
        return (
          <g
            key={`tuplet-${actualMeasureIdx}-${staffIdx}-${tgIdx}`}
            className="pointer-events-none select-none"
          >
            <text
              x={x1}
              y={bracketY + 2}
              textAnchor="middle"
              className="text-[11px] font-serif font-bold italic fill-slate-700 dark:fill-slate-200"
            >
              {tg.actual}
            </text>
          </g>
        );
      }

      const textGap = 7;
      const leftEnd = midX - textGap;
      const rightStart = midX + textGap;

      return (
        <g
          key={`tuplet-${actualMeasureIdx}-${staffIdx}-${tgIdx}`}
          className="pointer-events-none select-none text-slate-700 dark:text-slate-200"
        >
          <line
            x1={x1 - 6}
            y1={bracketY + 4}
            x2={x1 - 6}
            y2={bracketY}
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <line
            x1={x1 - 6}
            y1={bracketY}
            x2={leftEnd}
            y2={bracketY}
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <text
            x={midX}
            y={bracketY + 3.5}
            textAnchor="middle"
            className="text-[11px] font-serif font-bold italic fill-current"
          >
            {tg.actual}
          </text>
          <line
            x1={rightStart}
            y1={bracketY}
            x2={x2 + 6}
            y2={bracketY}
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <line
            x1={x2 + 6}
            y1={bracketY}
            x2={x2 + 6}
            y2={bracketY + 4}
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </g>
      );
    });

    const renderedBeams = beamGroups.map((bg) => (
      <g
        key={`bg-${actualMeasureIdx}-${staffIdx}-${bg.id}`}
        className="pointer-events-none select-none text-slate-900 dark:text-slate-100"
      >
        {/* Primary beam bar */}
        <line
          x1={bg.x1}
          y1={bg.y1}
          x2={bg.x2}
          y2={bg.y2}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="butt"
        />
        {/* Secondary beams for 16th and 32nd notes */}
        {bg.secondaryBeams.map((sb, sbIdx) => (
          <line
            key={`sec-${actualMeasureIdx}-${staffIdx}-${bg.id}-${sbIdx}`}
            x1={sb.x1}
            y1={sb.y1}
            x2={sb.x2}
            y2={sb.y2}
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="butt"
          />
        ))}
      </g>
    ));

    const renderedTiesAndSlurs: React.ReactNode[] = [];

    targetItems.forEach((item, itemIdx) => {
      if (item.type !== 'note') return;
      if (!item.isTied && item.slur !== 'start') return;

      const itemX = getItemX(itemIdx);
      const currentP = getItemPitches(item);
      if (currentP.length === 0) return;

      // Determine destination item and x2
      let destItem: ScoreItem | null = null;
      let destX = itemX + 35; // default fallback
      if (itemIdx + 1 < targetItems.length) {
        destItem = targetItems[itemIdx + 1];
        destX = getItemX(itemIdx + 1);
      } else {
        // Next measure in this staff
        const nextMeasure = (score.staves[staffIdx] || primaryStaff)?.measures[
          actualMeasureIdx + 1
        ];
        if (nextMeasure && nextMeasure.items.length > 0) {
          destItem = nextMeasure.items[0];
          destX = availableMeasureWidth + 16;
        } else {
          destX = availableMeasureWidth + 12;
        }
      }

      const beamedNote = beamedInfoMap.get(itemIdx);
      const isBeamed = beamedItemIndices.has(itemIdx) && !!beamedNote;
      const avgStep =
        currentP.reduce((s, p) => s + pitchToStaffStep(p, targetClef), 0) / currentP.length;
      const stemUp = isBeamed ? beamedNote.stemUp : avgStep > 4;

      if (item.isTied) {
        currentP.forEach((p, pIdx) => {
          const step = pitchToStaffStep(p, targetClef);
          const y1 = baseTopOffset + staffStepToY(step, lineSpacing);
          let y2 = y1;
          if (destItem && destItem.type === 'note') {
            const destP = getItemPitches(destItem);
            const matching =
              destP.find(
                (dp) =>
                  dp.step === p.step && dp.octave === p.octave && dp.accidental === p.accidental
              ) || destP[0];
            if (matching) {
              const destStep = pitchToStaffStep(matching, targetClef);
              y2 = baseTopOffset + staffStepToY(destStep, lineSpacing);
            }
          }

          const startX = itemX + 5;
          const endX = Math.max(startX + 14, destX - 5);
          const midX = (startX + endX) / 2;
          const arcOffset = stemUp ? 9 : -9;
          const ctrlY = (y1 + y2) / 2 + arcOffset;

          renderedTiesAndSlurs.push(
            <path
              key={`tie-${actualMeasureIdx}-${staffIdx}-${item.id}-${pIdx}`}
              d={`M ${startX} ${y1 + (stemUp ? 3.5 : -3.5)} Q ${midX} ${ctrlY} ${endX} ${y2 + (stemUp ? 3.5 : -3.5)}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="pointer-events-none select-none text-slate-800 dark:text-slate-200"
            />
          );
        });
      }

      if (item.slur === 'start') {
        let endIdx = itemIdx + 1;
        while (endIdx < targetItems.length && targetItems[endIdx].slur !== 'stop') {
          endIdx++;
        }
        const stopItem = targetItems[Math.min(endIdx, targetItems.length - 1)];
        const slurEndX =
          endIdx < targetItems.length ? getItemX(endIdx) : availableMeasureWidth + 14;

        const startStep = pitchToStaffStep(currentP[0], targetClef);
        const y1 = baseTopOffset + staffStepToY(startStep, lineSpacing);
        let y2 = y1;
        if (stopItem && stopItem.type === 'note') {
          const stopP = getItemPitches(stopItem)[0];
          if (stopP) {
            y2 = baseTopOffset + staffStepToY(pitchToStaffStep(stopP, targetClef), lineSpacing);
          }
        }

        const startX = itemX + 5;
        const endX = Math.max(startX + 20, slurEndX - 5);
        const midX = (startX + endX) / 2;
        const slurArcOffset = stemUp
          ? Math.max(14, (endX - startX) * 0.18)
          : -Math.max(14, (endX - startX) * 0.18);
        const ctrlY = (y1 + y2) / 2 + slurArcOffset;

        renderedTiesAndSlurs.push(
          <path
            key={`slur-${actualMeasureIdx}-${staffIdx}-${item.id}`}
            d={`M ${startX} ${y1 + (stemUp ? 5 : -5)} Q ${midX} ${ctrlY} ${endX} ${y2 + (stemUp ? 5 : -5)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="pointer-events-none select-none text-slate-800 dark:text-slate-200"
          />
        );
      }
    });

    const renderedHairpins: React.ReactNode[] = [];
    targetItems.forEach((item, idx) => {
      if (item.hairpin === 'cresc' || item.hairpin === 'decresc') {
        const startX = getItemX(idx);
        let endIdx = idx + 1;
        while (endIdx < targetItems.length && targetItems[endIdx].hairpin !== 'stop') {
          endIdx++;
        }
        const endX = endIdx < targetItems.length ? getItemX(endIdx) : availableMeasureWidth - 10;
        const hpY = baseTopOffset + staffHeight + 18;
        const isCresc = item.hairpin === 'cresc';

        renderedHairpins.push(
          <g
            key={`hairpin-${actualMeasureIdx}-${staffIdx}-${item.id}`}
            className="text-slate-800 dark:text-slate-200 pointer-events-none select-none"
          >
            {isCresc ? (
              <>
                <line
                  x1={startX}
                  y1={hpY}
                  x2={endX}
                  y2={hpY - 5}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <line
                  x1={startX}
                  y1={hpY}
                  x2={endX}
                  y2={hpY + 5}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <line
                  x1={startX}
                  y1={hpY - 5}
                  x2={endX}
                  y2={hpY}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <line
                  x1={startX}
                  y1={hpY + 5}
                  x2={endX}
                  y2={hpY}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </>
            )}
          </g>
        );
      }
    });

    return (
      <React.Fragment key={`staff-group-${staffIdx}-${actualMeasureIdx}`}>
        {renderedItems}
        {renderedBeams}
        {renderedTupletBrackets}
        {renderedTiesAndSlurs}
        {renderedHairpins}
      </React.Fragment>
    );
  };

  /* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
  return (
    <div
      ref={containerRef}
      onClick={() => onSelectItem(selectedMeasureIdx, null, selectedStaffIdx)}
      className="score-view-container flex-1 overflow-auto bg-slate-100 dark:bg-studio-bg p-3 sm:p-6 flex justify-center items-start select-none print:p-0 print:block print:w-full print:max-w-full print:overflow-visible"
    >
      {/* Paper Sheet container */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectItem(selectedMeasureIdx, null, selectedStaffIdx);
        }}
        className={
          layoutMode === 'paged'
            ? 'score-paged-layout w-[840px] min-w-[840px] shrink-0 my-0 mx-auto flex flex-col items-center select-none print:w-full print:min-w-0 print:max-w-full print:block print:m-0'
            : 'score-sheet bg-white text-slate-900 shadow-xl rounded-2xl p-6 sm:p-8 w-[840px] min-w-[840px] shrink-0 my-0 mx-auto border border-slate-200 dark:border-slate-300 shadow-slate-300/50 dark:shadow-black/50 transition-colors print:w-full print:min-w-0 print:max-w-full print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none'
        }
      >
        {/* Continuous Mode Header (Page 1 has its own header in Paged mode) */}
        {layoutMode === 'continuous' && (
          <div className="text-center mb-6 border-b border-slate-100 pb-6 relative w-full">
            {isPartView && (
              <div className="inline-block mb-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700 border border-blue-200">
                Particella: {score.staves[effectiveStaffIdx]?.name || 'Instrumento'}{' '}
                {transpositionSemitones !== 0
                  ? `(${TRANSPOSITION_PRESETS.find((p) => p.semitones === transpositionSemitones)?.shortLabel || `+${transpositionSemitones}`})`
                  : ''}
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
                  ♩ = {score.tempo} ({score.timeSignature.beats}/{score.timeSignature.beatType}) •{' '}
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
        )}

        {/* La selección de Vista (General/partes) y Maquetación vive en el
            Inspector > Partitura: el encabezado tipográfico queda pegado a los
            sistemas y el documento no contiene controles en su flujo. */}

        {/* Systems (Lines of Staffs) */}
        {(() => {
          const renderSystem = (system: SystemInfo) => {
            const systemIdx = system.systemIndex;
            const startMeasureIdx = system.startMeasureIndex;
            const systemMeasures = system.measures;
            const isFirstSystem = systemIdx === 0;

            // Width calculations - 776px fits an 840px A4 page with 32px margins without overflow
            const systemWidth = 776;
            const headerWidth = isFirstSystem || displayStaves.length > 1 ? 120 : 60;
            const availableMeasureWidth =
              (systemWidth - headerWidth) / (systemMeasures.length || 1);

            const systemBottomY = getStaffTopOffset(stavesCount - 1) + staffHeight;

            return (
              <div key={`system-${systemIdx}`} className="system-container relative mb-10 print:mb-4 w-full">
                <svg
                  width={systemWidth}
                  height={systemHeight}
                  viewBox={`0 0 ${systemWidth} ${systemHeight}`}
                  className="overflow-visible cursor-pointer print:w-full print:h-auto"
                  onMouseLeave={handleStaffMouseLeave}
                >
                  {/* System Start Measure Number (for conductors/rehearsal) */}
                  {systemIdx > 0 &&
                    (() => {
                      const startNum = primaryStaff.measures[0]?.isAnacrusis
                        ? startMeasureIdx
                        : startMeasureIdx + 1;
                      const badgeWidth = Math.max(20, String(startNum).length * 7.5 + 8);
                      const badgeX = 0;
                      const badgeY = getStaffTopOffset(0) - 26;
                      return (
                        <g className="system-measure-number select-none pointer-events-none">
                          <rect
                            x={badgeX}
                            y={badgeY}
                            width={badgeWidth}
                            height={15}
                            rx={3}
                            className="fill-slate-100 stroke-slate-300"
                            strokeWidth="1"
                          />
                          <text
                            x={badgeX + badgeWidth / 2}
                            y={badgeY + 11.5}
                            textAnchor="middle"
                            className="text-[10px] font-bold font-mono fill-slate-800 select-none"
                          >
                            {startNum}
                          </text>
                        </g>
                      );
                    })()}

                  {/* Grand Staff Piano Brace */}
                  {isGrandStaff && (
                    <g className="grand-staff-brace select-none">
                      <path
                        d={`M 12 ${getStaffTopOffset(0)}
                         C 2 ${getStaffTopOffset(0) + 20}, 0 ${getStaffTopOffset(0) + 45}, -7 ${getStaffTopOffset(0) + 62.5}
                         C 0 ${getStaffTopOffset(0) + 80}, 2 ${getStaffTopOffset(0) + 105}, 12 ${getStaffTopOffset(1) + staffHeight}
                         C 6 ${getStaffTopOffset(0) + 105}, 4 ${getStaffTopOffset(0) + 80}, -2 ${getStaffTopOffset(0) + 62.5}
                         C 4 ${getStaffTopOffset(0) + 45}, 6 ${getStaffTopOffset(0) + 20}, 12 ${getStaffTopOffset(0)} Z`}
                        className="fill-slate-800 dark:fill-slate-200"
                      />
                      <line
                        x1={12}
                        y1={getStaffTopOffset(0)}
                        x2={12}
                        y2={getStaffTopOffset(1) + staffHeight}
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                    </g>
                  )}

                  {/* Orchestral Bracket for multi-instrument ensembles */}
                  {displayStaves.length > 1 && !isGrandStaff && (
                    <g className="orchestral-bracket select-none text-slate-800 dark:text-slate-200">
                      <line
                        x1={4}
                        y1={getStaffTopOffset(0)}
                        x2={4}
                        y2={systemBottomY}
                        stroke="currentColor"
                        strokeWidth="3.5"
                      />
                      <line
                        x1={4}
                        y1={getStaffTopOffset(0)}
                        x2={14}
                        y2={getStaffTopOffset(0)}
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                      <line
                        x1={4}
                        y1={systemBottomY}
                        x2={14}
                        y2={systemBottomY}
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                    </g>
                  )}

                  {/* System Start Barline connecting staves */}
                  <line
                    x1={2}
                    y1={getStaffTopOffset(0)}
                    x2={2}
                    y2={systemBottomY}
                    stroke="currentColor"
                    strokeWidth={displayStaves.length > 1 ? '2.5' : '1.5'}
                  />

                  {/* 5 Horizontal Staff Lines for each displayed staff */}
                  {displayStaves.map((st, sIdx) => {
                    const curTop = getStaffTopOffset(sIdx);
                    return (
                      <g key={`staff-lines-${st.id || sIdx}`}>
                        {[0, 1, 2, 3, 4].map((lineIdx) => (
                          <line
                            key={`line-${sIdx}-${lineIdx}`}
                            x1={0}
                            y1={curTop + lineIdx * lineSpacing}
                            x2={systemWidth}
                            y2={curTop + lineIdx * lineSpacing}
                            stroke="currentColor"
                            strokeWidth="1.2"
                            className="text-slate-300 dark:text-slate-700/80"
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* 6 Horizontal Guitar Tablature Lines */}
                  {showTablature && (
                    <>
                      <text
                        x="8"
                        y={tabTopOffset + 15}
                        className="text-[10px] font-mono font-black fill-slate-400 select-none tracking-widest"
                        style={{ writingMode: 'vertical-rl' }}
                      >
                        TAB
                      </text>
                      {[0, 1, 2, 3, 4, 5].map((tabLineIdx) => (
                        <line
                          key={`tab-line-${tabLineIdx}`}
                          x1={0}
                          y1={tabTopOffset + tabLineIdx * tabLineSpacing}
                          x2={systemWidth}
                          y2={tabTopOffset + tabLineIdx * tabLineSpacing}
                          stroke="currentColor"
                          strokeWidth="1"
                          className="text-slate-300/80 dark:text-slate-700/60"
                        />
                      ))}
                    </>
                  )}

                  {/* Staff Header: Name, Clef, Key Signature, Time Signature for each staff */}
                  {displayStaves.map((st, sIdx) => {
                    const curTop = getStaffTopOffset(sIdx);
                    const curClef = st.clef || 'treble';
                    const curKeyOffsets = getKeySignatureOffsets(curClef);
                    return (
                      <g key={`staff-header-${st.id || sIdx}`}>
                        {/* Instrument Name */}
                        {(isFirstSystem || displayStaves.length > 1) && (
                          <text
                            x={16}
                            y={curTop - 8}
                            className="text-[10px] font-sans font-bold fill-slate-600 dark:fill-slate-400 select-none"
                          >
                            {isFirstSystem ? st.name : st.shortName || st.name}
                          </text>
                        )}

                        {/* Clefs rendered as pure vector inline SVGs (no network/file dependency, prints instantly) */}
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

                        {/* Key Signature Accidentals */}
                        <g transform={`translate(${curClef === 'bass' ? 48 : 46}, 0)`}>
                          {curKeyOffsets.map((kOff, kIdx) => {
                            const ky = curTop + staffStepToY(kOff.step, lineSpacing);
                            const keyLayout = getAccidentalLayout(
                              kOff.type,
                              (kIdx + 1) * 8.5,
                              ky,
                              kOff.type === 'b' ? 19.5 : 16
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

                        {/* Time Signature (on first system only) */}
                        {isFirstSystem &&
                          renderTimeSignatureGlyphs(
                            score.timeSignature.beats,
                            score.timeSignature.beatType,
                            headerWidth - 28,
                            curTop,
                            `header-ts-${st.id || sIdx}`
                          )}
                      </g>
                    );
                  })}

                  {/* Measures in this System */}
                  {systemMeasures.map((measure, mSubIdx) => {
                    const actualMeasureIdx = startMeasureIdx + mSubIdx;
                    const measureX = headerWidth + mSubIdx * availableMeasureWidth;
                    const isSelectedMeasure = selectedMeasureIdx === actualMeasureIdx;
                    const isJustAddedMeasure = justAddedMeasureIdx === actualMeasureIdx;

                    return (
                      <g
                        key={measure.id}
                        transform={`translate(${measureX}, 0)`}
                        data-measure-idx={actualMeasureIdx}
                        className={isJustAddedMeasure ? 'animate-measure-in' : undefined}
                        onMouseMove={(e) => handleStaffMouseMove(e, actualMeasureIdx, measureX)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey && onSelectMeasure) {
                            onSelectMeasure(actualMeasureIdx, true, hoveredStaffIdx);
                            return;
                          }
                          const inserted = handleStaffClick(actualMeasureIdx);
                          if (!inserted && onSelectMeasure) {
                            onSelectMeasure(actualMeasureIdx, false, hoveredStaffIdx);
                          }
                        }}
                      >
                        {/* Interactive click hotspot for measure covering full system height */}
                        <rect
                          x={0}
                          y={0}
                          width={availableMeasureWidth}
                          height={systemHeight}
                          fill="transparent"
                          className="measure-hotspot transition-colors no-print cursor-pointer hover:fill-blue-500/5 dark:hover:fill-blue-500/10"
                        />

                        {/* Destello breve que confirma la creación del compás. */}
                        {isJustAddedMeasure && (
                          <rect
                            x={0}
                            y={getStaffTopOffset(0) - 8}
                            width={availableMeasureWidth}
                            height={systemBottomY - getStaffTopOffset(0) + 16}
                            className="animate-measure-flash pointer-events-none fill-blue-500/25 no-print"
                          />
                        )}

                        {/* Target Measure Drop Highlight when dragging a note across measures */}
                        {dragState?.hasMoved &&
                          dragState.targetMeasureIdx === actualMeasureIdx &&
                          actualMeasureIdx !== dragState.sourceMeasureIdx && (
                            <rect
                              x={2}
                              y={getStaffTopOffset(0) - 14}
                              width={availableMeasureWidth - 4}
                              height={systemBottomY - getStaffTopOffset(0) + 28}
                              strokeWidth="2"
                              strokeDasharray="6 3"
                              rx="6"
                              className="pointer-events-none animate-pulse fill-studio-accent/[0.08] stroke-studio-accent no-print"
                            />
                          )}

                        {/* Measure number label */}
                        <text
                          x={4}
                          y={getStaffTopOffset(0) - 8}
                          className={`text-[10px] font-mono select-none ${
                            measure.isAnacrusis
                              ? 'fill-emerald-600 dark:fill-emerald-400 font-semibold'
                              : 'fill-slate-400'
                          }`}
                        >
                          {measure.isAnacrusis
                            ? 'Anacrusa'
                            : primaryStaff.measures[0]?.isAnacrusis
                              ? actualMeasureIdx
                              : actualMeasureIdx + 1}
                        </text>

                        {/* Rehearsal Mark ([A], [B], [Intro]...) */}
                        {measure.rehearsalMark && (
                          <g
                            className="rehearsal-mark select-none pointer-events-none"
                            transform={`translate(2, ${getStaffTopOffset(0) - 28})`}
                          >
                            <rect
                              x={0}
                              y={0}
                              width={Math.max(20, measure.rehearsalMark.length * 8 + 10)}
                              height={16}
                              rx={3}
                              className="fill-white stroke-slate-800"
                              strokeWidth="1.6"
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

                        {/* Local Tempo Text (e.g. Allegro, Rit., A tempo) */}
                        {measure.tempoText && (
                          <text
                            x={
                              measure.rehearsalMark
                                ? Math.max(26, measure.rehearsalMark.length * 8 + 16)
                                : 4
                            }
                            y={getStaffTopOffset(0) - 14}
                            className="text-xs font-serif font-black italic fill-slate-900 dark:fill-slate-100 select-none pointer-events-none"
                          >
                            {measure.tempoText}{' '}
                            {measure.tempoBpm ? `(♩ = ${measure.tempoBpm})` : ''}
                          </text>
                        )}

                        {/* Navigation Marks (Segno, Coda, D.C., D.S. al Coda, Fine...) */}
                        {measure.navigationMark === 'segno' && (
                          <svg
                            x={availableMeasureWidth / 2 - 10}
                            y={getStaffTopOffset(0) - 27}
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
                            transform={`translate(${availableMeasureWidth / 2 - 10}, ${getStaffTopOffset(0) - 26}) scale(0.85)`}
                            className="text-slate-900 dark:text-slate-100 pointer-events-none select-none"
                          >
                            <path
                              d={SVG_PATHS.coda}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                          </g>
                        )}
                        {measure.navigationMark &&
                          [
                            'daCapo',
                            'dalSegno',
                            'daCapoAlFine',
                            'dalSegnoAlCoda',
                            'toCoda',
                            'fine',
                          ].includes(measure.navigationMark) && (
                            <text
                              x={availableMeasureWidth - 6}
                              y={getStaffTopOffset(0) - 12}
                              textAnchor="end"
                              className="text-[11px] font-serif font-black italic fill-slate-900 dark:fill-slate-100 select-none pointer-events-none"
                            >
                              {measure.navigationMark === 'daCapo'
                                ? 'D.C.'
                                : measure.navigationMark === 'dalSegno'
                                  ? 'D.S.'
                                  : measure.navigationMark === 'daCapoAlFine'
                                    ? 'D.C. al Fine'
                                    : measure.navigationMark === 'dalSegnoAlCoda'
                                      ? 'D.S. al Coda'
                                      : measure.navigationMark === 'toCoda'
                                        ? 'To Coda 𝄌'
                                        : 'Fine'}
                            </text>
                          )}

                        {/* Caesura (//) and Breath Mark (’) */}
                        {measure.caesura && (
                          <g
                            transform={`translate(${availableMeasureWidth - 14}, ${getStaffTopOffset(0) + 4})`}
                            className="text-slate-900 dark:text-slate-100 pointer-events-none select-none"
                          >
                            <path
                              d={SVG_PATHS.caesura}
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                          </g>
                        )}
                        {measure.breathMark && (
                          <g
                            transform={`translate(${availableMeasureWidth - 10}, ${getStaffTopOffset(0) - 8}) scale(0.8)`}
                            className="text-slate-900 dark:text-slate-100 pointer-events-none select-none"
                          >
                            <path d={SVG_PATHS.breathMark} fill="currentColor" />
                          </g>
                        )}

                        {/* Measure Repeat Sign (%) */}
                        {measure.isMeasureRepeat && (
                          <g
                            transform={`translate(${availableMeasureWidth / 2 - 12}, ${getStaffTopOffset(0) + 8}) scale(0.95)`}
                            className="text-slate-800 dark:text-slate-200 pointer-events-none select-none"
                          >
                            <path
                              d={SVG_PATHS.measureRepeat}
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="currentColor"
                            />
                          </g>
                        )}

                        {/* Metric Modulation (Time Signature Change at Measure) */}
                        {measure.timeSignatureChange &&
                          displayStaves.map((_, sIdx) => {
                            const staffTop = getStaffTopOffset(sIdx);
                            return renderTimeSignatureGlyphs(
                              measure.timeSignatureChange!.beats,
                              measure.timeSignatureChange!.beatType,
                              12,
                              staffTop,
                              `meas-ts-${actualMeasureIdx}-${sIdx}`
                            );
                          })}

                        {/* System & Page Break Badges */}
                        {measure.pageBreak ? (
                          <g
                            className="cursor-pointer select-none no-print"
                            transform={`translate(${availableMeasureWidth - 28}, ${getStaffTopOffset(0) - 20})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePageBreak?.(actualMeasureIdx);
                            }}
                          >
                            <rect
                              width="24"
                              height="13"
                              rx="3"
                              className="fill-studio-selectionDeep"
                            />
                            <text
                              x="12"
                              y="9.5"
                              textAnchor="middle"
                              className="text-[9px] font-bold fill-white font-sans"
                            >
                              📄
                            </text>
                          </g>
                        ) : measure.systemBreak ? (
                          <g
                            className="cursor-pointer select-none no-print"
                            transform={`translate(${availableMeasureWidth - 24}, ${getStaffTopOffset(0) - 20})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSystemBreak?.(actualMeasureIdx);
                            }}
                          >
                            <rect width="20" height="13" rx="3" className="fill-studio-selection" />
                            <text
                              x="10"
                              y="9.5"
                              textAnchor="middle"
                              className="text-[9px] font-bold fill-white font-sans"
                            >
                              ↵
                            </text>
                          </g>
                        ) : null}

                        {/* Measure Range Selection Highlight */}
                        {measureRange &&
                          actualMeasureIdx >= Math.min(measureRange.start, measureRange.end) &&
                          actualMeasureIdx <= Math.max(measureRange.start, measureRange.end) && (
                            <rect
                              x={0}
                              y={getStaffTopOffset(0) - 12}
                              width={availableMeasureWidth}
                              height={systemBottomY - getStaffTopOffset(0) + 24}
                              strokeWidth="2"
                              rx="4"
                              className="pointer-events-none fill-studio-selectionLight/[0.12] stroke-studio-selectionLight no-print"
                            />
                          )}

                        {/* Selected Measure Visual Frame */}
                        {isSelectedMeasure && !measureRange && (
                          <rect
                            x={0}
                            y={getStaffTopOffset(0) - 12}
                            width={availableMeasureWidth}
                            height={systemBottomY - getStaffTopOffset(0) + 24}
                            fill="none"
                            strokeWidth="1.5"
                            strokeDasharray="4 2"
                            rx="4"
                            className="stroke-studio-selectionLight opacity-70 pointer-events-none no-print"
                          />
                        )}

                        {/* Staff Items for all displayed staves */}
                        {displayStaves.map((curStaff, sIdx) => {
                          const actualStaffIdx = isPartView ? effectiveStaffIdx : sIdx;
                          const curMeasure = curStaff.measures[actualMeasureIdx];
                          if (!curMeasure) return null;
                          return (
                            <g key={`meas-staff-${curStaff.id || sIdx}-${actualMeasureIdx}`}>
                              {renderStaffItems(
                                curMeasure.items,
                                curStaff.clef || 'treble',
                                getStaffTopOffset(sIdx),
                                actualStaffIdx,
                                actualMeasureIdx,
                                availableMeasureWidth
                              )}
                            </g>
                          );
                        })}

                        {/* Indicador de carril de octava activa (Guía Visual - Opción C) */}
                        {hoveredMeasureIdx === actualMeasureIdx &&
                          !playbackState.isPlaying &&
                          !isRestMode &&
                          isOctaveLockEnabled &&
                          activeOctave !== undefined &&
                          (() => {
                            const targetSt = score.staves[hoveredStaffIdx] || score.staves[0];
                            const targetClef = targetSt?.clef || 'treble';
                            const displaySIdx = isPartView
                              ? 0
                              : Math.max(0, Math.min(displayStaves.length - 1, hoveredStaffIdx));
                            const ghostTopOffset = getStaffTopOffset(displaySIdx);
                            const stepHigh = pitchToStaffStep(
                              { step: 'B', octave: activeOctave, accidental: null },
                              targetClef
                            );
                            const stepLow = pitchToStaffStep(
                              { step: 'C', octave: activeOctave, accidental: null },
                              targetClef
                            );
                            const yTop = ghostTopOffset + staffStepToY(stepHigh, lineSpacing) - 6;
                            const yBottom = ghostTopOffset + staffStepToY(stepLow, lineSpacing) + 6;
                            const laneHeight = Math.max(16, yBottom - yTop);

                            return (
                              <g className="pointer-events-none select-none">
                                <rect
                                  x={4}
                                  y={yTop}
                                  width={availableMeasureWidth - 8}
                                  height={laneHeight}
                                  rx={5}
                                  className="fill-amber-400/[0.12] dark:fill-amber-300/[0.1] stroke-amber-500/50"
                                  strokeWidth="1.5"
                                  strokeDasharray="4 3"
                                />
                                {/* Insignia de octava activa en la esquina del recuadro */}
                                <rect
                                  x={6}
                                  y={yTop + 3}
                                  width={38}
                                  height={13}
                                  rx={3}
                                  className="fill-amber-500 dark:fill-amber-600"
                                />
                                <text
                                  x={25}
                                  y={yTop + 12.5}
                                  textAnchor="middle"
                                  className="text-[9px] font-sans font-black fill-slate-950 select-none"
                                >
                                  Oct {activeOctave}
                                </text>
                              </g>
                            );
                          })()}

                        {/* Ghost Note Preview on Hover */}
                        {hoveredMeasureIdx === actualMeasureIdx &&
                          hoveredBarlineIdx === null &&
                          hoveredStaffStep !== null &&
                          hoveredX !== null &&
                          !isRestMode &&
                          (() => {
                            const targetSt = score.staves[hoveredStaffIdx] || score.staves[0];
                            const targetM = targetSt?.measures[actualMeasureIdx];
                            const canFit = canStaffMeasureFit(targetM, actualMeasureIdx);
                            const targetClef = targetSt?.clef || 'treble';

                            const naturalPitch = staffStepToPitch(
                              hoveredStaffStep,
                              targetClef,
                              activeAccidental
                            );

                            let ghostPitch: Pitch = naturalPitch;
                            if (isOctaveLockEnabled && activeOctave !== undefined) {
                              const stepHigh = pitchToStaffStep(
                                { step: 'B', octave: activeOctave, accidental: null },
                                targetClef
                              );
                              const stepLow = pitchToStaffStep(
                                { step: 'C', octave: activeOctave, accidental: null },
                                targetClef
                              );
                              const minStep = Math.min(stepHigh, stepLow);
                              const maxStep = Math.max(stepHigh, stepLow);
                              const isInsideLane =
                                hoveredStaffStep >= minStep - 1 && hoveredStaffStep <= maxStep + 1;

                              if (isInsideLane) {
                                ghostPitch = {
                                  ...naturalPitch,
                                  octave: activeOctave,
                                };
                              }
                            }

                            const displaySIdx = isPartView
                              ? 0
                              : Math.max(0, Math.min(displayStaves.length - 1, hoveredStaffIdx));
                            const ghostTopOffset = getStaffTopOffset(displaySIdx);
                            const noteY =
                              ghostTopOffset + staffStepToY(hoveredStaffStep, lineSpacing);
                            const ghostLedgerLines = getLedgerLines(hoveredStaffStep);

                            return (
                              <g
                                transform={`translate(${Math.max(
                                  15,
                                  Math.min(availableMeasureWidth - 25, hoveredX)
                                )}, 0)`}
                                className="pointer-events-none transition-opacity opacity-75 text-blue-600 dark:text-blue-400"
                              >
                                {/* Ghost ledger lines */}
                                {ghostLedgerLines.map((lineY, lIdx) => (
                                  <line
                                    key={`ghost-ledger-${lIdx}`}
                                    x1="-10"
                                    y1={ghostTopOffset + lineY * lineSpacing}
                                    x2="10"
                                    y2={ghostTopOffset + lineY * lineSpacing}
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                  />
                                ))}

                                {/* Ghost Accidental */}
                                {activeAccidental && (() => {
                                  const ghostLayout = getAccidentalLayout(
                                    activeAccidental,
                                    -8.5,
                                    noteY
                                  );
                                  return (
                                    <svg
                                      x={ghostLayout.x}
                                      y={ghostLayout.y}
                                      width={ghostLayout.width}
                                      height={ghostLayout.height}
                                      viewBox={ghostLayout.glyph.viewBox}
                                      className="pointer-events-none select-none fill-current"
                                      aria-hidden="true"
                                    >
                                      <path d={ghostLayout.glyph.d} fill="currentColor" />
                                    </svg>
                                  );
                                })()}

                                {/* Ghost notehead */}
                                <ellipse
                                  cx="0"
                                  cy={noteY}
                                  rx="6.5"
                                  ry="4.5"
                                  transform={`rotate(-22 0 ${noteY})`}
                                  fill="currentColor"
                                />

                                {/* Ghost tooltip showing note name and auto-advance indicator */}
                                <text
                                  x="0"
                                  y={noteY - 10}
                                  textAnchor="middle"
                                  className="text-[10px] font-bold fill-blue-600 dark:fill-blue-400"
                                >
                                  {`${formatPitchName(ghostPitch, namingConvention)} (${
                                    activeDuration === 'w'
                                      ? '1'
                                      : activeDuration === 'h'
                                        ? '½'
                                        : activeDuration === 'q'
                                          ? '¼'
                                          : activeDuration === '8'
                                            ? '⅛'
                                            : '1/16'
                                  })${!canFit ? ' →' : ''}`}
                                </text>
                              </g>
                            );
                          })()}

                        {/* Playback Cursor Line */}
                        {playbackState.isPlaying &&
                          playbackState.currentMeasureIndex === actualMeasureIdx &&
                          (() => {
                            const targetPositions = calculateItemPositions(
                              measure.items,
                              availableMeasureWidth,
                              getMeasureTimeSignature(actualMeasureIdx)
                            );
                            const cursorX =
                              targetPositions[playbackState.currentItemIndex]?.x ?? 20;
                            return (
                              <line
                                x1={cursorX}
                                y1={getStaffTopOffset(0) - 6}
                                x2={cursorX}
                                y2={systemBottomY + 6}
                                strokeWidth="2.5"
                                className="pointer-events-none stroke-studio-accent"
                              />
                            );
                          })()}

                        {/* Volta (Casilla 1ª / 2ª vez) */}
                        {measure.volta && (
                          <g className="volta-bracket text-slate-800 dark:text-slate-200">
                            <line
                              x1={0}
                              y1={getStaffTopOffset(0) - 18}
                              x2={availableMeasureWidth}
                              y2={getStaffTopOffset(0) - 18}
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <line
                              x1={0}
                              y1={getStaffTopOffset(0) - 18}
                              x2={0}
                              y2={getStaffTopOffset(0) - 9}
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            {measure.repeatEnd && (
                              <line
                                x1={availableMeasureWidth}
                                y1={getStaffTopOffset(0) - 18}
                                x2={availableMeasureWidth}
                                y2={getStaffTopOffset(0) - 9}
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                            )}
                            <text
                              x={6}
                              y={getStaffTopOffset(0) - 22}
                              className="text-[11px] font-bold font-serif fill-current select-none"
                            >
                              {measure.volta}
                            </text>
                          </g>
                        )}

                        {/* Repeat Start Barline (|:) at start of measure */}
                        {measure.repeatStart && (
                          <g className="repeat-start-barline text-slate-900 dark:text-slate-100">
                            <line
                              x1={1.5}
                              y1={getStaffTopOffset(0)}
                              x2={1.5}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="3.5"
                            />
                            <line
                              x1={5}
                              y1={getStaffTopOffset(0)}
                              x2={5}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            {displayStaves.map((_, sIdx) => {
                              const top = getStaffTopOffset(sIdx);
                              return (
                                <React.Fragment key={`rep-start-${sIdx}`}>
                                  <circle
                                    cx={8.5}
                                    cy={top + lineSpacing * 1.5}
                                    r={2.5}
                                    fill="currentColor"
                                  />
                                  <circle
                                    cx={8.5}
                                    cy={top + lineSpacing * 2.5}
                                    r={2.5}
                                    fill="currentColor"
                                  />
                                </React.Fragment>
                              );
                            })}
                          </g>
                        )}

                        {/* Barline at the end of each measure */}
                        {measure.repeatEnd ? (
                          <g className="repeat-end-barline text-slate-900 dark:text-slate-100">
                            {displayStaves.map((_, sIdx) => {
                              const top = getStaffTopOffset(sIdx);
                              return (
                                <React.Fragment key={`rep-end-${sIdx}`}>
                                  <circle
                                    cx={availableMeasureWidth - 8.5}
                                    cy={top + lineSpacing * 1.5}
                                    r={2.5}
                                    fill="currentColor"
                                  />
                                  <circle
                                    cx={availableMeasureWidth - 8.5}
                                    cy={top + lineSpacing * 2.5}
                                    r={2.5}
                                    fill="currentColor"
                                  />
                                </React.Fragment>
                              );
                            })}
                            <line
                              x1={availableMeasureWidth - 5}
                              y1={getStaffTopOffset(0)}
                              x2={availableMeasureWidth - 5}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <line
                              x1={availableMeasureWidth - 1.5}
                              y1={getStaffTopOffset(0)}
                              x2={availableMeasureWidth - 1.5}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="3.5"
                            />
                          </g>
                        ) : measure.barline === 'double' ? (
                          <g className="double-barline text-slate-900 dark:text-slate-100">
                            <line
                              x1={availableMeasureWidth - 3.5}
                              y1={getStaffTopOffset(0)}
                              x2={availableMeasureWidth - 3.5}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <line
                              x1={availableMeasureWidth}
                              y1={getStaffTopOffset(0)}
                              x2={availableMeasureWidth}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                          </g>
                        ) : measure.barline === 'final' ||
                          actualMeasureIdx === totalMeasures - 1 ? (
                          <g className="final-barline text-slate-900 dark:text-slate-100">
                            <line
                              x1={availableMeasureWidth - 4}
                              y1={getStaffTopOffset(0)}
                              x2={availableMeasureWidth - 4}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <line
                              x1={availableMeasureWidth - 1.5}
                              y1={getStaffTopOffset(0)}
                              x2={availableMeasureWidth - 1.5}
                              y2={systemBottomY}
                              stroke="currentColor"
                              strokeWidth="3.2"
                            />
                          </g>
                        ) : (
                          <line
                            x1={availableMeasureWidth}
                            y1={getStaffTopOffset(0)}
                            x2={availableMeasureWidth}
                            y2={systemBottomY}
                            stroke="currentColor"
                            strokeWidth="1.2"
                            className="text-slate-400 dark:text-slate-600"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Quick Add Measure '+' buttons at barline intersections */}
                  {systemMeasures.map((measure, mSubIdx) => {
                    const actualMeasureIdx = startMeasureIdx + mSubIdx;
                    const barlineX = headerWidth + (mSubIdx + 1) * availableMeasureWidth;
                    const isHovered = hoveredBarlineIdx === actualMeasureIdx;
                    const barlineCenterY = (getStaffTopOffset(0) + systemBottomY) / 2;
                    const showAddMeasureButton =
                      isHovered && !dragState && !playbackState.isPlaying;

                    return (
                      <g
                        key={`barline-add-${measure.id}`}
                        className="barline-intersection-control no-print select-none"
                        onMouseEnter={() => setHoveredBarlineIdx(actualMeasureIdx)}
                        onMouseLeave={() => {
                          setHoveredBarlineIdx((current) =>
                            current === actualMeasureIdx ? null : current
                          );
                        }}
                      >
                        {/* Invisible hotspot covering the barline intersection */}
                        <rect
                          x={barlineX - 14}
                          y={getStaffTopOffset(0) - 8}
                          width={28}
                          height={systemBottomY - getStaffTopOffset(0) + 16}
                          fill="transparent"
                          className="cursor-pointer"
                        />

                        {/* Botón para añadir un compás: entra y sale con una transición
                            al pasar el puntero, y se queda fuera durante el arrastre y
                            la reproducción para no interceptarlos. */}
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
                          {/* Cuadrado redondeado blanco: sobre la hoja blanca el
                              borde es lo que lo hace legible como botón. */}
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
                          {/* Cruz azul */}
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

                {/* Medida seleccionada: acción de borrado siempre visible (sin hover,
                    funciona con tacto y teclado). La selección por rango excluye este
                    control porque los rangos se gestionan desde el Inspector. */}
                {!measureRange &&
                  systemMeasures.some(
                    (_, smIdx) => startMeasureIdx + smIdx === selectedMeasureIdx
                  ) && (
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

          if (layoutMode === 'paged') {
            return (
              <div className="score-pages-wrapper flex flex-col items-center gap-8 py-4 print:py-0 print:gap-0 print:block w-full">
                {pages.map((page) => (
                  <div
                    key={`page-${page.pageNumber}`}
                    className="score-page relative bg-white text-slate-900 shadow-xl border border-slate-200 dark:border-slate-300 rounded-sm w-[840px] min-w-[840px] shrink-0 min-h-[1188px] p-8 flex flex-col justify-between print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:min-w-0 print:max-w-full print:min-h-0 print:block box-border shadow-slate-300/50 dark:shadow-black/50"
                    style={{
                      breakAfter: 'page',
                      pageBreakAfter: 'always',
                    }}
                  >
                    {/* Page Header */}
                    {page.pageIndex === 0 ? (
                      <div className="text-center pt-2 pb-6 border-b border-slate-100 mb-6">
                        {isPartView && (
                          <div className="inline-block mb-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700 border border-blue-200">
                            Particella: {score.staves[effectiveStaffIdx]?.name || 'Instrumento'}{' '}
                            {transpositionSemitones !== 0
                              ? `(${TRANSPOSITION_PRESETS.find((p) => p.semitones === transpositionSemitones)?.shortLabel || `+${transpositionSemitones}`})`
                              : ''}
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
                              <div className="text-slate-700 font-medium">
                                Letra / Arr.: {score.lyricist}
                              </div>
                            )}
                            <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                              ♩ = {score.tempo} ({score.timeSignature.beats}/
                              {score.timeSignature.beatType}) • {effectiveKeySignature}
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
                    ) : (
                      <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100 mb-6 select-none">
                        <span className="font-serif italic font-bold truncate max-w-[360px] text-slate-800">
                          {score.title || 'Partitura'}{' '}
                          {isPartView ? `- ${score.staves[effectiveStaffIdx]?.name}` : ''}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-400">
                          - {page.pageNumber} -
                        </span>
                        <span className="font-serif truncate max-w-[200px] text-slate-700">
                          {score.composer || ''}
                        </span>
                      </div>
                    )}

                    {/* Systems inside this page */}
                    <div className="flex-1 flex flex-col gap-6">
                      {page.systems.map((system) => renderSystem(system))}
                    </div>

                    {/* Page Footer */}
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
            );
          }

          return <div className="w-full">{systems.map((system) => renderSystem(system))}</div>;
        })()}

        {/* Pedagogical Note Names Toggle Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 no-print">
          <div className="flex items-center gap-2">
            <span className="font-medium">💡 Guía Rápida:</span>
            <span>
              {isGrandStaff
                ? 'Gran pentagrama activo: haz clic en el pentagrama superior o en el inferior para colocar notas.'
                : score.staves.length > 1
                  ? 'Modo Ensamble: haz clic sobre cualquier pentagrama para ingresar notas en ese instrumento.'
                  : 'Haz clic en el pentagrama para insertar notas. Usa las teclas A-G o el piano inferior.'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Total compases: {totalMeasures} • Instrumentos: {score.staves.length} • Vista:{' '}
            {isPartView
              ? `Particella (${score.staves[effectiveStaffIdx]?.name || 'Instr.'})`
              : isGrandStaff
                ? 'Gran Pentagrama'
                : score.staves.length > 1
                  ? `Partitura General (${score.staves.length} pentagramas)`
                  : `Clave ${primaryStaff.clef.toUpperCase()}`}
          </div>
        </div>
      </div>
    </div>
  );
};
