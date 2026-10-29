import { Score, isPianoGrandStaff } from '../types/music';
import { resolveStaffInstrument } from './synth';
import { buildPlaybackPlan, collectPerformedNotes } from './playbackPlan';

export interface MidiExportOptions {
  format?: 0 | 1;
}

const INSTRUMENT_GM_PROGRAM: Record<string, number> = {
  piano: 0,
  melody: 73,
  bass: 32,
  harmony: 48,
  marimba: 12,
  strings: 48,
  flute: 73,
};
const TICKS_PER_QUARTER = 960;

export function writeVariableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes = [buffer];
  while ((value >>= 7) > 0) {
    buffer = (value & 0x7f) | 0x80;
    bytes.unshift(buffer);
  }
  return bytes;
}

const word = (value: number) => [(value >> 8) & 255, value & 255];
const dword = (value: number) => [
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const ascii = (value: string) => Array.from(value, (ch) => ch.charCodeAt(0) & 255);
const textEvent = (kind: number, value: string) => {
  const bytes = ascii(value);
  return [0xff, kind, ...writeVariableLength(bytes.length), ...bytes];
};
const tempoEvent = (tempo: number) => {
  const micros = Math.round(60_000_000 / tempo);
  return [0xff, 0x51, 3, (micros >> 16) & 255, (micros >> 8) & 255, micros & 255];
};
const meterEvent = (beats: number, beatType: number) => [
  0xff,
  0x58,
  4,
  beats,
  Math.round(Math.log2(beatType)),
  24,
  8,
];

interface Event {
  tick: number;
  priority: number;
  bytes: number[];
}
function track(events: Event[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
  const body: number[] = [];
  let last = 0;
  for (const event of events) {
    body.push(...writeVariableLength(event.tick - last), ...event.bytes);
    last = event.tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  return [...ascii('MTrk'), ...dword(body.length), ...body];
}

/** Standard MIDI with the same performed route as the player and WAV export. */
export function exportScoreToMidi(score: Score, options?: MidiExportOptions): Blob {
  const plan = buildPlaybackPlan(score);
  if (plan.diagnostics.length) throw new Error(plan.diagnostics.join('; '));
  const format1 =
    (options?.format ?? (score.staves.length > 1 ? 1 : 0)) === 1 && score.staves.length > 1;
  const conductor: Event[] = [
    { tick: 0, priority: 0, bytes: textEvent(0x03, score.title || 'Partitura') },
  ];
  let lastTempo = -1;
  let lastMeter = '';
  plan.visits.forEach((visit) => {
    const tick = Math.round(visit.startBeat * TICKS_PER_QUARTER);
    if (visit.tempo !== lastTempo) {
      conductor.push({ tick, priority: 1, bytes: tempoEvent(visit.tempo) });
      lastTempo = visit.tempo;
    }
    const meter = `${visit.timeSignature.beats}/${visit.timeSignature.beatType}`;
    if (meter !== lastMeter) {
      conductor.push({
        tick,
        priority: 2,
        bytes: meterEvent(visit.timeSignature.beats, visit.timeSignature.beatType),
      });
      lastMeter = meter;
    }
    const mark = score.staves[0]?.measures[visit.measureIndex]?.rehearsalMark;
    if (mark) conductor.push({ tick, priority: 3, bytes: textEvent(0x06, mark) });
  });

  const tracks: Event[][] = [conductor];
  score.staves.forEach((staff, staffIndex) => {
    const channel = staffIndex >= 9 ? (staffIndex + 1) % 16 : staffIndex;
    const destination = format1 ? (tracks[staffIndex + 1] = []) : tracks[0];
    destination.push({
      tick: 0,
      priority: 4,
      bytes: textEvent(0x03, staff.name || `Pista ${staffIndex + 1}`),
    });
    const instrument = resolveStaffInstrument(staff, isPianoGrandStaff(score));
    destination.push({
      tick: 0,
      priority: 5,
      bytes: [0xc0 | channel, INSTRUMENT_GM_PROGRAM[instrument] ?? 0],
    });
  });

  for (const note of collectPerformedNotes(score, plan)) {
    const destination = format1 ? tracks[note.staffIndex + 1] : tracks[0];
    const channel = note.staffIndex >= 9 ? (note.staffIndex + 1) % 16 : note.staffIndex;
    const start = Math.round(note.startBeat * TICKS_PER_QUARTER);
    const total = Math.round((note.endBeat - note.startBeat) * TICKS_PER_QUARTER);
    const factor =
      note.item.articulation === 'staccato'
        ? 0.45
        : note.item.articulation === 'fermata'
          ? 1.8
          : note.item.articulation === 'tenuto'
            ? 1
            : 0.96;
    const end = start + Math.max(1, Math.round(total * factor));
    const velocity =
      note.item.dynamic === 'pp'
        ? 50
        : note.item.dynamic === 'p'
          ? 68
          : note.item.dynamic === 'ff'
            ? 125
            : 96;
    destination.push({ tick: start, priority: 7, bytes: [0x90 | channel, note.pitch, velocity] });
    destination.push({ tick: end, priority: 6, bytes: [0x80 | channel, note.pitch, 0] });
  }
  const chunks = tracks.map(track);
  const header = [
    ...ascii('MThd'),
    ...dword(6),
    ...word(format1 ? 1 : 0),
    ...word(chunks.length),
    ...word(TICKS_PER_QUARTER),
  ];
  return new Blob([new Uint8Array([...header, ...chunks.flat()])], { type: 'audio/midi' });
}
