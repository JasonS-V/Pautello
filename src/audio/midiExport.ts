import { Score } from '../types/music';
import { getItemBeats, pitchToMidi } from '../constants/pitches';

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
  return [
    (val >> 24) & 0xff,
    (val >> 16) & 0xff,
    (val >> 8) & 0xff,
    val & 0xff,
  ];
}

function write16Bit(val: number): number[] {
  return [(val >> 8) & 0xff, val & 0xff];
}

/**
 * Exports a Score to a standard MIDI format 0 (.mid) binary Blob
 */
export function exportScoreToMidi(score: Score): Blob {
  const ticksPerQuarter = 480;
  const bpm = Math.max(30, Math.min(300, score.tempo || 120));
  const microsecondsPerQuarter = Math.round(60000000 / bpm);

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
  interface MidiNoteEvent {
    tick: number;
    type: 'on' | 'off';
    pitch: number;
    velocity: number;
    order: number;
  }

  const rawEvents: MidiNoteEvent[] = [];
  const beatsPerMeasure = score.timeSignature.beats * (4 / score.timeSignature.beatType);

  for (const staff of score.staves) {
    let measureDownbeatTick = 0;
    for (let mIdx = 0; mIdx < staff.measures.length; mIdx++) {
      const measure = staff.measures[mIdx];
      let itemTick = measureDownbeatTick;

      for (const item of measure.items) {
        const itemBeats = getItemBeats(item.duration, item.isDotted);
        const itemTicks = Math.round(itemBeats * ticksPerQuarter);

        if (item.type === 'note' && item.pitch) {
          const midiPitch = pitchToMidi(item.pitch);
          const velocity = item.articulation === 'accent' ? 120 : 96;
          const noteDurationTicks = item.articulation === 'staccato'
            ? Math.round(itemTicks * 0.5)
            : Math.max(10, itemTicks - 10);

          rawEvents.push({
            tick: itemTick,
            type: 'on',
            pitch: midiPitch,
            velocity,
            order: 1,
          });

          rawEvents.push({
            tick: itemTick + noteDurationTicks,
            type: 'off',
            pitch: midiPitch,
            velocity: 0,
            order: 0,
          });
        }

        itemTick += itemTicks;
      }

      measureDownbeatTick += Math.round(beatsPerMeasure * ticksPerQuarter);
    }
  }

  rawEvents.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return a.order - b.order;
  });

  let lastTick = 0;
  for (const ev of rawEvents) {
    const delta = Math.max(0, ev.tick - lastTick);
    trackEvents.push(...writeVariableLength(delta));
    trackEvents.push(ev.type === 'on' ? 0x90 : 0x80, ev.pitch, ev.velocity);
    lastTick = ev.tick;
  }

  // End of Track event: FF 2F 00
  trackEvents.push(...writeVariableLength(0));
  trackEvents.push(0xff, 0x2f, 0x00);

  // Construct MIDI file
  const header = [
    0x4d, 0x54, 0x68, 0x64, // 'MThd'
    0x00, 0x00, 0x00, 0x06, // Header length (6 bytes)
    0x00, 0x00,             // Format 0 (single track)
    0x00, 0x01,             // 1 track
    ...write16Bit(ticksPerQuarter)
  ];

  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
    ...write32Bit(trackEvents.length)
  ];

  const fileBytes = new Uint8Array([...header, ...trackHeader, ...trackEvents]);
  return new Blob([fileBytes], { type: 'audio/midi' });
}
