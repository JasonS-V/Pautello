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
      staves: [{
        id: 's1',
        name: 'Piano',
        clef: 'treble',
        measures: [{
          id: 'm1',
          items: [
            { id: 'n1', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q' }
          ]
        }]
      }],
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
});
