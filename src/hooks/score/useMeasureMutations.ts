import { useState, useCallback } from 'react';
import {
  Score,
  Measure,
  BarlineType,
  NavigationMark,
  KeySignature,
  TimeSignature,
  NoteDuration,
} from '../../types/music';
import {
  copyMeasuresFromScore,
  pasteMeasuresIntoScore,
  MeasureClipboard,
} from '../../utils/measureClipboard';
import { consolidateTacetsInScore, clearTacetsInScore } from '../../utils/tacetUtils';
import { UseScoreSelectionReturn } from './useScoreSelection';

export interface UseMeasureMutationsProps {
  score: Score;
  setScore: React.Dispatch<React.SetStateAction<Score>>;
  pushHistory: (score: Score) => void;
  selection: UseScoreSelectionReturn;
}

export function useMeasureMutations({
  score,
  setScore,
  pushHistory,
  selection,
}: UseMeasureMutationsProps) {
  const [clipboard, setClipboard] = useState<MeasureClipboard | null>(null);

  const {
    selectedMeasureIdx,
    setSelectedMeasureIdx,
    setSelectedItemId,
    measureRange,
    setMeasureRange,
  } = selection;

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

  return {
    clipboard,
    setClipboard,
    copySelectedMeasures,
    pasteMeasures,
    addMeasure,
    deleteMeasure,
    deleteSelectedMeasures,
    toggleMeasureRepeatStart,
    toggleMeasureRepeatEnd,
    setMeasureVolta,
    setMeasureAnacrusis,
    toggleMeasureSystemBreak,
    toggleMeasurePageBreak,
    setMeasureMultimeasureRest,
    autoConsolidateTacets,
    clearAllTacets,
    setMeasureBarline,
    setMeasureNavigationMark,
    setMeasureRehearsalMark,
    toggleMeasureRepeatSign,
    toggleMeasureCaesura,
    toggleMeasureBreathMark,
    setMeasureTempoText,
    setMeasureTimeSignatureChange,
    setMeasureKeySignatureChange,
  };
}
