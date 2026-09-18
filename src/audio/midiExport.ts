import { Score, Staff, getItemPitches, isPianoGrandStaff } from '../types/music';
import { getItemBeats, pitchToMidi } from '../constants/pitches';
import { getMeasureItemStreamTimings, resolveMeasureCapacity } from '../utils/measureTiming';
import { resolveStaffInstrument } from './synth';

export interface MidiExportOptions {
  format?: 0 | 1;
}

const INSTRUMENT_GM_PROGRAM: Record<string, number> = {
  piano: 0, // Acoustic Grand Piano
  melody: 73, // Flute / Lead
  bass: 32, // Acoustic Bass
  harmony: 48, // String Ensemble 1
  marimba: 12, // Marimba
  strings: 48, // String Ensemble 1
  flute: 73, // Flute
};

function getTiedTicks(
  staff: Staff,
  measureIdx: number,
  itemIdx: number,
  ticksPerQuarter: number
): number {
  let totalTicks = 0;
  let m = measureIdx;
  let i = itemIdx;
  const currentItem = staff.measures[m]?.items[i];
  if (!currentItem) return 0;
  const targetVoice = currentItem.voice || 1;

  while (m < staff.measures.length) {
    const cur = staff.measures[m]?.items[i];
    if (!cur) break;
    const b = getItemBeats(cur.duration, cur.isDotted, cur.tuplet);
    totalTicks += Math.round(b * ticksPerQuarter);

    if (!cur.isTied) break;

    let nextIdx = -1;
    for (let k = i + 1; k < staff.measures[m].items.length; k++) {
      if ((staff.measures[m].items[k].voice || 1) === targetVoice) {
        nextIdx = k;
        break;
      }
    }

    if (nextIdx !== -1) {
      i = nextIdx;
    } else {
      m++;
      if (m >= staff.measures.length) break;
      const nextMeas = staff.measures[m];
      const firstSameVoiceIdx = nextMeas.items.findIndex((it) => (it.voice || 1) === targetVoice);
      if (firstSameVoiceIdx !== -1) {
        i = firstSameVoiceIdx;
      } else {
        break;
      }
    }
  }

  return totalTicks;
}

function isTiedFromPrev(staff: Staff, measureIdx: number, itemIdx: number): boolean {
  const currentMeasure = staff.measures[measureIdx];
  if (!currentMeasure) return false;
  const currentItem = currentMeasure.items[itemIdx];
  if (!currentItem) return false;
  const targetVoice = currentItem.voice || 1;

  for (let i = itemIdx - 1; i >= 0; i--) {
    const it = currentMeasure.items[i];
    if ((it.voice || 1) === targetVoice) {
      return !!it.isTied;
    }
  }

  if (measureIdx > 0) {
    const prevMeasure = staff.measures[measureIdx - 1];
    if (prevMeasure && prevMeasure.items.length > 0) {
      for (let i = prevMeasure.items.length - 1; i >= 0; i--) {
        const it = prevMeasure.items[i];
        if ((it.voice || 1) === targetVoice) {
          return !!it.isTied;
        }
      }
    }
  }
  return false;
}

export function writeVariableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [buffer];
  while ((value >>= 7) > 0) {
    buffer = (value & 0x7f) | 0x80;
    bytes.unshift(buffer);
  }
  return bytes;
}

function writeString(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}

function write32Bit(val: number): number[] {
  return [(val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff];
}

function write16Bit(val: number): number[] {
  return [(val >> 8) & 0xff, val & 0xff];
}

interface MidiNoteEvent {
  tick: number;
  type: 'on' | 'off';
  pitch: number;
  velocity: number;
  order: number;
}

function collectStaffMidiEvents(
  score: Score,
  staff: Staff,
  ticksPerQuarter: number
): MidiNoteEvent[] {
  const events: MidiNoteEvent[] = [];
  let measureDownbeatTick = 0;

  for (let mIdx = 0; mIdx < staff.measures.length; mIdx++) {
    const measure = staff.measures[mIdx];
    const measCapacity = resolveMeasureCapacity(score, measure, mIdx);
    const streamTimings = getMeasureItemStreamTimings(measure.items, measCapacity);

    for (let itemIdx = 0; itemIdx < measure.items.length; itemIdx++) {
      const item = measure.items[itemIdx];
      const timing = streamTimings[itemIdx];
      const startBeat = timing ? timing.startBeat : 0;
      const durBeats = timing
        ? timing.durationBeats
        : getItemBeats(item.duration, item.isDotted, item.tuplet);
      const itemTick = measureDownbeatTick + Math.round(startBeat * ticksPerQuarter);
      const itemTicks = Math.round(durBeats * ticksPerQuarter);

      const isTiedContinuing = isTiedFromPrev(staff, mIdx, itemIdx);
      if (item.type === 'note' && !isTiedContinuing) {
        const pitches = getItemPitches(item);
        const DYNAMIC_MIDI_VELOCITIES: Record<string, number> = {
          pp: 50,
          p: 68,
          mp: 82,
          mf: 96,
          f: 112,
          ff: 125,
        };
        let velocity = item.dynamic ? DYNAMIC_MIDI_VELOCITIES[item.dynamic] || 96 : 96;
        if (item.articulation === 'accent') velocity = Math.min(127, Math.round(velocity * 1.2));

        const totalTicks = item.isTied
          ? getTiedTicks(staff, mIdx, itemIdx, ticksPerQuarter)
          : itemTicks;
        const noteDurationTicks =
          item.articulation === 'staccato'
            ? Math.round(totalTicks * 0.5)
            : item.articulation === 'tenuto'
              ? totalTicks
              : item.articulation === 'fermata'
                ? Math.round(totalTicks * 1.8)
                : Math.max(10, totalTicks - 10);

        pitches.forEach((p) => {
          const midiPitch = pitchToMidi(p);
          events.push({
            tick: itemTick,
            type: 'on',
            pitch: midiPitch,
            velocity,
            order: 1,
          });

          events.push({
            tick: itemTick + noteDurationTicks,
            type: 'off',
            pitch: midiPitch,
            velocity: 0,
            order: 0,
          });
        });
      }
    }

    measureDownbeatTick += Math.round(measCapacity * ticksPerQuarter);
  }

  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return a.order - b.order;
  });

  return events;
}

function buildMTrkChunk(eventsBytes: number[]): number[] {
  return [
    0x4d,
    0x54,
    0x72,
    0x6b, // 'MTrk'
    ...write32Bit(eventsBytes.length),
    ...eventsBytes,
  ];
}

/**
 * Exports a Score to a standard MIDI binary Blob.
 * If the score has multiple staves (or options.format is 1), it exports Standard
 * MIDI Format 1 (multitrack with independent tracks and channels for DAWs).
 * If the score has 1 staff (or options.format is 0), it exports Standard MIDI Format 0.
 */
export function exportScoreToMidi(score: Score, options?: MidiExportOptions): Blob {
  const ticksPerQuarter = 480;
  const bpm = Math.max(30, Math.min(300, score.tempo || 120));
  const microsecondsPerQuarter = Math.round(60000000 / bpm);
  const isMultiStaff = (score.staves || []).length > 1;
  const isFormat1 = options?.format !== undefined ? options.format === 1 : isMultiStaff;

  if (isFormat1 && isMultiStaff) {
    // Standard MIDI Format 1: Multitrack
    // Track 0: Conductor (Tempo, Time Signature, Song Title)
    const conductorEvents: number[] = [];
    const titleBytes = writeString(score.title || 'Partitura');
    conductorEvents.push(0x00, 0xff, 0x03, titleBytes.length, ...titleBytes);
    conductorEvents.push(
      0x00,
      0xff,
      0x51,
      0x03,
      (microsecondsPerQuarter >> 16) & 0xff,
      (microsecondsPerQuarter >> 8) & 0xff,
      microsecondsPerQuarter & 0xff
    );
    const nn = score.timeSignature.beats;
    const dd = Math.round(Math.log2(score.timeSignature.beatType));
    conductorEvents.push(0x00, 0xff, 0x58, 0x04, nn, dd, 24, 8);
    conductorEvents.push(0x00, 0xff, 0x2f, 0x00);

    const trackChunks: number[][] = [buildMTrkChunk(conductorEvents)];

    score.staves.forEach((staff, sIdx) => {
      const channel = sIdx === 9 ? 10 : sIdx % 16;
      const staffEvents: number[] = [];

      // Track Name
      const staffNameBytes = writeString(staff.name || `Pista ${sIdx + 1}`);
      staffEvents.push(0x00, 0xff, 0x03, staffNameBytes.length, ...staffNameBytes);

      // Program change
      const instrument = resolveStaffInstrument(staff, isPianoGrandStaff(score));
      const program = INSTRUMENT_GM_PROGRAM[instrument] ?? 0;
      staffEvents.push(0x00, 0xc0 | channel, program & 0x7f);

      // Notes
      const rawEvents = collectStaffMidiEvents(score, staff, ticksPerQuarter);
      let lastTick = 0;
      for (const ev of rawEvents) {
        const delta = Math.max(0, ev.tick - lastTick);
        staffEvents.push(...writeVariableLength(delta));
        const status = (ev.type === 'on' ? 0x90 : 0x80) | channel;
        staffEvents.push(status, ev.pitch, ev.velocity);
        lastTick = ev.tick;
      }

      // End of Track
      staffEvents.push(0x00, 0xff, 0x2f, 0x00);
      trackChunks.push(buildMTrkChunk(staffEvents));
    });

    const header = [
      0x4d,
      0x54,
      0x68,
      0x64, // 'MThd'
      0x00,
      0x00,
      0x00,
      0x06, // Header length (6 bytes)
      0x00,
      0x01, // Format 1 (multitrack)
      ...write16Bit(trackChunks.length),
      ...write16Bit(ticksPerQuarter),
    ];

    const fileBytes = new Uint8Array([...header, ...trackChunks.flat()]);
    return new Blob([fileBytes], { type: 'audio/midi' });
  }

  // Standard MIDI Format 0: Single Track
  const trackEvents: number[] = [];

  // Track Name event
  const trackNameBytes = writeString(score.title || 'Partitura');
  trackEvents.push(0x00, 0xff, 0x03, trackNameBytes.length, ...trackNameBytes);

  // Set Tempo event: FF 51 03 tt tt tt
  trackEvents.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (microsecondsPerQuarter >> 16) & 0xff,
    (microsecondsPerQuarter >> 8) & 0xff,
    microsecondsPerQuarter & 0xff
  );

  // Time Signature event: FF 58 04 nn dd cc bb
  const nn = score.timeSignature.beats;
  const dd = Math.round(Math.log2(score.timeSignature.beatType));
  trackEvents.push(0x00, 0xff, 0x58, 0x04, nn, dd, 24, 8);

  // Program change to Acoustic Grand Piano (channel 0, program 0)
  trackEvents.push(0x00, 0xc0, 0x00);

  // Collect notes across all staves and sort by absolute tick timeline
  const allEvents: MidiNoteEvent[] = [];
  for (const staff of score.staves) {
    allEvents.push(...collectStaffMidiEvents(score, staff, ticksPerQuarter));
  }

  allEvents.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return a.order - b.order;
  });

  let lastTick = 0;
  for (const ev of allEvents) {
    const delta = Math.max(0, ev.tick - lastTick);
    trackEvents.push(...writeVariableLength(delta));
    trackEvents.push(ev.type === 'on' ? 0x90 : 0x80, ev.pitch, ev.velocity);
    lastTick = ev.tick;
  }

  // End of Track event: FF 2F 00
  trackEvents.push(0x00, 0xff, 0x2f, 0x00);

  // Construct MIDI file
  const header = [
    0x4d,
    0x54,
    0x68,
    0x64, // 'MThd'
    0x00,
    0x00,
    0x00,
    0x06, // Header length (6 bytes)
    0x00,
    0x00, // Format 0 (single track)
    0x00,
    0x01, // 1 track
    ...write16Bit(ticksPerQuarter),
  ];

  const trackHeader = [
    0x4d,
    0x54,
    0x72,
    0x6b, // 'MTrk'
    ...write32Bit(trackEvents.length),
  ];

  const fileBytes = new Uint8Array([...header, ...trackHeader, ...trackEvents]);
  return new Blob([fileBytes], { type: 'audio/midi' });
}
