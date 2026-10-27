import { Score, Staff, Measure } from '../../types/music';
import { getItemBeats } from '../../constants/pitches';

export const AUTOSAVE_DEBOUNCE_MS = 500;

export function findStaffAndMeasure(
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
