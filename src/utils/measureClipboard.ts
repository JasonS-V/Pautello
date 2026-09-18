import { Measure, Score } from '../types/music';

export interface MeasureClipboard {
  count: number;
  stavesMeasures: Measure[][];
}

/**
 * Copies a range of measures from all staves into a clipboard structure
 */
export function copyMeasuresFromScore(
  score: Score,
  startMeasureIdx: number,
  endMeasureIdx: number
): MeasureClipboard {
  const maxIdx = (score.staves[0]?.measures.length || 1) - 1;
  const start = Math.max(0, Math.min(startMeasureIdx, endMeasureIdx));
  const end = Math.min(maxIdx, Math.max(startMeasureIdx, endMeasureIdx));

  const stavesMeasures = score.staves.map((staff) => {
    return staff.measures.slice(start, end + 1).map((m) => {
      const cloned: Measure = JSON.parse(JSON.stringify(m));
      return cloned;
    });
  });

  return {
    count: end - start + 1,
    stavesMeasures,
  };
}

/**
 * Pastes clipboard measures into a score starting at targetMeasureIdx,
 * with clean ID regeneration to avoid collisions.
 */
export function pasteMeasuresIntoScore(
  score: Score,
  clipboard: MeasureClipboard,
  targetMeasureIdx: number
): Score {
  if (!clipboard || clipboard.stavesMeasures.length === 0) return score;

  const newScore: Score = JSON.parse(JSON.stringify(score));

  newScore.staves.forEach((staff, sIdx) => {
    const sourceMeasures = clipboard.stavesMeasures[sIdx] || clipboard.stavesMeasures[0] || [];
    sourceMeasures.forEach((srcMeasure, offset) => {
      const destIdx = targetMeasureIdx + offset;
      const regeneratedMeasure: Measure = {
        ...JSON.parse(JSON.stringify(srcMeasure)),
        id: `meas-${destIdx}-${Math.random().toString(36).substr(2, 5)}`,
        items: srcMeasure.items.map((it, itIdx) => ({
          ...JSON.parse(JSON.stringify(it)),
          id: `item-${destIdx}-${itIdx}-${Math.random().toString(36).substr(2, 5)}`,
        })),
      };

      if (destIdx < staff.measures.length) {
        staff.measures[destIdx] = regeneratedMeasure;
      } else {
        staff.measures.push(regeneratedMeasure);
      }
    });
  });

  return newScore;
}

/**
 * Calculates Caret movement (ArrowLeft / ArrowRight) across notes and measure boundaries
 */
export function getNextNavigationPosition(
  measures: Measure[],
  currentMeasureIdx: number,
  currentItemId: string | null,
  direction: 'prev' | 'next'
): { measureIdx: number; itemId: string | null } {
  if (measures.length === 0) return { measureIdx: 0, itemId: null };

  const currentMeasure = measures[currentMeasureIdx];
  if (!currentMeasure) return { measureIdx: 0, itemId: null };

  const currentItemIdx = currentItemId
    ? currentMeasure.items.findIndex((it) => it.id === currentItemId)
    : -1;

  if (direction === 'prev') {
    if (currentItemIdx > 0) {
      return {
        measureIdx: currentMeasureIdx,
        itemId: currentMeasure.items[currentItemIdx - 1].id,
      };
    }
    if (currentMeasureIdx > 0) {
      const prevMeasure = measures[currentMeasureIdx - 1];
      const lastItem = prevMeasure.items[prevMeasure.items.length - 1];
      return {
        measureIdx: currentMeasureIdx - 1,
        itemId: lastItem ? lastItem.id : null,
      };
    }
    return { measureIdx: currentMeasureIdx, itemId: currentItemId };
  } else {
    // next
    if (currentItemIdx >= 0 && currentItemIdx < currentMeasure.items.length - 1) {
      return {
        measureIdx: currentMeasureIdx,
        itemId: currentMeasure.items[currentItemIdx + 1].id,
      };
    }
    if (currentMeasureIdx < measures.length - 1) {
      const nextMeasure = measures[currentMeasureIdx + 1];
      const firstItem = nextMeasure.items[0];
      return {
        measureIdx: currentMeasureIdx + 1,
        itemId: firstItem ? firstItem.id : null,
      };
    }
    return { measureIdx: currentMeasureIdx, itemId: currentItemId };
  }
}
