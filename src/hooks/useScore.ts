import { Score } from '../types/music';
import { useScoreHistory } from './score/useScoreHistory';
import { useScoreSelection } from './score/useScoreSelection';
import { useNoteMutations } from './score/useNoteMutations';
import { useMeasureMutations } from './score/useMeasureMutations';
import { useStaffAndMetadataMutations } from './score/useStaffAndMetadataMutations';

// Re-export utility functions and types for backwards compatibility
export { canMeasureFitItem, findStaffAndMeasure, AUTOSAVE_DEBOUNCE_MS } from './score/scoreUtils';
export type { SaveState, UseScoreHistoryReturn } from './score/useScoreHistory';
export type { UseScoreSelectionReturn } from './score/useScoreSelection';
export type { UseNoteMutationsProps } from './score/useNoteMutations';
export type { UseMeasureMutationsProps } from './score/useMeasureMutations';
export type { UseStaffAndMetadataMutationsProps } from './score/useStaffAndMetadataMutations';

/**
 * useScore: Fachada orquestadora para la gestión del estado reactivo de la partitura.
 * Descompuesta modularmente en sub-hooks especializados:
 * - useScoreHistory: Pila de deshacer/rehacer y autoguardado en almacenamiento
 * - useScoreSelection: Cursores, selección de notas/compases y estado de inserción
 * - useNoteMutations: Operaciones de notas, acordes, silencios, ligaduras y articulaciones
 * - useMeasureMutations: Gestión de compases, repeticiones, voltas, métrica y armadura
 * - useStaffAndMetadataMutations: Pautas, metadatos, transposición global y plantillas
 */
export function useScore(initialScoreLoader?: () => Score) {
  const history = useScoreHistory(initialScoreLoader);
  const selection = useScoreSelection(history.score);

  const noteMutations = useNoteMutations({
    score: history.score,
    setScore: history.setScore,
    pushHistory: history.pushHistory,
    selection,
  });

  const measureMutations = useMeasureMutations({
    score: history.score,
    setScore: history.setScore,
    pushHistory: history.pushHistory,
    selection,
  });

  const staffAndMetadataMutations = useStaffAndMetadataMutations({
    score: history.score,
    setScore: history.setScore,
    pushHistory: history.pushHistory,
    selection,
  });

  return {
    score: history.score,
    saveState: history.saveState,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,

    // Selección y barra de herramientas
    selectedItemId: selection.selectedItemId,
    selectedMeasureIdx: selection.selectedMeasureIdx,
    selectedStaffIdx: selection.selectedStaffIdx,
    setSelectedStaffIdx: selection.setSelectedStaffIdx,
    measureRange: selection.measureRange,
    setMeasureRange: selection.setMeasureRange,
    activeDuration: selection.activeDuration,
    setActiveDuration: selection.setActiveDuration,
    activeAccidental: selection.activeAccidental,
    setActiveAccidental: selection.setActiveAccidental,
    isRestMode: selection.isRestMode,
    setIsRestMode: selection.setIsRestMode,
    isDotted: selection.isDotted,
    setIsDotted: selection.setIsDotted,
    isTuplet: selection.isTuplet,
    setIsTuplet: selection.setIsTuplet,
    activeVoice: selection.activeVoice,
    setActiveVoice: selection.setActiveVoice,
    selectItem: selection.selectItem,
    selectMeasure: selection.selectMeasure,
    extendMeasureRange: selection.extendMeasureRange,
    navigatePreviousItem: selection.navigatePreviousItem,
    navigateNextItem: selection.navigateNextItem,

    // Mutaciones de notas e ítems
    ...noteMutations,

    // Mutaciones de compás y portapapeles
    ...measureMutations,

    // Mutaciones de pauta, metadatos y sistema
    ...staffAndMetadataMutations,
  };
}
