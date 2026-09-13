import { describe, it, expect } from 'vitest';
import { parseMidiToScore } from './midiParser';
import { exportScoreToMidi } from '../audio/midiExport';
import { Score } from '../types/music';

describe('midiParser', () => {
  it('fails gracefully on invalid non-MIDI buffer', () => {
    const invalidBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    expect(() => parseMidiToScore(invalidBuffer)).toThrow(/cabecera MThd ausente/);
  });

  it('successfully parses a round-tripped MIDI file exported by Sonata', async () => {
    const originalScore: Score = {
      id: 'test-score',
      title: 'Canción de Prueba',
      composer: 'Autor',
      tempo: 130,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [{
        id: 'staff-1',
        name: 'Voz',
        clef: 'treble',
        measures: [{
          id: 'm-1',
          items: [
            { id: '1', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q' },
            { id: '2', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q' },
            { id: '3', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q' },
            { id: '4', type: 'note', pitch: { step: 'C', octave: 5, accidental: null }, duration: 'q' },
          ]
        }]
      }],
      createdAt: 0,
      updatedAt: 0,
    };

    const midiBlob = exportScoreToMidi(originalScore);
    const arrayBuffer = await midiBlob.arrayBuffer();

    const parsedScore = parseMidiToScore(arrayBuffer, 'Canción de Prueba.mid');
    expect(parsedScore.title).toBe('Canción de Prueba');
    expect(parsedScore.tempo).toBe(130);
    expect(parsedScore.timeSignature).toEqual({ beats: 4, beatType: 4 });
    expect(parsedScore.staves.length).toBe(1);

    const firstMeasure = parsedScore.staves[0].measures[0];
    expect(firstMeasure.items.length).toBeGreaterThanOrEqual(1);
    expect(firstMeasure.items[0].type).toBe('note');
  });
});
