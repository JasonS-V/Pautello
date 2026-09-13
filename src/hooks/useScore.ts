import { useState, useCallback, useEffect, useRef } from 'react';
import { Score, ScoreItem, Pitch, Step, NoteDuration, Accidental, Clef, KeySignature, TimeSignature } from '../types/music';
import { TEMPLATES, ScoreTemplate } from '../constants/templates';
import { loadScoreFromStorage, saveScoreToStorage } from '../utils/storage';
import { audioEngine } from '../audio/synth';
import { pitchToMidi, getItemBeats } from '../constants/pitches';

export function useScore() {
  const [score, setScore] = useState<Score>(() => loadScoreFromStorage());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedMeasureIdx, setSelectedMeasureIdx] = useState<number>(0);

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

  const selectItem = useCallback((measureIdx: number, itemId: string | null) => {
    setSelectedMeasureIdx(measureIdx);
    setSelectedItemId(itemId);
  }, []);

  const insertNoteAt = useCallback((measureIdx: number, pitch: Pitch, customDuration?: NoteDuration) => {
    pushHistory(score);
    const duration = customDuration || activeDuration;

    // Play audio feedback for the inserted pitch
    const midi = pitchToMidi(pitch);
    audioEngine.playMidi(midi, 0.35, 0.85);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
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

  const insertRestAt = useCallback((measureIdx: number, customDuration?: NoteDuration) => {
    pushHistory(score);
    const duration = customDuration || activeDuration;

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
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
      const staff = newScore.staves[0];
      if (!staff) return prev;

      const measure = staff.measures[selectedMeasureIdx];
      if (!measure) return prev;

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
  }, [score, selectedItemId, selectedMeasureIdx, pushHistory]);

  const transposeSelected = useCallback((semitones: number) => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
      if (!staff) return prev;

      const measure = staff.measures[selectedMeasureIdx];
      if (!measure) return prev;

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
  }, [score, selectedItemId, selectedMeasureIdx, pushHistory]);

  const changeSelectedDuration = useCallback((duration: NoteDuration) => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
      if (!staff) return prev;

      const measure = staff.measures[selectedMeasureIdx];
      if (!measure) return prev;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item) {
        item.duration = duration;
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, pushHistory]);

  const toggleSelectedDot = useCallback(() => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
      if (!staff) return prev;

      const measure = staff.measures[selectedMeasureIdx];
      if (!measure) return prev;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item) {
        item.isDotted = !item.isDotted;
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, pushHistory]);

  const setSelectedAccidental = useCallback((acc: Accidental) => {
    if (!selectedItemId) return;
    pushHistory(score);

    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
      if (!staff) return prev;

      const measure = staff.measures[selectedMeasureIdx];
      if (!measure) return prev;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item && item.type === 'note' && item.pitch) {
        item.pitch.accidental = item.pitch.accidental === acc ? null : acc;
        audioEngine.playMidi(pitchToMidi(item.pitch), 0.3);
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, pushHistory]);

  const updateSelectedLyric = useCallback((lyric: string) => {
    if (!selectedItemId) return;
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
      if (!staff) return prev;

      const measure = staff.measures[selectedMeasureIdx];
      if (!measure) return prev;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item) {
        item.lyric = lyric.trim() ? lyric : undefined;
      }
      return newScore;
    });
  }, [selectedItemId, selectedMeasureIdx]);

  const updateSelectedStep = useCallback((step: Step) => {
    if (!selectedItemId) return;
    pushHistory(score);
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      const staff = newScore.staves[0];
      if (!staff) return prev;

      const measure = staff.measures[selectedMeasureIdx];
      if (!measure) return prev;

      const item = measure.items.find(it => it.id === selectedItemId);
      if (item && item.type === 'note' && item.pitch) {
        item.pitch.step = step;
        audioEngine.playMidi(pitchToMidi(item.pitch), 0.35);
      }
      return newScore;
    });
  }, [score, selectedItemId, selectedMeasureIdx, pushHistory]);

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

  const updateClef = useCallback((clef: Clef) => {
    pushHistory(score);
    setScore(prev => {
      const newScore = JSON.parse(JSON.stringify(prev)) as Score;
      if (newScore.staves[0]) {
        newScore.staves[0].clef = clef;
      }
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
  }, [score, pushHistory]);

  const clearScore = useCallback(() => {
    const blank = TEMPLATES.find(t => t.id === 'blank-score') || TEMPLATES[0];
    loadTemplate(blank);
  }, [loadTemplate]);

  return {
    score,
    selectedItemId,
    selectedMeasureIdx,
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
    updateSelectedStep,
    addMeasure,
    deleteMeasure,
    updateTitle,
    updateComposer,
    updateTempo,
    updateTimeSignature,
    updateKeySignature,
    updateClef,
    loadTemplate,
    clearScore,
    undo,
    redo,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
