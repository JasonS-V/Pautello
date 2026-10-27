import { useState, useCallback } from 'react';
import {
  Score,
  NoteDuration,
  Clef,
  KeySignature,
  TimeSignature,
  isPianoGrandStaff,
} from '../../types/music';
import { TEMPLATES, ScoreTemplate } from '../../constants/templates';
import { transposeScoreNotes, getSemitoneOffsetBetweenKeys } from '../../utils/keyDetection';
import { UseScoreSelectionReturn } from './useScoreSelection';

export interface UseStaffAndMetadataMutationsProps {
  score: Score;
  setScore: React.Dispatch<React.SetStateAction<Score>>;
  pushHistory: (score: Score) => void;
  selection: UseScoreSelectionReturn;
}

export function useStaffAndMetadataMutations({
  score,
  setScore,
  pushHistory,
  selection,
}: UseStaffAndMetadataMutationsProps) {
  const [viewMode, setViewMode] = useState<'full' | 'part'>('full');
  const [activePartStaffIdx, setActivePartStaffIdx] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<'continuous' | 'paged'>('continuous');
  const [measuresPerSystem, setMeasuresPerSystem] = useState<number>(3);

  const {
    setSelectedItemId,
    setSelectedMeasureIdx,
    setSelectedStaffIdx,
  } = selection;

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
    viewMode,
    setViewMode,
    activePartStaffIdx,
    setActivePartStaffIdx,
    layoutMode,
    setLayoutMode,
    measuresPerSystem,
    setMeasuresPerSystem,
    toggleGrandStaff,
    isGrandStaff: isPianoGrandStaff(score),
    updateScoreMetadata,
    updateStaffShortName,
    updateStaffTransposition,
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
    addStaff,
    removeStaff,
    updateStaffName,
    updateStaffClef,
  };
}
