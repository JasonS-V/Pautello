import { useCallback } from 'react';
import {
  Score,
  ScoreItem,
  Pitch,
  Step,
  NoteDuration,
  Accidental,
  Articulation,
  Dynamic,
  Ornament,
  isPianoGrandStaff,
  getItemPitches,
} from '../../types/music';
import { audioEngine, resolveStaffInstrument } from '../../audio/synth';
import { pitchToMidi, getItemBeats } from '../../constants/pitches';
import {
  getCapacityFromTimings,
  getMeasureTimings,
  padMeasureWithCanonicalRests,
  resolveMeasureCapacity,
} from '../../utils/measureTiming';
import { findStaffAndMeasure, canMeasureFitItem } from './scoreUtils';
import { UseScoreSelectionReturn } from './useScoreSelection';

export interface UseNoteMutationsProps {
  score: Score;
  setScore: React.Dispatch<React.SetStateAction<Score>>;
  pushHistory: (score: Score) => void;
  selection: UseScoreSelectionReturn;
}

export function useNoteMutations({
  score,
  setScore,
  pushHistory,
  selection,
}: UseNoteMutationsProps) {
  const {
    selectedItemId,
    setSelectedItemId,
    selectedMeasureIdx,
    setSelectedMeasureIdx,
    selectedStaffIdx,
    setSelectedStaffIdx,
    activeDuration,
    isDotted,
    isTuplet,
    activeVoice,
  } = selection;

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

  return {
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
    setSelectedItemVoice,
    toggleSelectedTuplet,
  };
}
