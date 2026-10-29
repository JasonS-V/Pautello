import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Score,
  Staff,
  Clef,
  Pitch,
  ScoreItem,
  NoteDuration,
  Accidental,
  NamingConvention,
  getItemPitches,
  isPianoGrandStaff,
} from '../../types/music';
import { pitchToStaffStep, yToStaffStep, staffStepToPitch } from '../../engraver/engraverMath';
import { KEY_SIGNATURE_DATA, pitchToMidi } from '../../constants/pitches';
import { calculateItemPositions } from '../../engraver/beaming';
import { PlaybackState } from '../../audio/player';
import { audioEngine } from '../../audio/synth';
import { computeSystems, computePages, SystemInfo } from '../../engraver/layout';
import { getTransposedKeySignature, transposeStaffMeasures } from '../../utils/transposition';
import { getMeasureTimings } from '../../utils/measureTiming';
import { useTimeout } from '../../hooks/useTimeout';
import { ScorePageChrome } from './ScorePageChrome';
import { ScoreSystemSvg } from './ScoreSystemSvg';
import { ScoreDragState, GhostNoteState } from './types';

export interface ScoreViewProps {
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

/* Geometría del pentagrama (px del lienzo SVG). */
const LINE_SPACING = 10;
const STAFF_HEIGHT = 40;
const STAFF_SPACING = 85;
const STAFF_TOP_OFFSET = 90;
const DRAG_THRESHOLD_PX = 4;
const DRAG_REORDER_THRESHOLD_PX = 20;

const PAGE_OPTIONS = {
  pageHeight: 1056, // Carta es más corta que A4; ambos tamaños caben en esta paginación.
  firstPageTopMargin: 130,
  pageTopMargin: 65,
  pageBottomMargin: 60,
  systemGap: 36,
} as const;

const SHARP_STEPS: Readonly<Record<'treble' | 'bass' | 'alto', readonly number[]>> = {
  treble: [0, 3, -1, 2, 5, 1, 4],
  bass: [2, 5, 1, 4, 7, 3, 6],
  alto: [-1, 2, 5, 1, 4, 0, 3],
};
const FLAT_STEPS: Readonly<Record<'treble' | 'bass' | 'alto', readonly number[]>> = {
  treble: [4, 1, 5, 2, 6, 3, 7],
  bass: [6, 3, 7, 4, 8, 5, 9],
  alto: [3, 0, 4, 1, 5, 2, 6],
};

const FALLBACK_STAFF: Staff = { id: 'staff-1', name: 'Voz', clef: 'treble', measures: [] };

const pitchKey = (p: Pitch): string => `${p.step}${p.accidental || ''}${p.octave}`;

interface DropTarget {
  measureIdx: number;
  measureEl: Element | null;
}

/** Compás bajo el puntero (los compases exponen `data-measure-idx`). */
function resolveDropTarget(
  clientX: number,
  clientY: number,
  fallbackMeasureIdx: number,
  measureCount: number
): DropTarget {
  const hits = document.elementsFromPoint(clientX, clientY);
  let fallback: DropTarget = { measureIdx: fallbackMeasureIdx, measureEl: null };
  for (const hit of hits) {
    const el = hit.closest('[data-measure-idx]');
    if (!el) continue;
    const parsed = parseInt(el.getAttribute('data-measure-idx') ?? '', 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= measureCount) continue;
    // La figura arrastrada vive dentro de su compás de origen: se prefiere otro compás si lo hay.
    if (parsed !== fallbackMeasureIdx) return { measureIdx: parsed, measureEl: el };
    fallback = { measureIdx: parsed, measureEl: el };
  }
  return fallback;
}

const ScoreViewComponent: React.FC<ScoreViewProps> = ({
  score,
  selectedItemId,
  selectedMeasureIdx,
  selectedStaffIdx = 0,
  onSelectItem,
  onInsertNoteAt,
  onInsertRestAt,
  onDeleteMeasure,
  activeDuration,
  isRestMode,
  activeAccidental,
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
  measureRange = null,
  onSelectMeasure,
  activeOctave = 4,
  isOctaveLockEnabled = true,
  onMoveItem,
  isEditingLyrics,
  onUpdateLyric,
  onCloseLyrics,
  onNavigateNextItem,
  onNavigatePreviousItem,
  onAddMeasureAfter,
}) => {
  const [hoveredMeasureIdx, setHoveredMeasureIdx] = useState<number | null>(null);
  const [hoveredBarlineIdx, setHoveredBarlineIdx] = useState<number | null>(null);
  const [justAddedMeasureIdx, setJustAddedMeasureIdx] = useState<number | null>(null);
  const justAddedMeasureTimer = useTimeout();
  const [hoveredStaffStep, setHoveredStaffStep] = useState<number | null>(null);
  const [hoveredStaffIdx, setHoveredStaffIdx] = useState(0);
  const [hoveredX, setHoveredX] = useState<number | null>(null);
  const [dragState, setDragState] = useState<ScoreDragState | null>(null);

  const dragRef = useRef<ScoreDragState | null>(null);
  const lastPlayedPitchRef = useRef<string | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  // Props más recientes para los escuchadores de ventana, que viven más que un render.
  const latestRef = useRef({ score, onMoveItem });
  useEffect(() => {
    latestRef.current = { score, onMoveItem };
  });
  useEffect(() => () => cleanupDragRef.current?.(), []);

  /* ---------- Vista y geometría ---------- */
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

  const displayStaves = useMemo<Staff[]>(() => {
    if (!isPartView || !currentPartStaff) return score.staves;
    return [
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
    ];
  }, [isPartView, currentPartStaff, score.staves, transpositionSemitones, effectiveKeySignature]);

  const primaryStaff = displayStaves[0] || FALLBACK_STAFF;
  const isGrandStaff = !isPartView && isPianoGrandStaff(score);
  const stavesCount = displayStaves.length;
  const totalMeasures = primaryStaff.measures.length;

  const getStaffTopOffset = useCallback(
    (sIdx: number) => STAFF_TOP_OFFSET + sIdx * STAFF_SPACING,
    []
  );
  const systemBottomPadding = showTablature ? 80 : 35;
  const systemHeight =
    STAFF_TOP_OFFSET + (stavesCount - 1) * STAFF_SPACING + STAFF_HEIGHT + systemBottomPadding;
  const systemBottomY = getStaffTopOffset(stavesCount - 1) + STAFF_HEIGHT;

  const systems = useMemo(
    () =>
      computeSystems(primaryStaff.measures, measuresPerSystem === 0 ? 12 : measuresPerSystem || 3),
    [primaryStaff.measures, measuresPerSystem]
  );
  const pages = useMemo(
    () => computePages(systems, systemHeight, PAGE_OPTIONS),
    [systems, systemHeight]
  );

  const measureTimings = useMemo(() => getMeasureTimings(score), [score]);
  const getMeasureTimeSignature = useCallback(
    (measureIdx: number) => measureTimings[measureIdx]?.timeSignature ?? score.timeSignature,
    [measureTimings, score.timeSignature]
  );

  const getKeySignatureOffsets = useCallback(
    (clef: Clef): number[] => {
      const keyData = KEY_SIGNATURE_DATA[effectiveKeySignature] || { accidentals: 0, type: 'none' };
      if (keyData.type !== '#' && keyData.type !== 'b') return [];
      const table = keyData.type === '#' ? SHARP_STEPS : FLAT_STEPS;
      const source = clef === 'bass' ? table.bass : clef === 'alto' ? table.alto : table.treble;
      return source.slice(0, keyData.accidentals);
    },
    [effectiveKeySignature]
  );

  /* ---------- Cursor y clics ---------- */
  const handleStaffMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>, mIdx: number, measureX: number) => {
      const target = e.currentTarget as unknown as SVGElement;
      const svgEl = target.ownerSVGElement ?? (target as SVGSVGElement);
      const svgRect = svgEl.getBoundingClientRect();
      const svgY = e.clientY - svgRect.top;

      let targetDisplayStaffIdx = 0;
      if (displayStaves.length > 1) {
        let minDist = Infinity;
        displayStaves.forEach((_, sIdx) => {
          const dist = Math.abs(svgY - (getStaffTopOffset(sIdx) + STAFF_HEIGHT / 2));
          if (dist < minDist) {
            minDist = dist;
            targetDisplayStaffIdx = sIdx;
          }
        });
      }

      setHoveredMeasureIdx(mIdx);
      setHoveredStaffStep(
        yToStaffStep(svgY - getStaffTopOffset(targetDisplayStaffIdx), LINE_SPACING)
      );
      setHoveredStaffIdx(isPartView ? effectiveStaffIdx : targetDisplayStaffIdx);
      setHoveredX(e.clientX - svgRect.left - measureX);
    },
    [displayStaves, getStaffTopOffset, isPartView, effectiveStaffIdx]
  );

  const handleStaffMouseLeave = useCallback(() => {
    setHoveredMeasureIdx(null);
    setHoveredBarlineIdx(null);
    setHoveredStaffStep(null);
    setHoveredX(null);
  }, []);

  /** Devuelve `true` si el clic insertó algo (si no, el llamador selecciona el compás). */
  const handleStaffClick = useCallback(
    (_e: React.MouseEvent<SVGSVGElement>, mIdx: number): boolean => {
      if (isRestMode) {
        onInsertRestAt(mIdx, hoveredStaffIdx);
        return true;
      }
      if (hoveredStaffStep === null) return false;

      const targetClef: Clef = (score.staves[hoveredStaffIdx] || score.staves[0])?.clef || 'treble';
      const naturalPitch = staffStepToPitch(hoveredStaffStep, targetClef, activeAccidental);
      let pitch: Pitch = naturalPitch;

      if (isOctaveLockEnabled) {
        // Dentro del carril de la octava activa se fuerza esa octava; fuera, altura libre.
        const stepHigh = pitchToStaffStep(
          { step: 'B', octave: activeOctave, accidental: null },
          targetClef
        );
        const stepLow = pitchToStaffStep(
          { step: 'C', octave: activeOctave, accidental: null },
          targetClef
        );
        const isInsideLane =
          hoveredStaffStep >= Math.min(stepHigh, stepLow) - 1 &&
          hoveredStaffStep <= Math.max(stepHigh, stepLow) + 1;
        if (isInsideLane) pitch = { ...naturalPitch, octave: activeOctave };
      }

      onInsertNoteAt(mIdx, pitch, hoveredStaffIdx);
      return true;
    },
    [
      isRestMode,
      hoveredStaffIdx,
      hoveredStaffStep,
      score.staves,
      activeAccidental,
      isOctaveLockEnabled,
      activeOctave,
      onInsertNoteAt,
      onInsertRestAt,
    ]
  );

  /* ---------- Drag & drop de figuras ---------- */
  const handleStartDrag = useCallback(
    (e: React.MouseEvent, item: ScoreItem, actualMeasureIdx: number, staffIdx: number) => {
      const startPitch = getItemPitches(item)[0];
      if (!startPitch) return;
      cleanupDragRef.current?.();

      lastPlayedPitchRef.current = pitchKey(startPitch);
      const initial: ScoreDragState = {
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
      };
      dragRef.current = initial;
      setDragState(initial);

      const targetClef: Clef = latestRef.current.score.staves[staffIdx]?.clef || 'treble';

      const handleMove = (ev: MouseEvent) => {
        const prev = dragRef.current;
        if (!prev) return;
        const dx = ev.clientX - prev.startX;
        const dy = ev.clientY - prev.startY;
        if (!prev.hasMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

        const stepDelta = Math.round(dy / (LINE_SPACING / 2));
        const newStep = pitchToStaffStep(prev.initialPitch, targetClef) + stepDelta;
        const newPitch = staffStepToPitch(newStep, targetClef, prev.initialPitch.accidental);

        const key = pitchKey(newPitch);
        if (key !== lastPlayedPitchRef.current) {
          lastPlayedPitchRef.current = key;
          audioEngine.playMidi(pitchToMidi(newPitch), 0.2, 0.7);
        }

        const measureCount = latestRef.current.score.staves[staffIdx]?.measures.length ?? 0;
        const drop = resolveDropTarget(ev.clientX, ev.clientY, actualMeasureIdx, measureCount);
        const next: ScoreDragState = {
          ...prev,
          hasMoved: true,
          currentPitch: newPitch,
          targetMeasureIdx: drop.measureIdx,
          currentX: ev.clientX,
          currentY: ev.clientY,
        };
        dragRef.current = next;
        setDragState(next);
      };

      const finish = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('blur', finish);
        cleanupDragRef.current = null;
        dragRef.current = null;
        setDragState(null);
      };

      const handleUp = (ev: MouseEvent) => {
        const current = dragRef.current;
        if (current?.hasMoved) {
          const { score: liveScore, onMoveItem: moveItem } = latestRef.current;
          const staffMeasures = liveScore.staves[staffIdx]?.measures ?? [];
          const drop = resolveDropTarget(
            ev.clientX,
            ev.clientY,
            actualMeasureIdx,
            staffMeasures.length
          );

          let targetItemIdx: number | null = null;
          const dx = ev.clientX - current.startX;
          if (drop.measureIdx !== actualMeasureIdx || Math.abs(dx) >= DRAG_REORDER_THRESHOLD_PX) {
            const targetMeasure = staffMeasures[drop.measureIdx];
            const rect = drop.measureEl?.getBoundingClientRect();
            if (targetMeasure && rect) {
              const relX = Math.max(0, ev.clientX - rect.left);
              const positions = calculateItemPositions(
                targetMeasure.items,
                rect.width,
                getMeasureTimingSignature(liveScore, drop.measureIdx)
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

          moveItem?.(
            actualMeasureIdx,
            item.id,
            drop.measureIdx,
            targetItemIdx,
            current.currentPitch,
            staffIdx
          );

          // El navegador dispara un `click` tras el `mouseup`: se descarta para no reseleccionar.
          const swallowClick = (ce: MouseEvent) => ce.stopPropagation();
          window.addEventListener('click', swallowClick, { capture: true, once: true });
          setTimeout(() => window.removeEventListener('click', swallowClick, true), 0);
        }
        finish();
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('blur', finish);
      cleanupDragRef.current = finish;
    },
    []
  );

  /* ---------- Composición ---------- */
  const ghostNoteState = useMemo<GhostNoteState>(
    () => ({
      isHovered: hoveredMeasureIdx !== null,
      hoveredStaffStep,
      hoveredStaffIdx,
      hoveredX,
      isRestMode,
      activeDuration,
      activeAccidental,
      activeOctave,
      isOctaveLockEnabled,
      namingConvention,
      targetClef: (score.staves[hoveredStaffIdx] || score.staves[0])?.clef || 'treble',
    }),
    [
      hoveredMeasureIdx,
      hoveredStaffStep,
      hoveredStaffIdx,
      hoveredX,
      isRestMode,
      activeDuration,
      activeAccidental,
      activeOctave,
      isOctaveLockEnabled,
      namingConvention,
      score.staves,
    ]
  );

  const renderSystem = (system: SystemInfo): React.ReactNode => (
    <ScoreSystemSvg
      key={`system-${system.systemIndex}`}
      system={system}
      score={score}
      displayStaves={displayStaves}
      primaryStaff={primaryStaff}
      isGrandStaff={isGrandStaff}
      stavesCount={stavesCount}
      staffHeight={STAFF_HEIGHT}
      lineSpacing={LINE_SPACING}
      staffSpacing={STAFF_SPACING}
      staffTopOffset={STAFF_TOP_OFFSET}
      systemHeight={systemHeight}
      systemBottomY={systemBottomY}
      totalMeasures={totalMeasures}
      effectiveKeySignature={effectiveKeySignature}
      selectedItemId={selectedItemId}
      selectedMeasureIdx={selectedMeasureIdx}
      selectedStaffIdx={selectedStaffIdx}
      measureRange={measureRange}
      hoveredMeasureIdx={hoveredMeasureIdx}
      setHoveredMeasureIdx={setHoveredMeasureIdx}
      hoveredBarlineIdx={hoveredBarlineIdx}
      setHoveredBarlineIdx={setHoveredBarlineIdx}
      justAddedMeasureIdx={justAddedMeasureIdx}
      setJustAddedMeasureIdx={setJustAddedMeasureIdx}
      justAddedMeasureTimer={justAddedMeasureTimer}
      playbackState={playbackState}
      practiceTargetNote={practiceTargetNote}
      practiceHitResult={practiceHitResult}
      dragState={dragState}
      onSelectItem={onSelectItem}
      onSelectMeasure={onSelectMeasure}
      onDeleteMeasure={onDeleteMeasure}
      onAddMeasureAfter={onAddMeasureAfter}
      onStartDrag={handleStartDrag}
      handleStaffMouseLeave={handleStaffMouseLeave}
      handleStaffMouseMove={handleStaffMouseMove}
      handleStaffClick={handleStaffClick}
      getMeasureTimeSignature={getMeasureTimeSignature}
      getKeySignatureOffsets={getKeySignatureOffsets}
      getStaffTopOffset={getStaffTopOffset}
      ghostNoteState={ghostNoteState}
      showNoteNames={showNoteNames}
      namingConvention={namingConvention}
      isEditingLyrics={isEditingLyrics}
      onUpdateLyric={onUpdateLyric}
      onCloseLyrics={onCloseLyrics}
      onNavigateNextItem={onNavigateNextItem}
      onNavigatePreviousItem={onNavigatePreviousItem}
    />
  );

  const deselect = () => onSelectItem(selectedMeasureIdx, null, selectedStaffIdx);

  /* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
  return (
    <div
      onClick={deselect}
      className="score-view-container flex-1 overflow-auto bg-slate-100 dark:bg-studio-bg p-3 sm:p-6 flex justify-center items-start select-none print:p-0 print:block print:w-full print:max-w-full print:overflow-visible"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          deselect();
        }}
        className={
          layoutMode === 'paged'
            ? 'score-paged-layout w-[840px] min-w-[840px] shrink-0 my-0 mx-auto flex flex-col items-center select-none print:w-full print:min-w-0 print:max-w-full print:block print:m-0'
            : 'score-sheet bg-white text-slate-900 shadow-xl rounded-2xl p-6 sm:p-8 w-[840px] min-w-[840px] shrink-0 my-0 mx-auto border border-slate-200 dark:border-slate-300 shadow-slate-300/50 dark:shadow-black/50 transition-colors print:w-full print:min-w-0 print:max-w-full print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none'
        }
      >
        <ScorePageChrome
          score={score}
          pages={pages}
          systems={systems}
          layoutMode={layoutMode}
          isPartView={isPartView}
          effectiveStaffIdx={effectiveStaffIdx}
          transpositionSemitones={transpositionSemitones}
          effectiveKeySignature={effectiveKeySignature}
          totalMeasures={totalMeasures}
          isGrandStaff={isGrandStaff}
          primaryStaff={primaryStaff}
          renderSystem={renderSystem}
        />
      </div>
    </div>
  );
};

/** Compás efectivo (con cambios locales heredados) para el cálculo de posiciones al soltar. */
function getMeasureTimingSignature(score: Score, measureIdx: number) {
  return getMeasureTimings(score)[measureIdx]?.timeSignature ?? score.timeSignature;
}

export const ScoreView = React.memo(ScoreViewComponent);
ScoreView.displayName = 'ScoreView';
