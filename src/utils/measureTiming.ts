import {
  KeySignature,
  Measure,
  Score,
  TimeSignature,
  ScoreItem,
  NoteDuration,
} from '../types/music';
import { getItemBeats } from '../constants/pitches';

/** Duración en negras de un compás de `timeSignature` (4/4 → 4, 6/8 → 3). */
export function beatsFromTimeSignature(timeSignature: TimeSignature): number {
  const { beats, beatType } = timeSignature;
  if (!Number.isFinite(beats) || !Number.isFinite(beatType) || beats <= 0 || beatType <= 0) {
    return 4;
  }
  return beats * (4 / beatType);
}

/** Métrica, tempo y tonalidad vigentes en un compás concreto. */
export interface MeasureTiming {
  timeSignature: TimeSignature;
  beatsPerMeasure: number;
  tempo: number;
  keySignature: KeySignature;
}

/**
 * Resuelve los cambios locales de toda la obra.
 *
 * Un cambio local se hereda: manda desde su compás hasta el siguiente cambio, o
 * hasta el final. Es lo que ofrece el botón "Heredar" del Inspector al limpiarlo.
 *
 * Se usa el pentagrama de referencia (el primero) porque los cambios se aplican a
 * todos los pentagramas a la vez.
 */
export function getMeasureTimings(score: Score): MeasureTiming[] {
  const measures = score.staves[0]?.measures ?? [];
  const initial: MeasureTiming = {
    timeSignature: score.timeSignature,
    beatsPerMeasure: beatsFromTimeSignature(score.timeSignature),
    tempo: score.tempo,
    keySignature: score.keySignature,
  };

  const timings: MeasureTiming[] = [];
  let current = initial;

  measures.forEach((measure) => {
    const next: MeasureTiming = { ...current };
    if (measure.timeSignatureChange) {
      next.timeSignature = measure.timeSignatureChange;
      next.beatsPerMeasure = beatsFromTimeSignature(measure.timeSignatureChange);
    }
    if (typeof measure.tempoBpm === 'number' && measure.tempoBpm > 0) {
      next.tempo = measure.tempoBpm;
    }
    if (measure.keySignatureChange) {
      next.keySignature = measure.keySignatureChange;
    }
    current = next;
    timings.push(next);
  });

  return timings;
}

/** Capacidad del compás indicado, contando los cambios locales heredados. */
export function getMeasureCapacityBeats(score: Score, measureIdx: number): number {
  const timings = getMeasureTimings(score);
  return getCapacityFromTimings(timings, measureIdx, score.timeSignature);
}

/**
 * Capacidad en negras de una posición ya resuelta. Si la posición queda después
 * del último compás (por ejemplo uno recién añadido), hereda la métrica vigente:
 * un compás nuevo mantiene el compás que se estaba usando.
 */
export function getCapacityFromTimings(
  timings: MeasureTiming[],
  measureIdx: number,
  fallbackTimeSignature: TimeSignature
): number {
  const timing = timings[measureIdx] ?? timings[timings.length - 1];
  return timing ? timing.beatsPerMeasure : beatsFromTimeSignature(fallbackTimeSignature);
}

/** Capacidad que corresponde a un compás concreto dentro de su obra. */
export function resolveMeasureCapacity(score: Score, measure: Measure, measureIdx: number): number {
  if (measure.isAnacrusis && measure.pickupBeats) return measure.pickupBeats;
  return getMeasureCapacityBeats(score, measureIdx);
}

export interface CanonicalRestSpec {
  beats: number;
  duration: NoteDuration;
  isDotted?: boolean;
}

export const CANONICAL_REST_TABLE: CanonicalRestSpec[] = [
  { beats: 4.0, duration: 'w' },
  { beats: 3.0, duration: 'h', isDotted: true },
  { beats: 2.0, duration: 'h' },
  { beats: 1.5, duration: 'q', isDotted: true },
  { beats: 1.0, duration: 'q' },
  { beats: 0.75, duration: '8', isDotted: true },
  { beats: 0.5, duration: '8' },
  { beats: 0.25, duration: '16' },
  { beats: 0.125, duration: '32' },
];

/**
 * Decomposes a remaining duration (in beats) into canonical structured rests.
 * E.g., 3.0 beats in 4/4 -> [h., or h + q], 1.5 beats -> [q.], etc.
 */
export function decomposeDurationIntoCanonicalRests(
  beats: number,
  voice?: 1 | 2,
  timeSignature?: TimeSignature
): ScoreItem[] {
  let remaining = Math.round(beats * 1000) / 1000;
  if (remaining < 0.12) return [];

  const rests: ScoreItem[] = [];
  const isCompound = !!(
    timeSignature &&
    timeSignature.beatType === 8 &&
    timeSignature.beats % 3 === 0
  );

  while (remaining >= 0.12) {
    const candidate = CANONICAL_REST_TABLE.find((entry) => {
      // In 4/4, avoid a dotted half rest if the whole bar (4 beats) is being decomposed
      if (!isCompound && entry.beats === 3.0 && remaining >= 4.0) {
        return false;
      }
      return entry.beats <= remaining + 1e-4;
    });

    if (!candidate) break;

    rests.push({
      id: `rest-pad-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: 'rest',
      duration: candidate.duration,
      isDotted: candidate.isDotted,
      voice,
    });

    remaining = Math.round((remaining - candidate.beats) * 1000) / 1000;
  }

  return rests;
}

/**
 * Calculates occupied beats for items belonging to a given voice.
 * If voice is not specified, considers all items.
 */
export function getVoiceOccupiedBeats(items: ScoreItem[], voice?: 1 | 2): number {
  const filtered = voice
    ? items.filter((it) => (voice === 2 ? it.voice === 2 : it.voice !== 2))
    : items;
  return filtered.reduce((sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet), 0);
}

export interface MeasureItemTiming {
  item: ScoreItem;
  itemIndex: number;
  startBeat: number;
  durationBeats: number;
}

/**
 * Calculates start beats for all items in a measure, correctly handling
 * polyphonic streams (Voice 1 and Voice 2 start from beat 0 independently).
 */
export function getMeasureItemStreamTimings(
  items: ScoreItem[],
  maxMeasureBeats?: number
): MeasureItemTiming[] {
  const timings: MeasureItemTiming[] = new Array(items.length);

  let beatV1 = 0;
  items.forEach((item, idx) => {
    if (item.voice !== 2) {
      let dur = getItemBeats(item.duration, item.isDotted, item.tuplet);
      if (
        item.type === 'rest' &&
        item.duration === 'w' &&
        maxMeasureBeats &&
        dur > maxMeasureBeats
      ) {
        dur = maxMeasureBeats;
      }
      timings[idx] = { item, itemIndex: idx, startBeat: beatV1, durationBeats: dur };
      beatV1 += dur;
    }
  });

  let beatV2 = 0;
  items.forEach((item, idx) => {
    if (item.voice === 2) {
      let dur = getItemBeats(item.duration, item.isDotted, item.tuplet);
      if (
        item.type === 'rest' &&
        item.duration === 'w' &&
        maxMeasureBeats &&
        dur > maxMeasureBeats
      ) {
        dur = maxMeasureBeats;
      }
      timings[idx] = { item, itemIndex: idx, startBeat: beatV2, durationBeats: dur };
      beatV2 += dur;
    }
  });

  return timings;
}

/**
 * Automatically pads a measure with canonical rests (rest padding) to maintain exact metric integrity.
 * If polyphonic (voice 1 and voice 2 present), each voice stream is independently padded to maxBeats.
 */
export function padMeasureWithCanonicalRests(
  measure: Measure,
  maxBeats: number,
  timeSignature?: TimeSignature
): Measure {
  const effectiveMax = measure.isAnacrusis && measure.pickupBeats ? measure.pickupBeats : maxBeats;
  if (!effectiveMax || effectiveMax <= 0) return measure;

  const items = measure.items || [];
  if (items.length === 0) {
    measure.items = [
      {
        id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'rest',
        duration: 'w',
      },
    ];
    return measure;
  }

  // Check if measure is already a single full-measure rest
  if (
    items.length === 1 &&
    items[0].type === 'rest' &&
    items[0].duration === 'w' &&
    !items[0].voice
  ) {
    return measure;
  }

  const hasVoice2 = items.some((it) => it.voice === 2);

  const padStream = (voiceItems: ScoreItem[], v?: 1 | 2): ScoreItem[] => {
    if (voiceItems.length === 0) {
      return [];
    }

    if (
      voiceItems.length === 1 &&
      voiceItems[0].type === 'rest' &&
      voiceItems[0].duration === 'w'
    ) {
      return voiceItems;
    }

    // Find trailing padding rests (id starts with 'rest-pad-' or 'r-pad')
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
      if (v === 2) {
        return decomposeDurationIntoCanonicalRests(effectiveMax, 2, timeSignature);
      }
      return [
        {
          id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'rest',
          duration: 'w',
        },
      ];
    }

    const activeItems = voiceItems.slice(0, lastActiveIdx + 1);

    // If all items are rests and none was explicitly user-inserted
    const allRests = activeItems.every((it) => it.type === 'rest');
    const hasUserRest = activeItems.some(
      (it) => it.type === 'rest' && (it.id.startsWith('item-rest-') || it.id.startsWith('r-'))
    );
    if (allRests && !hasUserRest) {
      if (v === 2) {
        return decomposeDurationIntoCanonicalRests(effectiveMax, 2, timeSignature);
      }
      return [
        {
          id: `rest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'rest',
          duration: 'w',
        },
      ];
    }

    const activeBeats = activeItems.reduce(
      (sum, it) => sum + getItemBeats(it.duration, it.isDotted, it.tuplet),
      0
    );

    const remainingBeats = Math.max(0, Math.round((effectiveMax - activeBeats) * 1000) / 1000);
    if (remainingBeats >= 0.12) {
      const paddingRests = decomposeDurationIntoCanonicalRests(remainingBeats, v, timeSignature);
      return [...activeItems, ...paddingRests];
    }
    return activeItems;
  };

  if (!hasVoice2) {
    measure.items = padStream(items, undefined);
  } else {
    const voice1Items = items.filter((it) => it.voice !== 2);
    const voice2Items = items.filter((it) => it.voice === 2);
    const paddedV1 = padStream(voice1Items, 1);
    const paddedV2 = padStream(voice2Items, 2);
    measure.items = [...paddedV1, ...paddedV2];
  }

  return measure;
}
