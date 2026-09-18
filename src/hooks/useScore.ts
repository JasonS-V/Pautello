import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Score,
  ScoreItem,
  Staff,
  Measure,
  Pitch,
  Step,
  NoteDuration,
  Accidental,
  Articulation,
  Dynamic,
  Ornament,
  BarlineType,
  NavigationMark,
  Clef,
  KeySignature,
  TimeSignature,
  getItemPitches,
  isPianoGrandStaff,
} from '../types/music';
import { TEMPLATES, ScoreTemplate } from '../constants/templates';
import { loadScoreFromStorage, saveScoreToStorage } from '../utils/storage';
import { audioEngine, resolveStaffInstrument } from '../audio/synth';
import { pitchToMidi, getItemBeats } from '../constants/pitches';
import {
  getCapacityFromTimings,
  getMeasureTimings,
  resolveMeasureCapacity,
  padMeasureWithCanonicalRests,
} from '../utils/measureTiming';
import { transposeScoreNotes, getSemitoneOffsetBetweenKeys } from '../utils/keyDetection';
import {
  copyMeasuresFromScore,
  pasteMeasuresIntoScore,
  getNextNavigationPosition,
  MeasureClipboard,
} from '../utils/measureClipboard';
import { consolidateTacetsInScore, clearTacetsInScore } from '../utils/tacetUtils';

function findStaffAndMeasure(
  newScore: Score,
  preferredStaffIdx: number,
  preferredMeasureIdx: number,
  itemId?: string | null
): { staff: Staff; measure: Measure; measureIdx: number } | null {
  if (itemId) {
    const prefStaff = newScore.staves[preferredStaffIdx];
    if (prefStaff) {
      const prefIdx = prefStaff.measures.findIndex((m) => m.items.some((it) => it.id === itemId));
      if (prefIdx !== -1) {
        return { staff: prefStaff, measure: prefStaff.measures[prefIdx], measureIdx: prefIdx };
      }
    }
    for (const s of newScore.staves) {
      const idx = s.measures.findIndex((m) => m.items.some((it) => it.id === itemId));
      if (idx !== -1) return { staff: s, measure: s.measures[idx], measureIdx: idx };
    }
  }

  const staff = newScore.staves[preferredStaffIdx] || newScore.staves[0];
  if (!staff) return null;
  // El índice del compás decide qué cambio de métrica está vigente: se conserva.
  const measureIdx = staff.measures[preferredMeasureIdx] ? preferredMeasureIdx : 0;
  const measure = staff.measures[measureIdx];
  if (!measure) return null;
  return { staff, measure, measureIdx };
}

/** Silencio de edición tras el cual se vuelca la partitura al almacenamiento. */
const AUTOSAVE_DEBOUNCE_MS = 500;

export function canMeasureFitItem(
  measure: Measure,
  itemBeats: number,
  maxBeats: number,
  voice?: 1 | 2
): boolean {
  // `maxBeats` es la capacidad vigente en ese compás (métrica global o cambio
  // local heredado); la anacrusis la recorta por ser un compás incompleto.
  const effectiveMax = measure.isAnacrusis && measure.pickupBeats ? measure.pickupBeats : maxBeats;
  if (itemBeats > effectiveMax + 1e-5) {
    return false;
  }

  const isPlaceholder =
    measure.items.length === 1 &&
    measure.items[0].type === 'rest' &&
    (measure.items[0].duration === 'w' ||
      (measure.isAnacrusis && measure.pickupBeats !== undefined));
  if (isPlaceholder) {
    return itemBeats <= effectiveMax + 1e-5;
  }

  const voiceItems = voice
    ? measure.items.filter((it) => (voice === 2 ? it.voice === 2 : it.voice !== 2))
    : measure.items.some((it) => it.voice === 2)
      ? measure.items.filter((it) => it.voice !== 2)
      : measure.items;

  if (voiceItems.length === 0) {
    return itemBeats <= effectiveMax + 1e-5;
  }

  // Trailing padding rests don't block note insertion (they get replaced/recalculated)
  let lastActiveIdx = -1;
  for (let i = voiceItems.length - 1; i >= 0; i--) {
    const it = voiceItems[i];
    const isPad =
      it.type === 'rest' && (it.id.startsWith('rest-pad-') || it.id.startsWith('r-pad'));
    if (!isPad) {
      lastActiveIdx = i;
      break;
    }
  }

  if (lastActiveIdx === -1) {
    return itemBeats <= effectiveMax + 1e-5;
  }

  const activeItems = voiceItems.slice(0, lastActiveIdx + 1);
  const currentBeats = activeItems.reduce(
    (sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet),
    0
  );
  return currentBeats + itemBeats <= effectiveMax + 1e-5;
}

export function useScore() {
  const [score, setScore] = useState<Score>(() => loadScoreFromStorage());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedMeasureIdx, setSelectedMeasureIdx] = useState<number>(0);
  const [selectedStaffIdx, setSelectedStaffIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'full' | 'part'>('full');
  const [activePartStaffIdx, setActivePartStaffIdx] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<'continuous' | 'paged'>('continuous');
  const [measuresPerSystem, setMeasuresPerSystem] = useState<number>(3);
  const [measureRange, setMeasureRange] = useState<{ start: number; end: number } | null>(null);
  const [clipboard, setClipboard] = useState<MeasureClipboard | null>(null);

  // Active toolbar insertion settings
  const [activeDuration, setActiveDuration] = useState<NoteDuration>('q');
  const [activeAccidental, setActiveAccidental] = useState<Accidental>(null);
  const [isRestMode, setIsRestMode] = useState<boolean>(false);
  const [isDotted, setIsDotted] = useState<boolean>(false);
  const [isTuplet, setIsTuplet] = useState<boolean>(false);
  const [activeVoice, setActiveVoice] = useState<1 | 2>(1);

  // Undo / Redo history
  const historyRef = useRef<Score[]>([]);
  const futureRef = useRef<Score[]>([]);
  // Los refs no provocan render, así que se fuerza uno en cada cambio del historial
  // para que canUndo/canRedo (leídos de ellos) no queden desactualizados.
  const [, setHistoryVersion] = useState(0);

  // Autoguardado: se agrupan las ediciones seguidas en una sola escritura, que
  // serializa la partitura entera. Un cambio se marca como "guardando" hasta que
  // el silencio de edición lo vuelca, y el volcado también se fuerza al ocultar
  // la pestaña para no perder lo último escrito.
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const pendingScoreRef = useRef<Score | null>(null);

  useEffect(() => {
    pendingScoreRef.current = score;
    setSaveState('saving');
    const timer = setTimeout(() => {
      saveScoreToStorage(score);
      pendingScoreRef.current = null;
      setSaveState('saved');
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [score]);

  useEffect(() => {
    const flushPendingSave = () => {
      const pending = pendingScoreRef.current;
      if (!pending) return;
      pendingScoreRef.current = null;
      saveScoreToStorage(pending);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingSave();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushPendingSave);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushPendingSave);
    };
  }, []);

  const pushHistory = useCallback((currentScore: Score) => {
    historyRef.current.push(JSON.parse(JSON.stringify(currentScore)));
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    futureRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    futureRef.current.push(JSON.parse(JSON.stringify(score)));
    setScore(prev);
  }, [score]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    historyRef.current.push(JSON.parse(JSON.stringify(score)));
    setScore(next);
  }, [score]);

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

  const copySelectedMeasures = useCallback(() => {
    const start = measureRange ? measureRange.start : selectedMeasureIdx;
    const end = measureRange ? measureRange.end : selectedMeasureIdx;
    const clip = copyMeasuresFromScore(score, start, end);
    setClipboard(clip);
    return clip;
  }, [score, measureRange, selectedMeasureIdx]);

  const pasteMeasures = useCallback(
    (targetMeasureIdx?: number) => {
      if (!clipboard) return;
      pushHistory(score);
      const target = targetMeasureIdx !== undefined ? targetMeasureIdx : selectedMeasureIdx;
      setScore((prev) => pasteMeasuresIntoScore(prev, clipboard, target));
    },
    [score, clipboard, selectedMeasureIdx, pushHistory]
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

  const insertNoteAt = useCallback(
    (
      measureIdx: number,
      pitch: Pitch | Pitch[],
      customDuration?: NoteDuration,
      targetStaffIdx?: number,
      autoAdvance: boolean = false
    ) => {
      const duration = customDuration || activeDuration;
      const staffIdxToUse = targetStaffIdx !== undefined ? targetStaffIdx : selectedStaffIdx;
      const tuplet = isTuplet ? { actual: 3, normal: 2 } : undefined;
      const newNoteBeats = getItemBeats(duration, isDotted, tuplet);
      const timings = getMeasureTimings(score);

      const staff = score.staves[staffIdxToUse] || score.staves[0];
      if (!staff) return;

      const targetIdx = Math.max(0, Math.min(measureIdx, staff.measures.length - 1));

      if (!autoAdvance) {
        const targetM = staff.measures[targetIdx];
        const maxBeats = getCapacityFromTimings(timings, targetIdx, score.timeSignature);
        if (!targetM || !canMeasureFitItem(targetM, newNoteBeats, maxBeats, activeVoice)) {
          return;
        }
      }

      pushHistory(score);

      // Play audio feedback for the inserted pitch(es) with the staff's resolved instrument
      const targetStaffForAudio = score.staves[staffIdxToUse] || score.staves[0];
      const staffAudioInst = targetStaffForAudio
        ? resolveStaffInstrument(
            targetStaffForAudio,
            isPianoGrandStaff(score),
            audioEngine.instrument
          )
        : undefined;

      if (Array.isArray(pitch)) {
        pitch.forEach((p) => {
          audioEngine.playMidi(pitchToMidi(p), 0.4, 0.85, undefined, staffAudioInst);
        });
      } else {
        const midi = pitchToMidi(pitch);
        audioEngine.playMidi(midi, 0.35, 0.85, undefined, staffAudioInst);
      }

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const targetStaff = newScore.staves[staffIdxToUse] || newScore.staves[0];
        if (!targetStaff) return prev;

        let currentIdx = Math.max(0, Math.min(measureIdx, targetStaff.measures.length - 1));
        // La capacidad se recalcula por compás: un cambio local de métrica
        // altera cuánto cabe a partir de ahí, no solo en su propio compás.
        const newTimings = getMeasureTimings(newScore);
        const capacityAt = (idx: number) =>
          getCapacityFromTimings(newTimings, idx, newScore.timeSignature);

        if (autoAdvance) {
          while (
            currentIdx < targetStaff.measures.length &&
            !canMeasureFitItem(
              targetStaff.measures[currentIdx],
              newNoteBeats,
              capacityAt(currentIdx),
              activeVoice
            )
          ) {
            currentIdx++;
          }

          if (currentIdx >= targetStaff.measures.length) {
            const newMeasId = `meas-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            newScore.staves.forEach((s) => {
              s.measures.push({
                id: newMeasId,
                items: [
                  {
                    id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    type: 'rest',
                    duration: 'w',
                  },
                ],
              });
            });
            currentIdx = targetStaff.measures.length - 1;
          }
        }

        const targetMeasure = targetStaff.measures[currentIdx];
        if (
          !targetMeasure ||
          !canMeasureFitItem(targetMeasure, newNoteBeats, capacityAt(currentIdx), activeVoice)
        ) {
          return prev;
        }

        const isPlaceholderRest =
          targetMeasure.items.length === 1 &&
          targetMeasure.items[0].type === 'rest' &&
          (targetMeasure.items[0].duration === 'w' ||
            (targetMeasure.isAnacrusis && targetMeasure.pickupBeats !== undefined));

        const isPitchArray = Array.isArray(pitch);
        const primaryPitch: Pitch = isPitchArray ? pitch[0] : pitch;
        const chordPitches: Pitch[] | undefined =
          isPitchArray && pitch.length > 1 ? pitch : undefined;

        const newItem: ScoreItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'note',
          pitch: primaryPitch,
          pitches: chordPitches,
          duration,
          isDotted,
          tuplet,
          voice: activeVoice,
          stemDirection: activeVoice === 2 ? 'down' : 'up',
        };

        if (isPlaceholderRest) {
          targetMeasure.items = [newItem];
        } else if (selectedItemId && targetMeasure.items.some((it) => it.id === selectedItemId)) {
          const itemIdx = targetMeasure.items.findIndex((it) => it.id === selectedItemId);
          const selItem = targetMeasure.items[itemIdx];
          const selVoice = selItem.voice || 1;
          if (selVoice === activeVoice) {
            if (selItem.type === 'rest') {
              targetMeasure.items.splice(itemIdx, 1, newItem);
            } else {
              targetMeasure.items.splice(itemIdx + 1, 0, newItem);
            }
          } else {
            const voicePadIdx = targetMeasure.items.findIndex(
              (it) =>
                (it.voice || 1) === activeVoice &&
                it.type === 'rest' &&
                (it.id.startsWith('rest-pad-') || it.id.startsWith('r-pad'))
            );
            if (voicePadIdx !== -1) {
              targetMeasure.items.splice(voicePadIdx, 1, newItem);
            } else {
              targetMeasure.items.push(newItem);
            }
          }
        } else {
          const voicePadIdx = targetMeasure.items.findIndex(
            (it) =>
              (it.voice || 1) === activeVoice &&
              it.type === 'rest' &&
              (it.id.startsWith('rest-pad-') || it.id.startsWith('r-pad'))
          );
          if (voicePadIdx !== -1) {
            targetMeasure.items.splice(voicePadIdx, 1, newItem);
          } else {
            targetMeasure.items.push(newItem);
          }
        }

        padMeasureWithCanonicalRests(
          targetMeasure,
          capacityAt(currentIdx),
          targetMeasure.timeSignatureChange || newScore.timeSignature
        );

        setSelectedItemId(newItem.id);
        setSelectedMeasureIdx(currentIdx);
        setSelectedStaffIdx(staffIdxToUse);
        return newScore;
      });
    },
    [
      score,
      activeDuration,
      isDotted,
      isTuplet,
      activeVoice,
      selectedItemId,
      selectedStaffIdx,
      pushHistory,
    ]
  );

  const insertRestAt = useCallback(
    (
      measureIdx: number,
      customDuration?: NoteDuration,
      targetStaffIdx?: number,
      autoAdvance: boolean = false
    ) => {
      const duration = customDuration || activeDuration;
      const staffIdxToUse = targetStaffIdx !== undefined ? targetStaffIdx : selectedStaffIdx;
      const tuplet = isTuplet ? { actual: 3, normal: 2 } : undefined;
      const newNoteBeats = getItemBeats(duration, isDotted, tuplet);
      const timings = getMeasureTimings(score);

      const staff = score.staves[staffIdxToUse] || score.staves[0];
      if (!staff) return;

      const targetIdx = Math.max(0, Math.min(measureIdx, staff.measures.length - 1));

      if (!autoAdvance) {
        const targetM = staff.measures[targetIdx];
        const maxBeats = getCapacityFromTimings(timings, targetIdx, score.timeSignature);
        if (!targetM || !canMeasureFitItem(targetM, newNoteBeats, maxBeats, activeVoice)) {
          return;
        }
      }

      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const targetStaff = newScore.staves[staffIdxToUse] || newScore.staves[0];
        if (!targetStaff) return prev;

        let currentIdx = Math.max(0, Math.min(measureIdx, targetStaff.measures.length - 1));
        // La capacidad se recalcula por compás: un cambio local de métrica
        // altera cuánto cabe a partir de ahí, no solo en su propio compás.
        const newTimings = getMeasureTimings(newScore);
        const capacityAt = (idx: number) =>
          getCapacityFromTimings(newTimings, idx, newScore.timeSignature);

        if (autoAdvance) {
          while (
            currentIdx < targetStaff.measures.length &&
            !canMeasureFitItem(
              targetStaff.measures[currentIdx],
              newNoteBeats,
              capacityAt(currentIdx),
              activeVoice
            )
          ) {
            currentIdx++;
          }

          if (currentIdx >= targetStaff.measures.length) {
            const newMeasId = `meas-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            newScore.staves.forEach((s) => {
              s.measures.push({
                id: newMeasId,
                items: [
                  {
                    id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    type: 'rest',
                    duration: 'w',
                  },
                ],
              });
            });
            currentIdx = targetStaff.measures.length - 1;
          }
        }

        const targetMeasure = targetStaff.measures[currentIdx];
        if (
          !targetMeasure ||
          !canMeasureFitItem(targetMeasure, newNoteBeats, capacityAt(currentIdx), activeVoice)
        ) {
          return prev;
        }

        const isPlaceholderRest =
          targetMeasure.items.length === 1 &&
          targetMeasure.items[0].type === 'rest' &&
          (targetMeasure.items[0].duration === 'w' ||
            (targetMeasure.isAnacrusis && targetMeasure.pickupBeats !== undefined));

        const newItem: ScoreItem = {
          id: `item-rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'rest',
          duration,
          isDotted,
          tuplet,
          voice: activeVoice,
        };

        if (isPlaceholderRest) {
          targetMeasure.items = [newItem];
        } else if (selectedItemId && targetMeasure.items.some((it) => it.id === selectedItemId)) {
          const itemIdx = targetMeasure.items.findIndex((it) => it.id === selectedItemId);
          const selItem = targetMeasure.items[itemIdx];
          const selVoice = selItem.voice || 1;
          if (selVoice === activeVoice) {
            if (selItem.type === 'rest') {
              targetMeasure.items.splice(itemIdx, 1, newItem);
            } else {
              targetMeasure.items.splice(itemIdx + 1, 0, newItem);
            }
          } else {
            const voicePadIdx = targetMeasure.items.findIndex(
              (it) =>
                (it.voice || 1) === activeVoice &&
                it.type === 'rest' &&
                (it.id.startsWith('rest-pad-') || it.id.startsWith('r-pad'))
            );
            if (voicePadIdx !== -1) {
              targetMeasure.items.splice(voicePadIdx, 1, newItem);
            } else {
              targetMeasure.items.push(newItem);
            }
          }
        } else {
          const voicePadIdx = targetMeasure.items.findIndex(
            (it) =>
              (it.voice || 1) === activeVoice &&
              it.type === 'rest' &&
              (it.id.startsWith('rest-pad-') || it.id.startsWith('r-pad'))
          );
          if (voicePadIdx !== -1) {
            targetMeasure.items.splice(voicePadIdx, 1, newItem);
          } else {
            targetMeasure.items.push(newItem);
          }
        }

        padMeasureWithCanonicalRests(
          targetMeasure,
          capacityAt(currentIdx),
          targetMeasure.timeSignatureChange || newScore.timeSignature
        );

        setSelectedItemId(newItem.id);
        setSelectedMeasureIdx(currentIdx);
        setSelectedStaffIdx(staffIdxToUse);
        return newScore;
      });
    },
    [
      score,
      activeDuration,
      isDotted,
      isTuplet,
      activeVoice,
      selectedItemId,
      selectedStaffIdx,
      pushHistory,
    ]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedItemId) return;
    pushHistory(score);
    const targetId = selectedItemId;
    setSelectedItemId(null);

    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, targetId);
      if (!loc) return prev;
      const { measure, measureIdx } = loc;

      const idx = measure.items.findIndex((it) => it.id === targetId);
      if (idx !== -1) {
        const itemToDelete = measure.items[idx];
        if (itemToDelete.type === 'note') {
          measure.items[idx] = {
            id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'rest',
            duration: itemToDelete.duration,
            isDotted: itemToDelete.isDotted,
            voice: itemToDelete.voice,
          };
        } else {
          measure.items.splice(idx, 1);
        }

        const newTimings = getMeasureTimings(newScore);
        const capacityAt = (i: number) =>
          getCapacityFromTimings(newTimings, i, newScore.timeSignature);
        padMeasureWithCanonicalRests(
          measure,
          capacityAt(measureIdx),
          measure.timeSignatureChange || newScore.timeSignature
        );
      }

      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const setSelectedItemVoice = useCallback(
    (voice: 1 | 2) => {
      if (!selectedItemId) return;
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const item = loc.measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.voice = voice;
          item.stemDirection = voice === 2 ? 'down' : 'up';
          const newTimings = getMeasureTimings(newScore);
          const capacityAt = (i: number) =>
            getCapacityFromTimings(newTimings, i, newScore.timeSignature);
          padMeasureWithCanonicalRests(
            loc.measure,
            capacityAt(loc.measureIdx),
            loc.measure.timeSignatureChange || newScore.timeSignature
          );
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedStaffIdx, selectedMeasureIdx, pushHistory]
  );

  const transposeSelected = useCallback(
    (semitones: number) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item && item.type === 'note') {
          const itemPitches = getItemPitches(item);
          if (itemPitches.length > 0) {
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

            const transposed = itemPitches.map((p) => {
              const currentMidi = pitchToMidi(p);
              const newMidi = Math.max(21, Math.min(108, currentMidi + semitones));
              const octave = Math.floor(newMidi / 12) - 1;
              const semi = newMidi % 12;
              return {
                step: semiMap[semi].step,
                octave,
                accidental: semiMap[semi].acc,
              };
            });

            item.pitch = transposed[0];
            item.pitches = transposed;

            const currentStaff = score.staves[selectedStaffIdx] || score.staves[0];
            const currentInst = currentStaff
              ? resolveStaffInstrument(
                  currentStaff,
                  isPianoGrandStaff(score),
                  audioEngine.instrument
                )
              : undefined;
            transposed.forEach((tp) =>
              audioEngine.playMidi(pitchToMidi(tp), 0.3, 0.8, undefined, currentInst)
            );
          }
        }

        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const addPitchToSelectedChord = useCallback(
    (pitch: Pitch) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item && item.type === 'note') {
          const currentPitches = getItemPitches(item);
          const exists = currentPitches.some(
            (p) =>
              p.step === pitch.step &&
              p.octave === pitch.octave &&
              p.accidental === pitch.accidental
          );
          if (exists) {
            if (currentPitches.length > 1) {
              const filtered = currentPitches.filter(
                (p) =>
                  !(
                    p.step === pitch.step &&
                    p.octave === pitch.octave &&
                    p.accidental === pitch.accidental
                  )
              );
              item.pitches = filtered;
              item.pitch = filtered[0];
            }
          } else {
            const combined = [...currentPitches, pitch].sort(
              (a, b) => pitchToMidi(a) - pitchToMidi(b)
            );
            item.pitches = combined;
            item.pitch = combined[0];
            const currentStaff = score.staves[selectedStaffIdx] || score.staves[0];
            const currentInst = currentStaff
              ? resolveStaffInstrument(
                  currentStaff,
                  isPianoGrandStaff(score),
                  audioEngine.instrument
                )
              : undefined;
            audioEngine.playMidi(pitchToMidi(pitch), 0.35, 0.8, undefined, currentInst);
          }
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedStaffIdx, selectedMeasureIdx, pushHistory]
  );

  const removePitchFromSelectedChord = useCallback(
    (pitchIndex: number) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item && item.type === 'note') {
          const currentPitches = getItemPitches(item);
          if (currentPitches.length > 1 && pitchIndex >= 0 && pitchIndex < currentPitches.length) {
            currentPitches.splice(pitchIndex, 1);
            item.pitches = currentPitches;
            item.pitch = currentPitches[0];
          }
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedStaffIdx, selectedMeasureIdx, pushHistory]
  );

  const changeSelectedDuration = useCallback(
    (duration: NoteDuration) => {
      if (!selectedItemId) return;

      // Valida contra el estado actual ANTES de tocar el historial: el updater de
      // setScore debe ser puro, porque React lo puede ejecutar dos veces (StrictMode).
      const currentLoc = findStaffAndMeasure(
        score,
        selectedStaffIdx,
        selectedMeasureIdx,
        selectedItemId
      );
      const currentItem = currentLoc?.measure.items.find((it) => it.id === selectedItemId);
      if (!currentLoc || !currentItem) return;

      const maxBeats = resolveMeasureCapacity(score, currentLoc.measure, currentLoc.measureIdx);
      const otherBeats = currentLoc.measure.items
        .filter((it) => it.id !== selectedItemId)
        .reduce((sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet), 0);
      if (
        otherBeats + getItemBeats(duration, currentItem.isDotted, currentItem.tuplet) >
        maxBeats + 1e-5
      ) {
        return;
      }

      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        const item = loc?.measure.items.find((it) => it.id === selectedItemId);
        if (!item) return prev;
        item.duration = duration;
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const toggleSelectedDot = useCallback(() => {
    if (!selectedItemId) return;

    const currentLoc = findStaffAndMeasure(
      score,
      selectedStaffIdx,
      selectedMeasureIdx,
      selectedItemId
    );
    const currentItem = currentLoc?.measure.items.find((it) => it.id === selectedItemId);
    if (!currentLoc || !currentItem) return;

    const maxBeats = resolveMeasureCapacity(score, currentLoc.measure, currentLoc.measureIdx);
    const otherBeats = currentLoc.measure.items
      .filter((it) => it.id !== selectedItemId)
      .reduce((sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet), 0);
    if (
      otherBeats + getItemBeats(currentItem.duration, !currentItem.isDotted, currentItem.tuplet) >
      maxBeats + 1e-5
    ) {
      return;
    }

    pushHistory(score);
    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(
        newScore,
        selectedStaffIdx,
        selectedMeasureIdx,
        selectedItemId
      );
      const item = loc?.measure.items.find((it) => it.id === selectedItemId);
      if (!item) return prev;
      item.isDotted = !item.isDotted;
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const toggleSelectedTuplet = useCallback(() => {
    if (!selectedItemId) return;

    const currentLoc = findStaffAndMeasure(
      score,
      selectedStaffIdx,
      selectedMeasureIdx,
      selectedItemId
    );
    const currentItem = currentLoc?.measure.items.find((it) => it.id === selectedItemId);
    if (!currentLoc || !currentItem) return;

    const maxBeats = resolveMeasureCapacity(score, currentLoc.measure, currentLoc.measureIdx);
    const otherBeats = currentLoc.measure.items
      .filter((it) => it.id !== selectedItemId)
      .reduce((sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet), 0);
    const nextTuplet = currentItem.tuplet ? undefined : { actual: 3, normal: 2 };
    if (
      otherBeats + getItemBeats(currentItem.duration, currentItem.isDotted, nextTuplet) >
      maxBeats + 1e-5
    ) {
      return;
    }

    pushHistory(score);
    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(
        newScore,
        selectedStaffIdx,
        selectedMeasureIdx,
        selectedItemId
      );
      const item = loc?.measure.items.find((it) => it.id === selectedItemId);
      if (!item) return prev;
      if (item.tuplet) {
        delete item.tuplet;
      } else {
        item.tuplet = { actual: 3, normal: 2 };
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const toggleSelectedTie = useCallback(() => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(
        newScore,
        selectedStaffIdx,
        selectedMeasureIdx,
        selectedItemId
      );
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find((it) => it.id === selectedItemId);
      if (item && item.type === 'note') {
        item.isTied = !item.isTied;
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const toggleSelectedSlur = useCallback(() => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(
        newScore,
        selectedStaffIdx,
        selectedMeasureIdx,
        selectedItemId
      );
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find((it) => it.id === selectedItemId);
      if (item && item.type === 'note') {
        item.slur = item.slur === 'start' ? undefined : 'start';
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const setSelectedAccidental = useCallback(
    (acc: Accidental) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item && item.type === 'note' && item.pitch) {
          item.pitch.accidental = item.pitch.accidental === acc ? null : acc;
          const currentStaff = score.staves[selectedStaffIdx] || score.staves[0];
          const currentInst = currentStaff
            ? resolveStaffInstrument(currentStaff, isPianoGrandStaff(score), audioEngine.instrument)
            : undefined;
          audioEngine.playMidi(pitchToMidi(item.pitch), 0.3, 0.8, undefined, currentInst);
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const setSelectedArticulation = useCallback(
    (art: Articulation) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item && item.type === 'note') {
          item.articulation = item.articulation === art ? null : art;
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const setSelectedDynamic = useCallback(
    (dyn: Dynamic) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.dynamic = item.dynamic === dyn ? null : dyn;
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const setSelectedOrnament = useCallback(
    (ornament: Ornament) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.ornament = item.ornament === ornament ? undefined : ornament;
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const setSelectedHairpin = useCallback(
    (hairpin: 'cresc' | 'decresc' | 'stop' | null) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.hairpin = item.hairpin === hairpin ? null : hairpin;
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const setSelectedNoteType = useCallback(
    (noteType: 'standard' | 'grace' | 'slash', graceType?: 'acciaccatura' | 'appoggiatura') => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.noteType = item.noteType === noteType ? 'standard' : noteType;
          item.graceType = graceType;
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const setSelectedFingering = useCallback(
    (fingering?: number) => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.fingering = item.fingering === fingering ? undefined : fingering;
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const setSelectedPedal = useCallback(
    (pedal?: 'start' | 'stop') => {
      if (!selectedItemId) return;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.pedal = item.pedal === pedal ? undefined : pedal;
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const updateSelectedLyric = useCallback(
    (lyric: string) => {
      if (!selectedItemId) return;
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.lyric = lyric.trim() ? lyric : undefined;
        }
        return newScore;
      });
    },
    [selectedItemId, selectedMeasureIdx, selectedStaffIdx]
  );

  const updateSelectedChord = useCallback(
    (chord: string | undefined) => {
      if (!selectedItemId) return;
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item) {
          item.chord = chord?.trim() ? chord.trim() : undefined;
        }
        return newScore;
      });
    },
    [selectedItemId, selectedMeasureIdx, selectedStaffIdx]
  );

  const updateSelectedStep = useCallback(
    (step: Step) => {
      if (!selectedItemId) return;
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const loc = findStaffAndMeasure(
          newScore,
          selectedStaffIdx,
          selectedMeasureIdx,
          selectedItemId
        );
        if (!loc) return prev;
        const { measure } = loc;

        const item = measure.items.find((it) => it.id === selectedItemId);
        if (item && item.type === 'note' && item.pitch) {
          item.pitch.step = step;
          const currentStaff = score.staves[selectedStaffIdx] || score.staves[0];
          const currentInst = currentStaff
            ? resolveStaffInstrument(currentStaff, isPianoGrandStaff(score), audioEngine.instrument)
            : undefined;
          audioEngine.playMidi(pitchToMidi(item.pitch), 0.35, 0.8, undefined, currentInst);
        }
        return newScore;
      });
    },
    [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]
  );

  const moveScoreItem = useCallback(
    (
      sourceMeasureIdx: number,
      sourceItemId: string,
      targetMeasureIdx: number,
      targetItemIdx: number | null,
      targetPitch?: Pitch,
      staffIdx?: number
    ) => {
      const staffIdxToUse = staffIdx !== undefined ? staffIdx : selectedStaffIdx;
      pushHistory(score);

      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const targetStaff = newScore.staves[staffIdxToUse] || newScore.staves[0];
        if (!targetStaff) return prev;

        const sourceMeasure = targetStaff.measures[sourceMeasureIdx];
        if (!sourceMeasure) return prev;

        const itemIndex = sourceMeasure.items.findIndex((it) => it.id === sourceItemId);
        if (itemIndex === -1) return prev;

        const item = sourceMeasure.items[itemIndex];
        if (!item) return prev;

        // Si se proporcionó un nuevo pitch, actualizarlo en el ítem
        if (targetPitch && item.type === 'note') {
          const oldPrimaryPitch = item.pitch;
          item.pitch = { ...targetPitch };

          if (item.pitches && item.pitches.length > 0 && oldPrimaryPitch) {
            // Si es acorde, transponer en relación al pitch principal previo
            const deltaMidi = pitchToMidi(targetPitch) - pitchToMidi(oldPrimaryPitch);
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
            item.pitches = item.pitches.map((p) => {
              const currentM = pitchToMidi(p);
              const newM = Math.max(12, Math.min(127, currentM + deltaMidi));
              const oct = Math.floor(newM / 12) - 1;
              const semi = ((newM % 12) + 12) % 12;
              return {
                step: semiMap[semi].step,
                octave: oct,
                accidental: semiMap[semi].acc,
              };
            });
            item.pitch = item.pitches[0];
          }
        }

        const newTimings = getMeasureTimings(newScore);
        const capacityAt = (idx: number) =>
          getCapacityFromTimings(newTimings, idx, newScore.timeSignature);

        // Caso 1: Movimiento dentro del mismo compás y misma posición (solo cambió altura)
        if (
          sourceMeasureIdx === targetMeasureIdx &&
          (targetItemIdx === null || targetItemIdx === itemIndex)
        ) {
          setSelectedItemId(item.id);
          setSelectedMeasureIdx(sourceMeasureIdx);
          setSelectedStaffIdx(staffIdxToUse);

          if (item.pitch) {
            const currentStaff = score.staves[staffIdxToUse] || score.staves[0];
            const currentInst = currentStaff
              ? resolveStaffInstrument(
                  currentStaff,
                  isPianoGrandStaff(score),
                  audioEngine.instrument
                )
              : undefined;
            audioEngine.playMidi(pitchToMidi(item.pitch), 0.35, 0.8, undefined, currentInst);
          }
          return newScore;
        }

        // Caso 2: Movimiento a otra posición dentro del compás o a otro compás
        const targetMeasure = targetStaff.measures[targetMeasureIdx];
        if (!targetMeasure) return prev;

        if (sourceMeasureIdx !== targetMeasureIdx) {
          const itemBeats = getItemBeats(item.duration, item.isDotted, item.tuplet);
          if (
            !canMeasureFitItem(
              targetMeasure,
              itemBeats,
              capacityAt(targetMeasureIdx),
              item.voice || 1
            )
          ) {
            return prev;
          }
        }

        // Extraer de compás de origen
        sourceMeasure.items.splice(itemIndex, 1);
        if (sourceMeasure.items.length === 0) {
          sourceMeasure.items.push({
            id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'rest',
            duration: 'w',
          });
        }
        padMeasureWithCanonicalRests(
          sourceMeasure,
          capacityAt(sourceMeasureIdx),
          sourceMeasure.timeSignatureChange || newScore.timeSignature
        );

        // Insertar en compás destino
        const isPlaceholderRest =
          targetMeasure.items.length === 1 &&
          targetMeasure.items[0].type === 'rest' &&
          (targetMeasure.items[0].duration === 'w' ||
            (targetMeasure.isAnacrusis && targetMeasure.pickupBeats !== undefined));

        if (isPlaceholderRest) {
          targetMeasure.items = [item];
        } else if (
          targetItemIdx !== null &&
          targetItemIdx >= 0 &&
          targetItemIdx <= targetMeasure.items.length
        ) {
          targetMeasure.items.splice(targetItemIdx, 0, item);
        } else {
          targetMeasure.items.push(item);
        }

        padMeasureWithCanonicalRests(
          targetMeasure,
          capacityAt(targetMeasureIdx),
          targetMeasure.timeSignatureChange || newScore.timeSignature
        );

        setSelectedItemId(item.id);
        setSelectedMeasureIdx(targetMeasureIdx);
        setSelectedStaffIdx(staffIdxToUse);

        if (item.pitch) {
          const currentStaff = score.staves[staffIdxToUse] || score.staves[0];
          const currentInst = currentStaff
            ? resolveStaffInstrument(currentStaff, isPianoGrandStaff(score), audioEngine.instrument)
            : undefined;
          audioEngine.playMidi(pitchToMidi(item.pitch), 0.35, 0.8, undefined, currentInst);
        }

        return newScore;
      });
    },
    [score, selectedStaffIdx, pushHistory]
  );

  const addMeasure = useCallback(
    (afterIdx?: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const newMeasure: Measure = {
            id: `meas-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            items: [
              {
                id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                type: 'rest',
                duration: 'w',
              },
            ],
          };
          if (typeof afterIdx === 'number' && afterIdx >= 0 && afterIdx < staff.measures.length) {
            staff.measures.splice(afterIdx + 1, 0, newMeasure);
          } else {
            staff.measures.push(newMeasure);
          }
        });
        return newScore;
      });
      if (typeof afterIdx === 'number' && afterIdx >= 0) {
        setSelectedMeasureIdx(afterIdx + 1);
      } else {
        const total = score.staves[0]?.measures.length || 0;
        setSelectedMeasureIdx(total);
      }
      setSelectedItemId(null);
    },
    [score, pushHistory]
  );

  const deleteMeasure = useCallback(
    (idx: number) => {
      pushHistory(score);
      setSelectedItemId(null);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          if (staff.measures.length > 1) {
            staff.measures.splice(idx, 1);
          }
        });
        return newScore;
      });
      setSelectedMeasureIdx((prev) =>
        Math.max(0, Math.min(prev, (score.staves[0]?.measures.length || 2) - 2))
      );
    },
    [score, pushHistory]
  );

  // Vive después de deleteMeasure: sin compás seleccionado delega en él, y la
  // dependencia debe ser explícita para que el historial y la selección cuadren.
  const deleteSelectedMeasures = useCallback(() => {
    if (!measureRange) {
      deleteMeasure(selectedMeasureIdx);
      return;
    }
    pushHistory(score);
    setScore((prev) => {
      const newScore: Score = JSON.parse(JSON.stringify(prev));
      const count = measureRange.end - measureRange.start + 1;
      newScore.staves.forEach((staff) => {
        staff.measures.splice(measureRange.start, count);
        if (staff.measures.length === 0) {
          staff.measures.push({
            id: `m-0-${Math.random().toString(36).substr(2, 5)}`,
            items: [
              { id: `r-0-${Math.random().toString(36).substr(2, 5)}`, type: 'rest', duration: 'w' },
            ],
          });
        }
      });
      return newScore;
    });
    setMeasureRange(null);
    setSelectedMeasureIdx(Math.max(0, measureRange.start));
  }, [score, measureRange, selectedMeasureIdx, pushHistory, deleteMeasure]);

  const toggleMeasureRepeatStart = useCallback(
    (measureIdx: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.repeatStart = !m.repeatStart;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const toggleMeasureRepeatEnd = useCallback(
    (measureIdx: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.repeatEnd = !m.repeatEnd;
            if (!m.repeatEnd) {
              delete m.repeatCount;
            }
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureVolta = useCallback(
    (measureIdx: number, volta?: string | null) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            if (volta && volta.trim()) {
              m.volta = volta.trim();
            } else {
              delete m.volta;
            }
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureAnacrusis = useCallback(
    (measureIdx: number, isAnacrusis: boolean, pickupBeats?: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            if (isAnacrusis) {
              m.isAnacrusis = true;
              m.pickupBeats = pickupBeats ?? 1;
              // If the measure currently has only a whole rest placeholder, adjust it to match pickupBeats
              const isPlaceholder =
                m.items.length === 1 && m.items[0].type === 'rest' && m.items[0].duration === 'w';
              if (isPlaceholder && m.pickupBeats) {
                const dur: NoteDuration = m.pickupBeats >= 2 ? 'h' : m.pickupBeats >= 1 ? 'q' : '8';
                m.items[0].duration = dur;
              }
            } else {
              delete m.isAnacrusis;
              delete m.pickupBeats;
            }
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const toggleMeasureSystemBreak = useCallback(
    (measureIdx: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.systemBreak = !m.systemBreak;
            if (m.systemBreak) {
              delete m.pageBreak;
            }
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const toggleMeasurePageBreak = useCallback(
    (measureIdx: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.pageBreak = !m.pageBreak;
            if (m.pageBreak) {
              delete m.systemBreak;
            }
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureMultimeasureRest = useCallback(
    (measureIdx: number, count?: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            if (count && count > 1) {
              m.multimeasureRest = count;
            } else {
              delete m.multimeasureRest;
            }
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const autoConsolidateTacets = useCallback(
    (staffIndex?: number) => {
      pushHistory(score);
      setScore((prev) => consolidateTacetsInScore(prev, staffIndex));
    },
    [score, pushHistory]
  );

  const clearAllTacets = useCallback(
    (staffIndex?: number) => {
      pushHistory(score);
      setScore((prev) => clearTacetsInScore(prev, staffIndex));
    },
    [score, pushHistory]
  );

  const setMeasureBarline = useCallback(
    (measureIdx: number, barline?: BarlineType) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.barline = m.barline === barline ? undefined : barline;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureNavigationMark = useCallback(
    (measureIdx: number, mark?: NavigationMark) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.navigationMark = m.navigationMark === mark ? null : mark;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureRehearsalMark = useCallback(
    (measureIdx: number, mark?: string) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.rehearsalMark = mark?.trim() ? mark.trim() : undefined;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const toggleMeasureRepeatSign = useCallback(
    (measureIdx: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.isMeasureRepeat = !m.isMeasureRepeat;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const toggleMeasureCaesura = useCallback(
    (measureIdx: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.caesura = !m.caesura;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const toggleMeasureBreathMark = useCallback(
    (measureIdx: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.breathMark = !m.breathMark;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureTempoText = useCallback(
    (measureIdx: number, text?: string, bpm?: number) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.tempoText = text?.trim() ? text.trim() : undefined;
            m.tempoBpm = bpm;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureTimeSignatureChange = useCallback(
    (measureIdx: number, timeSig?: TimeSignature) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.timeSignatureChange = timeSig;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const setMeasureKeySignatureChange = useCallback(
    (measureIdx: number, keySig?: KeySignature) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        newScore.staves.forEach((staff) => {
          const m = staff.measures[measureIdx];
          if (m) {
            m.keySignatureChange = keySig;
          }
        });
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const updateScoreMetadata = useCallback(
    (meta: { subtitle?: string; lyricist?: string; partName?: string; copyright?: string }) => {
      setScore((prev) => ({
        ...prev,
        subtitle: meta.subtitle !== undefined ? meta.subtitle : prev.subtitle,
        lyricist: meta.lyricist !== undefined ? meta.lyricist : prev.lyricist,
        partName: meta.partName !== undefined ? meta.partName : prev.partName,
        copyright: meta.copyright !== undefined ? meta.copyright : prev.copyright,
      }));
    },
    []
  );

  const updateStaffShortName = useCallback((staffIdx: number, shortName: string) => {
    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      if (newScore.staves[staffIdx]) {
        newScore.staves[staffIdx].shortName = shortName.trim();
      }
      return newScore;
    });
  }, []);

  const updateStaffTransposition = useCallback((staffIdx: number, transposition: number) => {
    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      if (newScore.staves[staffIdx]) {
        newScore.staves[staffIdx].transposition = transposition;
      }
      return newScore;
    });
  }, []);

  const updateTitle = useCallback((title: string) => {
    setScore((prev) => ({ ...prev, title }));
  }, []);

  const updateComposer = useCallback((composer: string) => {
    setScore((prev) => ({ ...prev, composer }));
  }, []);

  const updateTempo = useCallback((tempo: number) => {
    setScore((prev) => ({ ...prev, tempo: Math.max(30, Math.min(300, tempo)) }));
  }, []);

  const updateTimeSignature = useCallback(
    (timeSig: TimeSignature) => {
      pushHistory(score);
      setScore((prev) => ({ ...prev, timeSignature: timeSig }));
    },
    [score, pushHistory]
  );

  const updateKeySignature = useCallback(
    (keySig: KeySignature) => {
      pushHistory(score);
      setScore((prev) => ({ ...prev, keySignature: keySig }));
    },
    [score, pushHistory]
  );

  const transposeScore = useCallback(
    (semitones: number) => {
      if (semitones === 0) return;
      pushHistory(score);
      setScore((prev) => transposeScoreNotes(prev, semitones));
    },
    [score, pushHistory]
  );

  const changeKeySignatureAndTranspose = useCallback(
    (newKey: KeySignature, transposeNotes: boolean) => {
      if (newKey === score.keySignature) return;
      pushHistory(score);
      if (transposeNotes) {
        const semitones = getSemitoneOffsetBetweenKeys(score.keySignature, newKey);
        setScore((prev) => transposeScoreNotes(prev, semitones, newKey));
      } else {
        setScore((prev) => ({ ...prev, keySignature: newKey }));
      }
    },
    [score, pushHistory]
  );

  const updateClef = useCallback(
    (clef: Clef, staffIdx: number = 0) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        if (newScore.staves[staffIdx]) {
          newScore.staves[staffIdx].clef = clef;
        }
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const toggleGrandStaff = useCallback(() => {
    // Solo modela el paso 1 pentagrama ↔ 2 pentagramas unidos por llave. Con
    // cualquier otra combinación el toggle colapsaría la obra y dejaría fuera
    // los instrumentos añadidos, así que se ignora la llamada.
    if (score.staves.length > 1 && !isPianoGrandStaff(score)) return;

    pushHistory(score);
    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      if (newScore.staves.length === 1) {
        // Activa el gran pentagrama AÑADIENDO el pentagrama inferior. El
        // pentagrama existente conserva su nombre y su clave, así que unir un
        // instrumento a un pentagrama de acompañamiento no lo deja irreconocible.
        const numMeasures = newScore.staves[0].measures.length;
        const bassMeasures = Array.from({ length: numMeasures }, (_, i) => ({
          id: `m-bass-${Date.now()}-${i}`,
          items: [
            {
              id: `rest-bass-${Date.now()}-${i}`,
              type: 'rest' as const,
              duration: 'w' as const,
            },
          ],
        }));
        newScore.staves.push({
          id: 'staff-bass',
          name: 'Mano Izquierda',
          clef: 'bass',
          measures: bassMeasures,
        });
        newScore.isGrandStaff = true;
      } else {
        // Deshace la unión: se elimina únicamente el pentagrama añadido,
        // dejando el original tal y como estaba.
        const [upperStaff] = newScore.staves;
        newScore.staves = [upperStaff];
        delete newScore.isGrandStaff;
        setSelectedStaffIdx(0);
      }
      newScore.updatedAt = Date.now();
      return newScore;
    });
  }, [score, pushHistory]);

  const addStaff = useCallback(
    (name?: string, clef: Clef = 'treble') => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        const refStaff = newScore.staves[0] || { measures: [] };
        const numMeasures = refStaff.measures.length;
        const instrumentName = name || `Instrumento ${newScore.staves.length + 1}`;

        const newMeasures = Array.from({ length: numMeasures }, (_, i) => {
          const refMeasure = refStaff.measures[i];
          const isAnacrusis = refMeasure?.isAnacrusis ?? false;
          const pickupBeats = refMeasure?.pickupBeats;
          const dur: NoteDuration =
            isAnacrusis && pickupBeats
              ? pickupBeats >= 2
                ? 'h'
                : pickupBeats >= 1
                  ? 'q'
                  : '8'
              : 'w';
          return {
            id: `m-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            items: [
              {
                id: `rest-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
                type: 'rest' as const,
                duration: dur,
              },
            ],
            repeatStart: refMeasure?.repeatStart,
            repeatEnd: refMeasure?.repeatEnd,
            volta: refMeasure?.volta,
            isAnacrusis,
            pickupBeats,
          };
        });

        newScore.staves.push({
          id: `staff-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: instrumentName,
          clef,
          measures: newMeasures,
        });
        newScore.updatedAt = Date.now();
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const removeStaff = useCallback(
    (staffIdx: number) => {
      if (score.staves.length <= 1) return;
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        if (newScore.staves.length <= 1) return prev;
        newScore.staves.splice(staffIdx, 1);
        // Al quedarse sin pareja, la partitura deja de ser un gran pentagrama
        // (si no, al añadir otro instrumento aparecería la llave por sorpresa).
        if (newScore.staves.length < 2) delete newScore.isGrandStaff;
        newScore.updatedAt = Date.now();
        return newScore;
      });
      setSelectedStaffIdx((prev) => Math.min(prev, Math.max(0, score.staves.length - 2)));
      setActivePartStaffIdx((prev) => Math.min(prev, Math.max(0, score.staves.length - 2)));
    },
    [score, pushHistory]
  );

  const updateStaffName = useCallback((staffIdx: number, name: string) => {
    setScore((prev) => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      if (newScore.staves[staffIdx]) {
        newScore.staves[staffIdx].name = name;
        newScore.updatedAt = Date.now();
      }
      return newScore;
    });
  }, []);

  const updateStaffClef = useCallback(
    (staffIdx: number, clef: Clef) => {
      pushHistory(score);
      setScore((prev) => {
        const newScore = JSON.parse(JSON.stringify(prev)) as Score;
        if (newScore.staves[staffIdx]) {
          newScore.staves[staffIdx].clef = clef;
          newScore.updatedAt = Date.now();
        }
        return newScore;
      });
    },
    [score, pushHistory]
  );

  const loadTemplate = useCallback(
    (template: ScoreTemplate) => {
      pushHistory(score);
      const cloned = JSON.parse(JSON.stringify(template.score)) as Score;
      cloned.id = `score-${Date.now()}`;
      setScore(cloned);
      setSelectedItemId(null);
      setSelectedMeasureIdx(0);
      setSelectedStaffIdx(0);
    },
    [score, pushHistory]
  );

  const loadScoreDirectly = useCallback(
    (newScore: Score) => {
      pushHistory(score);
      const cloned = JSON.parse(JSON.stringify(newScore)) as Score;
      setScore(cloned);
      setSelectedItemId(null);
      setSelectedMeasureIdx(0);
      setSelectedStaffIdx(0);
    },
    [score, pushHistory]
  );

  const clearScore = useCallback(() => {
    const blank = TEMPLATES.find((t) => t.id === 'blank-score') || TEMPLATES[0];
    loadTemplate(blank);
  }, [loadTemplate]);

  return {
    score,
    saveState,
    selectedItemId,
    selectedMeasureIdx,
    selectedStaffIdx,
    setSelectedStaffIdx,
    toggleGrandStaff,
    isGrandStaff: isPianoGrandStaff(score),
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
    toggleSelectedTuplet,
    activeVoice,
    setActiveVoice,
    setSelectedItemVoice,
    selectItem,
    insertNoteAt,
    insertRestAt,
    deleteSelected,
    transposeSelected,
    changeSelectedDuration,
    toggleSelectedDot,
    toggleSelectedTie,
    toggleSelectedSlur,
    setSelectedAccidental,
    setSelectedArticulation,
    setSelectedDynamic,
    setSelectedOrnament,
    setSelectedHairpin,
    setSelectedNoteType,
    setSelectedFingering,
    setSelectedPedal,
    updateSelectedLyric,
    updateSelectedChord,
    updateSelectedStep,
    moveScoreItem,
    addPitchToSelectedChord,
    removePitchFromSelectedChord,
    addMeasure,
    deleteMeasure,
    measureRange,
    setMeasureRange,
    selectMeasure,
    extendMeasureRange,
    copySelectedMeasures,
    pasteMeasures,
    deleteSelectedMeasures,
    navigatePreviousItem,
    navigateNextItem,
    clipboard,
    toggleMeasureRepeatStart,
    toggleMeasureRepeatEnd,
    setMeasureVolta,
    setMeasureBarline,
    setMeasureNavigationMark,
    setMeasureRehearsalMark,
    toggleMeasureRepeatSign,
    toggleMeasureCaesura,
    toggleMeasureBreathMark,
    setMeasureTempoText,
    setMeasureTimeSignatureChange,
    setMeasureKeySignatureChange,
    updateScoreMetadata,
    updateStaffShortName,
    updateStaffTransposition,
    setMeasureAnacrusis,
    layoutMode,
    setLayoutMode,
    measuresPerSystem,
    setMeasuresPerSystem,
    toggleMeasureSystemBreak,
    toggleMeasurePageBreak,
    setMeasureMultimeasureRest,
    autoConsolidateTacets,
    clearAllTacets,
    updateTitle,
    updateComposer,
    updateTempo,
    updateTimeSignature,
    updateKeySignature,
    transposeScore,
    changeKeySignatureAndTranspose,
    updateClef,
    loadTemplate,
    loadScoreDirectly,
    clearScore,
    undo,
    redo,
    viewMode,
    setViewMode,
    activePartStaffIdx,
    setActivePartStaffIdx,
    addStaff,
    removeStaff,
    updateStaffName,
    updateStaffClef,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
