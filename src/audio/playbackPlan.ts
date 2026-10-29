import { KeySignature, Score, ScoreItem, TimeSignature, getItemPitches } from '../types/music';
import {
  getMeasureItemStreamTimings,
  getMeasureTimings,
  resolveMeasureCapacity,
} from '../utils/measureTiming';
import { pitchToMidi } from '../constants/pitches';

export interface MeasureVisit {
  measureIndex: number;
  pass: number;
  tempo: number;
  timeSignature: TimeSignature;
  keySignature: KeySignature;
  startBeat: number;
  startSeconds: number;
  durationBeats: number;
  durationSeconds: number;
}

export interface PlaybackPlan {
  visits: MeasureVisit[];
  diagnostics: string[];
  durationSeconds: number;
}

export interface PerformedNote {
  staffIndex: number;
  measureIndex: number;
  itemIndex: number;
  visitIndex: number;
  pitch: number;
  item: ScoreItem;
  startBeat: number;
  endBeat: number;
  startSeconds: number;
  endSeconds: number;
}

/** Shared sounding note timeline for live playback and file export. */
export function collectPerformedNotes(score: Score, plan: PlaybackPlan): PerformedNote[] {
  const notes: PerformedNote[] = [];
  score.staves.forEach((staff, staffIndex) => {
    const pending = new Map<string, PerformedNote>();
    plan.visits.forEach((visit, visitIndex) => {
      const writtenMeasure = staff.measures[visit.measureIndex];
      const measure =
        writtenMeasure?.isMeasureRepeat && visit.measureIndex > 0
          ? staff.measures[visit.measureIndex - 1]
          : writtenMeasure;
      if (!measure) return;
      const capacity = resolveMeasureCapacity(score, measure, visit.measureIndex);
      getMeasureItemStreamTimings(measure.items, capacity).forEach(
        ({ item, itemIndex, startBeat, durationBeats }) => {
          if (item.type !== 'note') return;
          const startSeconds = visit.startSeconds + (startBeat * 60) / visit.tempo;
          const endSeconds = startSeconds + (durationBeats * 60) / visit.tempo;
          const startAbsoluteBeat = visit.startBeat + startBeat;
          for (const pitch of getItemPitches(item)) {
            const midi = pitchToMidi(pitch);
            const key = `${item.voice || 1}:${midi}`;
            const previous = pending.get(key);
            if (previous && Math.abs(previous.endSeconds - startSeconds) < 0.001) {
              previous.endSeconds = endSeconds;
              previous.endBeat = startAbsoluteBeat + durationBeats;
              if (!item.isTied) pending.delete(key);
            } else {
              const note: PerformedNote = {
                staffIndex,
                measureIndex: visit.measureIndex,
                itemIndex,
                visitIndex,
                pitch: midi,
                item,
                startBeat: startAbsoluteBeat,
                endBeat: startAbsoluteBeat + durationBeats,
                startSeconds,
                endSeconds,
              };
              notes.push(note);
              if (item.isTied) pending.set(key, note);
              else pending.delete(key);
            }
          }
        }
      );
    });
  });
  return notes.sort((a, b) => a.startSeconds - b.startSeconds || a.staffIndex - b.staffIndex);
}

/** The score is kept in written order; this bounded route is its performed order. */
export function buildPlaybackPlan(score: Score): PlaybackPlan {
  const measures = score.staves[0]?.measures ?? [];
  const timings = getMeasureTimings(score);
  const visits: MeasureVisit[] = [];
  const diagnostics: string[] = [];
  const counts = new Map<number, number>();
  const passes = new Map<number, number>();
  const ids = new Map(measures.map((measure, index) => [measure.id, index]));
  let index = 0;
  let beat = 0;
  let seconds = 0;
  let jumped = false;
  let codaExit: number | undefined;
  let stopAtFine = false;
  const maxVisits = Math.max(64, measures.length * 16);

  const destination = (id: string | undefined, mark: 'segno' | 'coda' | 'toCoda', at: number) => {
    const explicit = id === undefined ? undefined : ids.get(id);
    const matches = measures.flatMap((measure, i) => (measure.navigationMark === mark ? [i] : []));
    const resolved =
      explicit !== undefined && measures[explicit].navigationMark === mark
        ? explicit
        : id === undefined && matches.length === 1
          ? matches[0]
          : undefined;
    if (resolved === undefined)
      diagnostics.push(`Compás ${at + 1}: destino ${mark} ausente o ambiguo`);
    return resolved;
  };

  while (index < measures.length && visits.length < maxVisits) {
    const ending = measures[index].volta;
    if (ending) {
      const repeatEnd = measures.findIndex((measure, i) => i >= index && measure.repeatEnd);
      if (repeatEnd >= index) {
        const pass = (counts.get(repeatEnd) ?? 0) + 1;
        const allowed = ending.match(/\d+/g)?.map(Number) ?? [];
        if (allowed.length > 0 && !allowed.includes(pass)) {
          index = repeatEnd + 1;
          continue;
        }
      }
    }
    const measure = measures[index];
    const timing = timings[index];
    const durationBeats =
      resolveMeasureCapacity(score, measure, index) *
      (measure.multimeasureRest && measure.multimeasureRest > 1 ? measure.multimeasureRest : 1);
    const tempo = Math.max(30, Math.min(300, timing?.tempo || score.tempo || 120));
    const durationSeconds = (durationBeats * 60) / tempo;
    const pass = (passes.get(index) ?? 0) + 1;
    passes.set(index, pass);
    visits.push({
      measureIndex: index,
      pass,
      tempo,
      timeSignature: timing?.timeSignature ?? score.timeSignature,
      keySignature: timing?.keySignature ?? score.keySignature,
      startBeat: beat,
      startSeconds: seconds,
      durationBeats,
      durationSeconds,
    });
    beat += durationBeats;
    seconds += durationSeconds;

    if (measure.navigationMark === 'fine' && stopAtFine) break;
    if (jumped && index === codaExit) {
      const target = destination(measure.navigationTargetMeasureId, 'coda', index);
      codaExit = undefined;
      if (target !== undefined) {
        index = target;
        continue;
      }
    }
    const mark = measure.navigationMark;
    if (
      !jumped &&
      (mark === 'daCapo' ||
        mark === 'daCapoAlFine' ||
        mark === 'dalSegno' ||
        mark === 'dalSegnoAlCoda')
    ) {
      const target =
        mark === 'daCapo' || mark === 'daCapoAlFine'
          ? 0
          : destination(measure.navigationTargetMeasureId, 'segno', index);
      if (target !== undefined) {
        jumped = true;
        stopAtFine = mark === 'daCapoAlFine';
        if (mark === 'dalSegnoAlCoda')
          codaExit = destination(measure.navigationExitMeasureId, 'toCoda', index);
        index = target;
        continue;
      }
    }
    if (measure.repeatEnd) {
      const repeats = counts.get(index) ?? 0;
      if (repeats + 1 < (measure.repeatCount || 2)) {
        counts.set(index, repeats + 1);
        let start = index;
        while (start > 0 && !measures[start].repeatStart) start--;
        index = start;
        continue;
      }
    }
    index++;
  }
  if (visits.length >= maxVisits && index < measures.length)
    diagnostics.push('Recorrido interrumpido: límite de visitas alcanzado');
  return { visits, diagnostics, durationSeconds: seconds };
}
