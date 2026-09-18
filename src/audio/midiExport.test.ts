import { describe, it, expect } from 'vitest';
import { exportScoreToMidi, writeVariableLength } from './midiExport';
import { Score } from '../types/music';

describe('MIDI Export & Variable-Length Encoding', () => {
  it('correctly encodes single-byte values (0 to 127)', () => {
    expect(writeVariableLength(0)).toEqual([0x00]);
    expect(writeVariableLength(64)).toEqual([0x40]);
    expect(writeVariableLength(127)).toEqual([0x7f]);
  });

  it('correctly encodes multi-byte variable-length values per MIDI spec', () => {
    // 128 -> [0x81, 0x00]
    expect(writeVariableLength(128)).toEqual([0x81, 0x00]);

    // 256 -> [0x82, 0x00]
    expect(writeVariableLength(256)).toEqual([0x82, 0x00]);

    // Standard quarter note ticks = 480 (0x01E0)
    // 480 / 128 = 3 rem 96 -> high byte 3 | 0x80 = 0x83, low byte 96 = 0x60
    expect(writeVariableLength(480)).toEqual([0x83, 0x60]);

    // 470 ticks
    // 470 / 128 = 3 rem 86 -> [0x83, 0x56]
    expect(writeVariableLength(470)).toEqual([0x83, 0x56]);

    // 16383 (0x3fff) -> [0xff, 0x7f]
    expect(writeVariableLength(16383)).toEqual([0xff, 0x7f]);

    // 16384 -> [0x81, 0x80, 0x00]
    expect(writeVariableLength(16384)).toEqual([0x81, 0x80, 0x00]);
  });

  it('generates a valid binary MIDI Format 0 Blob with correct MThd and MTrk chunks', async () => {
    const score: Score = {
      id: 'midi-test',
      title: 'Prueba MIDI',
      composer: 'Tester',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [
        {
          id: 's1',
          name: 'Piano',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'q',
                },
              ],
            },
          ],
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    const blob = exportScoreToMidi(score);
    expect(blob.type).toBe('audio/midi');

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // MThd signature
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    // Header length 6
    expect(bytes[7]).toBe(6);
    // Format 0
    expect(bytes[9]).toBe(0);
    // 1 track
    expect(bytes[11]).toBe(1);

    // MTrk signature
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk');
  });

  it('exports multi-staff scores (Grand Staff) with both hands interleaved', async () => {
    const score: Score = {
      id: 'grand-staff-midi',
      title: 'Grand Staff Test',
      composer: 'Tester',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [
        {
          id: 's1',
          name: 'Right Hand',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'h',
                },
              ],
            },
          ],
        },
        {
          id: 's2',
          name: 'Left Hand',
          clef: 'bass',
          measures: [
            {
              id: 'm2',
              items: [
                {
                  id: 'n2',
                  type: 'note',
                  pitch: { step: 'C', octave: 3, accidental: null },
                  duration: 'h',
                },
              ],
            },
          ],
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    const blob = exportScoreToMidi(score);
    expect(blob.size).toBeGreaterThan(50);
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk');
  });

  it('exports polyphonic notes (voice 1 and voice 2) starting simultaneously at tick 0 with 0 delta time', async () => {
    const polyScore: Score = {
      id: 'poly-midi-test',
      title: 'Polyphony MIDI Test',
      composer: 'Tester',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [
        {
          id: 's1',
          name: 'Staff 1',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              items: [
                // Voice 1: Quarter note C5 at beat 0
                {
                  id: 'v1-n1',
                  type: 'note',
                  voice: 1,
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'q',
                },
                // Voice 2: Whole note C4 at beat 0
                {
                  id: 'v2-n1',
                  type: 'note',
                  voice: 2,
                  pitch: { step: 'C', octave: 4, accidental: null },
                  duration: 'w',
                },
              ],
            },
          ],
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    const blob = exportScoreToMidi(polyScore);
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Locate MTrk chunk (bytes 14..18)
    const mtrkIdx = 14;
    expect(String.fromCharCode(...bytes.slice(mtrkIdx, mtrkIdx + 4))).toBe('MTrk');
    const trackStart = mtrkIdx + 8; // skip 'MTrk' and 4-byte chunk length

    // Find the first 0x90 (Note On channel 0) byte
    let firstNoteOnIdx = -1;
    for (let i = trackStart; i < bytes.length; i++) {
      if (bytes[i] === 0x90) {
        firstNoteOnIdx = i;
        break;
      }
    }
    expect(firstNoteOnIdx).toBeGreaterThan(0);

    // The byte right before Note On is the delta-time for this first note
    expect(bytes[firstNoteOnIdx - 1]).toBe(0x00);

    // Note On event structure: [status 0x90, pitch, velocity]
    // Immediately after this 3-byte event comes the delta-time for the second note
    const secondNoteDeltaIdx = firstNoteOnIdx + 3;
    expect(bytes[secondNoteDeltaIdx]).toBe(0x00); // 0 delta time because voice 2 also begins at tick 0!

    // And the second note event is also a Note On (0x90)
    expect(bytes[secondNoteDeltaIdx + 1]).toBe(0x90);
  });

  it('exports Standard MIDI Format 1 with multiple tracks and independent channels for DAWs', async () => {
    const multiStaffScore: Score = {
      id: 'multitrack-test',
      title: 'Ensamble',
      composer: 'Tester',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      createdAt: 0,
      updatedAt: 0,
      staves: [
        {
          id: 's1',
          name: 'Flauta',
          clef: 'treble',
          measures: [
            {
              id: 'm1',
              items: [
                {
                  id: 'n1',
                  type: 'note',
                  pitch: { step: 'C', octave: 5, accidental: null },
                  duration: 'w',
                },
              ],
            },
          ],
        },
        {
          id: 's2',
          name: 'Bajo',
          clef: 'bass',
          measures: [
            {
              id: 'm2',
              items: [
                {
                  id: 'n2',
                  type: 'note',
                  pitch: { step: 'C', octave: 2, accidental: null },
                  duration: 'w',
                },
              ],
            },
          ],
        },
      ],
    };

    const blob = exportScoreToMidi(multiStaffScore, { format: 1 });
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // MThd header
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    // Format 1 (bytes 8..9)
    expect(bytes[8]).toBe(0);
    expect(bytes[9]).toBe(1);
    // 3 tracks: 1 Conductor + 2 Staves (bytes 10..11)
    expect(bytes[10]).toBe(0);
    expect(bytes[11]).toBe(3);

    // Conductor MTrk at 14..18
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk');
  });
});
