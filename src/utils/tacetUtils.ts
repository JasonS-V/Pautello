import { Score, Measure } from '../types/music';

/**
 * Determines whether a measure is considered "empty" / rest-only and eligible
 * to be grouped into a multimeasure rest according to Gould ("Behind Bars"):
 * - Contains no notes/chords (items empty or rests only)
 * - Has no structural boundaries (navigation marks, rehearsal marks, repeat barlines,
 *   meter/key changes, tempo marks, caesuras, breath marks).
 */
export function isMeasureTacetEligible(measure?: Measure): boolean {
  if (!measure) return false;

  // Cannot span across formal landmarks or repeat barlines
  if (
    measure.navigationMark ||
    measure.rehearsalMark ||
    measure.repeatStart ||
    measure.repeatEnd ||
    measure.volta ||
    measure.barline ||
    measure.isMeasureRepeat ||
    measure.caesura ||
    measure.breathMark
  ) {
    return false;
  }

  // Cannot span across tempo modulations or signature shifts
  if (
    measure.timeSignatureChange ||
    measure.keySignatureChange ||
    measure.tempoText ||
    measure.tempoBpm
  ) {
    return false;
  }

  // Check content: empty or rest-only
  if (!measure.items || measure.items.length === 0) return true;
  return measure.items.every((it) => it.type === 'rest');
}

/**
 * Scans staves in a score and automatically consolidates runs of 2 or more
 * contiguous empty measures into a multimeasure rest (Tacet).
 */
export function consolidateTacetsInScore(score: Score, staffIndex?: number): Score {
  const cloned = JSON.parse(JSON.stringify(score)) as Score;
  const targetStaves =
    staffIndex !== undefined && cloned.staves[staffIndex]
      ? [cloned.staves[staffIndex]]
      : cloned.staves;

  targetStaves.forEach((staff) => {
    // Clear any previous multimeasure rests
    staff.measures.forEach((m) => {
      delete m.multimeasureRest;
    });

    let startIdx = 0;
    while (startIdx < staff.measures.length) {
      if (isMeasureTacetEligible(staff.measures[startIdx])) {
        let endIdx = startIdx;
        while (
          endIdx + 1 < staff.measures.length &&
          isMeasureTacetEligible(staff.measures[endIdx + 1])
        ) {
          endIdx++;
        }
        const runLength = endIdx - startIdx + 1;
        if (runLength >= 2) {
          staff.measures[startIdx].multimeasureRest = runLength;
        }
        startIdx = endIdx + 1;
      } else {
        startIdx++;
      }
    }
  });

  return cloned;
}

/**
 * Clears all multimeasure rests across staves or on a specific staff.
 */
export function clearTacetsInScore(score: Score, staffIndex?: number): Score {
  const cloned = JSON.parse(JSON.stringify(score)) as Score;
  const targetStaves =
    staffIndex !== undefined && cloned.staves[staffIndex]
      ? [cloned.staves[staffIndex]]
      : cloned.staves;

  targetStaves.forEach((staff) => {
    staff.measures.forEach((m) => {
      delete m.multimeasureRest;
    });
  });

  return cloned;
}
