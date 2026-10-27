import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clef, Pitch, Score, ScoreItem, TimeSignature, getItemPitches } from '../../types/music';
import { pitchToStaffStep, staffStepToPitch } from '../../engraver/engraverMath';
import { pitchToMidi } from '../../constants/pitches';
import { calculateItemPositions } from '../../engraver/beaming';
import { audioEngine } from '../../audio/synth';
import { ScoreDragState } from './types';

const DRAG_THRESHOLD_PX = 4;
const DRAG_REORDER_THRESHOLD_PX = 20;

export type MoveItemHandler = (
  sourceMeasureIdx: number,
  sourceItemId: string,
  targetMeasureIdx: number,
  targetItemIdx: number | null,
  targetPitch?: Pitch,
  staffIdx?: number
) => void;

export interface UseScoreItemDragOptions {
  score: Score;
  lineSpacing: number;
  onMoveItem?: MoveItemHandler;
  getMeasureTimeSignature: (measureIdx: number) => TimeSignature;
}

interface DropTarget {
  measureIdx: number;
  measureEl: Element | null;
}

const pitchKey = (p: Pitch): string => `${p.step}${p.accidental || ''}${p.octave}`;

/** Compás bajo el puntero (los compases exponen `data-measure-idx`). */
function resolveDropTarget(
  clientX: number,
  clientY: number,
  sourceMeasureIdx: number,
  measureCount: number
): DropTarget {
  let fallback: DropTarget = { measureIdx: sourceMeasureIdx, measureEl: null };
  for (const hit of document.elementsFromPoint(clientX, clientY)) {
    const el = hit.closest('[data-measure-idx]');
    if (!el) continue;
    const parsed = parseInt(el.getAttribute('data-measure-idx') ?? '', 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= measureCount) continue;
    // La figura arrastrada vive dentro de su compás de origen: se prefiere otro compás si lo hay.
    if (parsed !== sourceMeasureIdx) return { measureIdx: parsed, measureEl: el };
    fallback = { measureIdx: parsed, measureEl: el };
  }
  return fallback;
}

/**
 * Arrastre de figuras con escuchadores de ventana: `mousemove` cambia la altura
 * (`stepDelta = round(dy / (lineSpacing / 2))`) con sonido de feedback y `mouseup`
 * confirma el movimiento con `onMoveItem` solo si hubo desplazamiento.
 */
export function useScoreItemDrag(options: UseScoreItemDragOptions) {
  const [dragState, setDragState] = useState<ScoreDragState | null>(null);
  const dragRef = useRef<ScoreDragState | null>(null);
  const lastPlayedPitchRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // Opciones más recientes para escuchadores de ventana que viven más que un render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  useEffect(() => () => cleanupRef.current?.(), []);

  const handleStartDrag = useCallback(
    (e: React.MouseEvent, item: ScoreItem, actualMeasureIdx: number, staffIdx: number) => {
      const startPitch = getItemPitches(item)[0];
      if (!startPitch) return;
      cleanupRef.current?.();

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

      const targetClef: Clef = optionsRef.current.score.staves[staffIdx]?.clef || 'treble';

      const handleMove = (ev: MouseEvent) => {
        const prev = dragRef.current;
        if (!prev) return;
        const dy = ev.clientY - prev.startY;
        if (!prev.hasMoved && Math.hypot(ev.clientX - prev.startX, dy) < DRAG_THRESHOLD_PX) return;

        const stepDelta = Math.round(dy / (optionsRef.current.lineSpacing / 2));
        const newStep = pitchToStaffStep(prev.initialPitch, targetClef) + stepDelta;
        const newPitch = staffStepToPitch(newStep, targetClef, prev.initialPitch.accidental);

        const key = pitchKey(newPitch);
        if (key !== lastPlayedPitchRef.current) {
          lastPlayedPitchRef.current = key;
          audioEngine.playMidi(pitchToMidi(newPitch), 0.2, 0.7);
        }

        const count = optionsRef.current.score.staves[staffIdx]?.measures.length ?? 0;
        const drop = resolveDropTarget(ev.clientX, ev.clientY, actualMeasureIdx, count);
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
        cleanupRef.current = null;
        dragRef.current = null;
        setDragState(null);
      };

      const handleUp = (ev: MouseEvent) => {
        const current = dragRef.current;
        if (current?.hasMoved) {
          const { score, onMoveItem, getMeasureTimeSignature } = optionsRef.current;
          const measures = score.staves[staffIdx]?.measures ?? [];
          const drop = resolveDropTarget(ev.clientX, ev.clientY, actualMeasureIdx, measures.length);

          let targetItemIdx: number | null = null;
          const movedFar = Math.abs(ev.clientX - current.startX) >= DRAG_REORDER_THRESHOLD_PX;
          if (drop.measureIdx !== actualMeasureIdx || movedFar) {
            const targetMeasure = measures[drop.measureIdx];
            const rect = drop.measureEl?.getBoundingClientRect();
            if (targetMeasure && rect) {
              const relX = Math.max(0, ev.clientX - rect.left);
              const positions = calculateItemPositions(
                targetMeasure.items,
                rect.width,
                getMeasureTimeSignature(drop.measureIdx)
              );
              const found = positions.findIndex((p) => relX < p.x);
              targetItemIdx = found === -1 ? targetMeasure.items.length : found;
            }
          }

          onMoveItem?.(
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
      cleanupRef.current = finish;
    },
    []
  );

  return { dragState, handleStartDrag };
}
