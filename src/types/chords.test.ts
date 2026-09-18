import { describe, it, expect } from 'vitest';
import { ScoreItem, getItemPitches } from './music';
import { pitchToMidi } from '../constants/pitches';

describe('Chords and Polyphony data structures', () => {
  it('returns empty array for rests', () => {
    const item: ScoreItem = { id: 'r1', type: 'rest', duration: 'q' };
    expect(getItemPitches(item)).toEqual([]);
  });

  it('returns single pitch for legacy or single-note item', () => {
    const item: ScoreItem = {
      id: 'n1',
      type: 'note',
      duration: 'q',
      pitch: { step: 'C', octave: 4, accidental: null },
    };
    const pitches = getItemPitches(item);
    expect(pitches).toHaveLength(1);
    expect(pitches[0].step).toBe('C');
    expect(pitches[0].octave).toBe(4);
  });

  it('returns all pitches for a polyphonic chord item', () => {
    const item: ScoreItem = {
      id: 'c1',
      type: 'note',
      duration: 'h',
      pitches: [
        { step: 'C', octave: 4, accidental: null },
        { step: 'E', octave: 4, accidental: null },
        { step: 'G', octave: 4, accidental: null },
      ],
    };
    const pitches = getItemPitches(item);
    expect(pitches).toHaveLength(3);
    const midis = pitches.map(pitchToMidi);
    expect(midis).toEqual([60, 64, 67]); // C4, E4, G4 major triad
  });

  it('prioritizes pitches array if both pitch and pitches are present', () => {
    const item: ScoreItem = {
      id: 'c2',
      type: 'note',
      duration: 'q',
      pitch: { step: 'C', octave: 4, accidental: null },
      pitches: [
        { step: 'C', octave: 4, accidental: null },
        { step: 'E', octave: 4, accidental: 'b' },
        { step: 'G', octave: 4, accidental: null },
      ],
    };
    const pitches = getItemPitches(item);
    expect(pitches).toHaveLength(3);
    expect(pitchToMidi(pitches[1])).toBe(63); // Eb4 minor third
  });
});
