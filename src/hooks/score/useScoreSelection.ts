import { useState, useRef, useEffect, useCallback } from 'react';
import { Score, NoteDuration, Accidental } from '../../types/music';
import { getNextNavigationPosition } from '../../utils/measureClipboard';

export interface UseScoreSelectionReturn {
  selectedItemId: string | null;
  setSelectedItemId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedMeasureIdx: number;
  setSelectedMeasureIdx: React.Dispatch<React.SetStateAction<number>>;
  selectedStaffIdx: number;
  setSelectedStaffIdx: React.Dispatch<React.SetStateAction<number>>;
  measureRange: { start: number; end: number } | null;
  setMeasureRange: React.Dispatch<React.SetStateAction<{ start: number; end: number } | null>>;
  activeDuration: NoteDuration;
  setActiveDuration: React.Dispatch<React.SetStateAction<NoteDuration>>;
  activeAccidental: Accidental;
  setActiveAccidental: React.Dispatch<React.SetStateAction<Accidental>>;
  isRestMode: boolean;
  setIsRestMode: React.Dispatch<React.SetStateAction<boolean>>;
  isDotted: boolean;
  setIsDotted: React.Dispatch<React.SetStateAction<boolean>>;
  isTuplet: boolean;
  setIsTuplet: React.Dispatch<React.SetStateAction<boolean>>;
  activeVoice: 1 | 2;
  setActiveVoice: React.Dispatch<React.SetStateAction<1 | 2>>;
  selectItem: (measureIdx: number, itemId: string | null, staffIdx?: number) => void;
  selectMeasure: (measureIdx: number, isShiftKey?: boolean, staffIdx?: number) => void;
  extendMeasureRange: (delta: number) => void;
  navigatePreviousItem: () => void;
  navigateNextItem: () => void;
}

export function useScoreSelection(score: Score): UseScoreSelectionReturn {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedMeasureIdx, setSelectedMeasureIdx] = useState<number>(0);
  const [selectedStaffIdx, setSelectedStaffIdx] = useState<number>(0);
  const [measureRange, setMeasureRange] = useState<{ start: number; end: number } | null>(null);

  // Active toolbar insertion settings
  const [activeDuration, setActiveDuration] = useState<NoteDuration>('q');
  const [activeAccidental, setActiveAccidental] = useState<Accidental>(null);
  const [isRestMode, setIsRestMode] = useState<boolean>(false);
  const [isDotted, setIsDotted] = useState<boolean>(false);
  const [isTuplet, setIsTuplet] = useState<boolean>(false);
  const [activeVoice, setActiveVoice] = useState<1 | 2>(1);

  const selectItem = useCallback(
    (measureIdx: number, itemId: string | null, staffIdx: number = 0) => {
      setSelectedMeasureIdx(measureIdx);
      setSelectedItemId(itemId);
      setSelectedStaffIdx(staffIdx);
      setMeasureRange(null);
    },
    []
  );

  const selectMeasure = useCallback(
    (measureIdx: number, isShiftKey = false, staffIdx = 0) => {
      setSelectedStaffIdx(staffIdx);
      if (isShiftKey) {
        setMeasureRange((prev) => ({
          start: Math.min(prev ? prev.start : selectedMeasureIdx, measureIdx),
          end: Math.max(prev ? prev.end : selectedMeasureIdx, measureIdx),
        }));
      } else {
        setMeasureRange(null);
        setSelectedMeasureIdx(measureIdx);
        setSelectedItemId(null);
      }
    },
    [selectedMeasureIdx]
  );

  // Extremo móvil del rango cuando se selecciona con el teclado. Vive aparte
  // del rango porque `measureRange` siempre queda normalizado (start <= end) y
  // sin esto no se sabría hacia qué lado está creciendo o encogiendo.
  const rangeEdgeRef = useRef<number | null>(null);

  useEffect(() => {
    // Si el rango se vacía por otra vía (deshacer, borrar un compás, un clic
    // simple), el extremo guardado deja de tener sentido.
    if (!measureRange) rangeEdgeRef.current = null;
  }, [measureRange]);

  /**
   * Extiende o encoge en un compás el rango seleccionado, para Shift+←/→. El
   * ancla es siempre el compás seleccionado, así que el rango también se puede
   * encoger volviendo hacia él (cosa que el Shift+clic no permite).
   */
  const extendMeasureRange = useCallback(
    (delta: number) => {
      const total = score.staves[0]?.measures.length ?? 0;
      if (total === 0) return;

      const anchor = selectedMeasureIdx;
      const currentEdge = rangeEdgeRef.current ?? anchor;
      const next = Math.min(total - 1, Math.max(0, currentEdge + delta));

      rangeEdgeRef.current = next === anchor ? null : next;
      setMeasureRange(
        next === anchor ? null : { start: Math.min(anchor, next), end: Math.max(anchor, next) }
      );
    },
    [score, selectedMeasureIdx]
  );

  const navigatePreviousItem = useCallback(() => {
    const currentStaff = score.staves[selectedStaffIdx] || score.staves[0];
    if (!currentStaff) return;
    const nextPos = getNextNavigationPosition(
      currentStaff.measures,
      selectedMeasureIdx,
      selectedItemId,
      'prev'
    );
    setSelectedMeasureIdx(nextPos.measureIdx);
    setSelectedItemId(nextPos.itemId);
    setMeasureRange(null);
  }, [score, selectedStaffIdx, selectedMeasureIdx, selectedItemId]);

  const navigateNextItem = useCallback(() => {
    const currentStaff = score.staves[selectedStaffIdx] || score.staves[0];
    if (!currentStaff) return;
    const nextPos = getNextNavigationPosition(
      currentStaff.measures,
      selectedMeasureIdx,
      selectedItemId,
      'next'
    );
    setSelectedMeasureIdx(nextPos.measureIdx);
    setSelectedItemId(nextPos.itemId);
    setMeasureRange(null);
  }, [score, selectedStaffIdx, selectedMeasureIdx, selectedItemId]);

  return {
    selectedItemId,
    setSelectedItemId,
    selectedMeasureIdx,
    setSelectedMeasureIdx,
    selectedStaffIdx,
    setSelectedStaffIdx,
    measureRange,
    setMeasureRange,
    activeDuration,
    setActiveDuration,
    activeAccidental,
    setActiveAccidental,
    isRestMode,
    setIsRestMode,
    isDotted,
    setIsDotted,
    isTuplet,
    setIsTuplet,
    activeVoice,
    setActiveVoice,
    selectItem,
    selectMeasure,
    extendMeasureRange,
    navigatePreviousItem,
    navigateNextItem,
  };
}
