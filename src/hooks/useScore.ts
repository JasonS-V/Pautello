import { useState, useCallback, useEffect, useRef } from 'react';
import { Score, ScoreItem, Staff, Measure, Pitch, Step, NoteDuration, Accidental, Clef, KeySignature, TimeSignature } from '../types/music';
import { TEMPLATES, ScoreTemplate } from '../constants/templates';
import { loadScoreFromStorage, saveScoreToStorage } from '../utils/storage';
import { audioEngine } from '../audio/synth';
import { pitchToMidi, getItemBeats } from '../constants/pitches';
import { transposeScoreNotes, getSemitoneOffsetBetweenKeys } from '../utils/keyDetection';

function findStaffAndMeasure(
  newScore: Score,
  preferredStaffIdx: number,
  preferredMeasureIdx: number,
  itemId?: string | null
): { staff: Staff; measure: Measure } | null {
  if (itemId) {
    const prefStaff = newScore.staves[preferredStaffIdx];
    if (prefStaff) {
      const prefMeasure = prefStaff.measures[preferredMeasureIdx];
      if (prefMeasure?.items.some((it) => it.id === itemId)) {
        return { staff: prefStaff, measure: prefMeasure };
      }
      for (const m of prefStaff.measures) {
        if (m.items.some((it) => it.id === itemId)) {
          return { staff: prefStaff, measure: m };
        }
      }
    }
    for (const s of newScore.staves) {
      for (const m of s.measures) {
        if (m.items.some((it) => it.id === itemId)) {
          return { staff: s, measure: m };
        }
      }
    }
  }

  const staff = newScore.staves[preferredStaffIdx] || newScore.staves[0];
  if (!staff) return null;
  const measure = staff.measures[preferredMeasureIdx] || staff.measures[0];
  if (!measure) return null;
  return { staff, measure };
}

export function useScore() {
  const [score, setScore] = useState<Score>(() => loadScoreFromStorage());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedMeasureIdx, setSelectedMeasureIdx] = useState<number>(0);
  const [selectedStaffIdx, setSelectedStaffIdx] = useState<number>(0);

  // Active toolbar insertion settings
  const [activeDuration, setActiveDuration] = useState<NoteDuration>('q');
  const [activeAccidental, setActiveAccidental] = useState<Accidental>(null);
  const [isRestMode, setIsRestMode] = useState<boolean>(false);
  const [isDotted, setIsDotted] = useState<boolean>(false);

  // Undo / Redo history
  const historyRef = useRef<Score[]>([]);
  const futureRef = useRef<Score[]>([]);

  // Persist to local storage on changes
  useEffect(() => {
    saveScoreToStorage(score);
  }, [score]);

  const pushHistory = useCallback((currentScore: Score) => {
    historyRef.current.push(JSON.parse(JSON.stringify(currentScore)));
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    futureRef.current = [];
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

  const selectItem = useCallback((measureIdx: number, itemId: string | null, staffIdx: number = 0) => {
    setSelectedMeasureIdx(measureIdx);
    setSelectedItemId(itemId);
    setSelectedStaffIdx(staffIdx);
  }, []);

  const insertNoteAt = useCallback((measureIdx: number, pitch: Pitch, customDuration?: NoteDuration, targetStaffIdx?: number) => {
    pushHistory(score);
    const duration = customDuration || activeDuration;
    const staffIdxToUse = targetStaffIdx !== undefined ? targetStaffIdx : selectedStaffIdx;

    // Play audio feedback for the inserted pitch
    const midi = pitchToMidi(pitch);
    audioEngine.playMidi(midi, 0.35, 0.85);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[staffIdxToUse] || newScore.staves[0];
      if (!staff) return prev;

      let currentIdx = Math.max(0, Math.min(measureIdx, staff.measures.length - 1));
      let targetMeasure = staff.measures[currentIdx];
      if (!targetMeasure) {
        targetMeasure = { id: `m-${Date.now()}`, items: [] };
        staff.measures.push(targetMeasure);
        currentIdx = staff.measures.length - 1;
      }

      const maxMeasureBeats = newScore.timeSignature.beats * (4 / newScore.timeSignature.beatType);

      // Check if current measure has only an empty placeholder whole rest
      const isPlaceholderRest = targetMeasure.items.length === 1 &&
        targetMeasure.items[0].type === 'rest' &&
        targetMeasure.items[0].duration === 'w';

      const currentBeats = isPlaceholderRest
        ? 0
        : targetMeasure.items.reduce((sum, it) => sum + getItemBeats(it.duration, it.isDotted), 0);

      // If measure has reached beat limit, advance to next measure
      if (currentBeats >= maxMeasureBeats) {
        currentIdx++;
        if (currentIdx >= staff.measures.length) {
          staff.measures.push({
            id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            items: []
          });
        }
        targetMeasure = staff.measures[currentIdx];
      }

      const targetIsPlaceholder = targetMeasure.items.length === 1 &&
        targetMeasure.items[0].type === 'rest' &&
        targetMeasure.items[0].duration === 'w';

      const newItem: ScoreItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'note',
        pitch,
        duration,
        isDotted
      };

      if (targetIsPlaceholder) {
        targetMeasure.items = [newItem];
      } else if (selectedItemId) {
        const itemIdx = targetMeasure.items.findIndex(it => it.id === selectedItemId);
        if (itemIdx !== -1) {
          targetMeasure.items.splice(itemIdx + 1, 0, newItem);
        } else {
          targetMeasure.items.push(newItem);
        }
      } else {
        targetMeasure.items.push(newItem);
      }

      setSelectedItemId(newItem.id);
      setSelectedMeasureIdx(currentIdx);
      return newScore;
    });
  }, [score, activeDuration, isDotted, selectedItemId, pushHistory]);

  const insertRestAt = useCallback((measureIdx: number, customDuration?: NoteDuration, targetStaffIdx?: number) => {
    pushHistory(score);
    const duration = customDuration || activeDuration;
    const staffIdxToUse = targetStaffIdx !== undefined ? targetStaffIdx : selectedStaffIdx;

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[staffIdxToUse] || newScore.staves[0];
      if (!staff) return prev;

      let currentIdx = Math.max(0, Math.min(measureIdx, staff.measures.length - 1));
      let targetMeasure = staff.measures[currentIdx];
      if (!targetMeasure) {
        targetMeasure = { id: `m-${Date.now()}`, items: [] };
        staff.measures.push(targetMeasure);
        currentIdx = staff.measures.length - 1;
      }

      const maxMeasureBeats = newScore.timeSignature.beats * (4 / newScore.timeSignature.beatType);

      const isPlaceholderRest = targetMeasure.items.length === 1 &&
        targetMeasure.items[0].type === 'rest' &&
        targetMeasure.items[0].duration === 'w';

      const currentBeats = isPlaceholderRest
        ? 0
        : targetMeasure.items.reduce((sum, it) => sum + getItemBeats(it.duration, it.isDotted), 0);

      if (currentBeats >= maxMeasureBeats) {
        currentIdx++;
        if (currentIdx >= staff.measures.length) {
          staff.measures.push({
            id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            items: []
          });
        }
        targetMeasure = staff.measures[currentIdx];
      }

      const targetIsPlaceholder = targetMeasure.items.length === 1 &&
        targetMeasure.items[0].type === 'rest' &&
        targetMeasure.items[0].duration === 'w';

      const newItem: ScoreItem = {
        id: `item-rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'rest',
        duration,
        isDotted
      };

      if (targetIsPlaceholder) {
        targetMeasure.items = [newItem];
      } else if (selectedItemId) {
        const itemIdx = targetMeasure.items.findIndex(it => it.id === selectedItemId);
        if (itemIdx !== -1) {
          targetMeasure.items.splice(itemIdx + 1, 0, newItem);
        } else {
          targetMeasure.items.push(newItem);
        }
      } else {
        targetMeasure.items.push(newItem);
      }

      setSelectedItemId(newItem.id);
      setSelectedMeasureIdx(currentIdx);
      return newScore;
    });
  }, [score, activeDuration, isDotted, selectedItemId, pushHistory]);

  const deleteSelected = useCallback(() => {
    if (!selectedItemId) return;
    pushHistory(score);
    const targetId = selectedItemId;
    setSelectedItemId(null);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, targetId);
      if (!loc) return prev;
      const { measure } = loc;

      const idx = measure.items.findIndex(it => it.id === targetId);
      if (idx !== -1) {
        measure.items.splice(idx, 1);
        if (measure.items.length === 0) {
          // If empty, add a default whole rest
          measure.items.push({
            id: `rest-${Date.now()}`,
            type: 'rest',
            duration: 'w'
          });
        }
      }

      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const transposeSelected = useCallback((semitones: number) => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, selectedItemId);
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item && item.type === 'note' && item.pitch) {
        const currentMidi = pitchToMidi(item.pitch);
        const newMidi = Math.max(21, Math.min(108, currentMidi + semitones));

        // Convert MIDI back to diatonic pitch
        const octave = Math.floor(newMidi / 12) - 1;
        const semi = newMidi % 12;
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

        item.pitch = {
          step: semiMap[semi].step,
          octave,
          accidental: semiMap[semi].acc
        };

        audioEngine.playMidi(newMidi, 0.3);
      }

      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const changeSelectedDuration = useCallback((duration: NoteDuration) => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, selectedItemId);
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item) {
        item.duration = duration;
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const toggleSelectedDot = useCallback(() => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, selectedItemId);
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item) {
        item.isDotted = !item.isDotted;
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const setSelectedAccidental = useCallback((acc: Accidental) => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, selectedItemId);
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item && item.type === 'note' && item.pitch) {
        item.pitch.accidental = item.pitch.accidental === acc ? null : acc;
        audioEngine.playMidi(pitchToMidi(item.pitch), 0.3);
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const updateSelectedLyric = useCallback((lyric: string) => {
    if (!selectedItemId) return;
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, selectedItemId);
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item) {
        item.lyric = lyric.trim() ? lyric : undefined;
      }
      return newScore;
    });
  }, [selectedItemId, selectedMeasureIdx, selectedStaffIdx]);

  const updateSelectedChord = useCallback((chord: string | undefined) => {
    if (!selectedItemId) return;
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, selectedItemId);
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item) {
        item.chord = chord?.trim() ? chord.trim() : undefined;
      }
      return newScore;
    });
  }, [selectedItemId, selectedMeasureIdx, selectedStaffIdx]);

  const updateSelectedStep = useCallback((step: Step) => {
    if (!selectedItemId) return;
    pushHistory(score);
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const loc = findStaffAndMeasure(newScore, selectedStaffIdx, selectedMeasureIdx, selectedItemId);
      if (!loc) return prev;
      const { measure } = loc;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item && item.type === 'note' && item.pitch) {
        item.pitch.step = step;
        audioEngine.playMidi(pitchToMidi(item.pitch), 0.35);
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, selectedStaffIdx, pushHistory]);

  const addMeasure = useCallback(() => {
    pushHistory(score);
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      newScore.staves.forEach(staff => {
        staff.measures.push({
          id: `meas-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          items: [{
            id: `rest-${Date.now()}`,
            type: 'rest',
            duration: 'w'
          }]
        });
      });
      return newScore;
    });
  }, [score, pushHistory]);

  const deleteMeasure = useCallback((idx: number) => {
    pushHistory(score);
    setSelectedItemId(null);
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      newScore.staves.forEach(staff => {
        if (staff.measures.length > 1) {
          staff.measures.splice(idx, 1);
        }
      });
      return newScore;
    });
    setSelectedMeasureIdx(prev => Math.max(0, Math.min(prev, (score.staves[0]?.measures.length || 2) - 2)));
  }, [score, pushHistory]);

  const updateTitle = useCallback((title: string) => {
    setScore(prev => ({ ...prev, title }));
  }, []);

  const updateComposer = useCallback((composer: string) => {
    setScore(prev => ({ ...prev, composer }));
  }, []);

  const updateTempo = useCallback((tempo: number) => {
    setScore(prev => ({ ...prev, tempo: Math.max(30, Math.min(300, tempo)) }));
  }, []);

  const updateTimeSignature = useCallback((timeSig: TimeSignature) => {
    pushHistory(score);
    setScore(prev => ({ ...prev, timeSignature: timeSig }));
  }, [score, pushHistory]);

  const updateKeySignature = useCallback((keySig: KeySignature) => {
    pushHistory(score);
    setScore(prev => ({ ...prev, keySignature: keySig }));
  }, [score, pushHistory]);

  const transposeScore = useCallback((semitones: number) => {
    if (semitones === 0) return;
    pushHistory(score);
    setScore(prev => transposeScoreNotes(prev, semitones));
  }, [score, pushHistory]);

  const changeKeySignatureAndTranspose = useCallback((newKey: KeySignature, transposeNotes: boolean) => {
    if (newKey === score.keySignature) return;
    pushHistory(score);
    if (transposeNotes) {
      const semitones = getSemitoneOffsetBetweenKeys(score.keySignature, newKey);
      setScore(prev => transposeScoreNotes(prev, semitones, newKey));
    } else {
      setScore(prev => ({ ...prev, keySignature: newKey }));
    }
  }, [score, pushHistory]);

  const updateClef = useCallback((clef: Clef, staffIdx: number = 0) => {
    pushHistory(score);
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      if (newScore.staves[staffIdx]) {
        newScore.staves[staffIdx].clef = clef;
      }
      return newScore;
    });
  }, [score, pushHistory]);

  const toggleGrandStaff = useCallback(() => {
    pushHistory(score);
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      if (newScore.staves.length === 1) {
        // Activate Grand Staff: Treble (Right Hand) + Bass (Left Hand)
        newScore.staves[0].name = 'Mano Derecha';
        newScore.staves[0].clef = 'treble';
        const numMeasures = newScore.staves[0].measures.length;
        const bassMeasures = Array.from({ length: numMeasures }, (_, i) => ({
          id: `m-bass-${Date.now()}-${i}`,
          items: [{
            id: `rest-bass-${Date.now()}-${i}`,
            type: 'rest' as const,
            duration: 'w' as const,
          }]
        }));
        newScore.staves.push({
          id: 'staff-bass',
          name: 'Mano Izquierda',
          clef: 'bass',
          measures: bassMeasures,
        });
      } else {
        // Revert to single staff
        newScore.staves[0].name = 'Voz';
        newScore.staves = [newScore.staves[0]];
        setSelectedStaffIdx(0);
      }
      newScore.updatedAt = Date.now();
      return newScore;
    });
  }, [score, pushHistory]);

  const loadTemplate = useCallback((template: ScoreTemplate) => {
    pushHistory(score);
    const cloned = JSON.parse(JSON.stringify(template.score)) as Score;
    cloned.id = `score-${Date.now()}`;
    setScore(cloned);
    setSelectedItemId(null);
    setSelectedMeasureIdx(0);
    setSelectedStaffIdx(0);
  }, [score, pushHistory]);

  const clearScore = useCallback(() => {
    const blank = TEMPLATES.find(t => t.id === 'blank-score') || TEMPLATES[0];
    loadTemplate(blank);
  }, [loadTemplate]);

  return {
    score,
    selectedItemId,
    selectedMeasureIdx,
    selectedStaffIdx,
    setSelectedStaffIdx,
    toggleGrandStaff,
    isGrandStaff: score.staves.length > 1,
    activeDuration,
    setActiveDuration,
    activeAccidental,
    setActiveAccidental,
    isRestMode,
    setIsRestMode,
    isDotted,
    setIsDotted,
    selectItem,
    insertNoteAt,
    insertRestAt,
    deleteSelected,
    transposeSelected,
    changeSelectedDuration,
    toggleSelectedDot,
    setSelectedAccidental,
    updateSelectedLyric,
    updateSelectedChord,
    updateSelectedStep,
    addMeasure,
    deleteMeasure,
    updateTitle,
    updateComposer,
    updateTempo,
    updateTimeSignature,
    updateKeySignature,
    transposeScore,
    changeKeySignatureAndTranspose,
    updateClef,
    loadTemplate,
    clearScore,
    undo,
    redo,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
