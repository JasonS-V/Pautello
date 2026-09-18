import { describe, it, expect } from 'vitest';
import {
  transposeChord,
  transposeNoteName,
  getDiatonicChordsForKey,
  parseChordToMidi,
} from './chordUtils';

describe('chordUtils', () => {
  it('transposes single note names correctly', () => {
    expect(transposeNoteName('C', 7)).toBe('G');
    expect(transposeNoteName('C', 2)).toBe('D');
    expect(transposeNoteName('C', 5)).toBe('F');
    expect(transposeNoteName('G', -7)).toBe('C');
  });

  it('transposes basic chords preserving quality', () => {
    expect(transposeChord('C', 7)).toBe('G');
    expect(transposeChord('Am', 7)).toBe('Em');
    expect(transposeChord('Cmaj7', 2)).toBe('Dmaj7');
    expect(transposeChord('F#m7', -2)).toBe('Em7');
    expect(transposeChord('Dm7b5', 5)).toBe('Gm7b5');
  });

  it('transposes slash chords including bass note', () => {
    expect(transposeChord('C/E', 7)).toBe('G/B');
    expect(transposeChord('G/B', 5)).toBe('C/E');
    expect(transposeChord('Am7/G', 2)).toBe('Bm7/A');
  });

  it('transposes Latin chord names', () => {
    expect(transposeChord('Do', 7)).toBe('Sol');
    expect(transposeChord('Lam', 7)).toBe('Mim');
  });

  it('generates diatonic chords for C Major', () => {
    const chords = getDiatonicChordsForKey('C', 'english');
    expect(chords).toEqual(['C', 'Dm', 'Em', 'F', 'G7', 'Am', 'Bdim']);
  });

  it('generates diatonic chords in Latin naming', () => {
    const chords = getDiatonicChordsForKey('C', 'latin');
    expect(chords).toEqual(['Do', 'Rem', 'Mim', 'Fa', 'Sol7', 'Lam', 'Sidim']);
  });

  describe('parseChordToMidi', () => {
    it('parses major and minor triads', () => {
      // C3 = 48, E3 = 52, G3 = 55
      expect(parseChordToMidi('C', 3)).toEqual([48, 52, 55]);
      // Am in octave 3: A3 = 57, C4 = 60, E4 = 64
      expect(parseChordToMidi('Am', 3)).toEqual([57, 60, 64]);
    });

    it('parses dominant and major 7th chords', () => {
      // G7: G3 = 55, B3 = 59, D4 = 62, F4 = 65
      expect(parseChordToMidi('G7', 3)).toEqual([55, 59, 62, 65]);
      // Cmaj7: C3 = 48, E3 = 52, G3 = 55, B3 = 59
      expect(parseChordToMidi('Cmaj7', 3)).toEqual([48, 52, 55, 59]);
    });

    it('parses half-diminished and diminished chords', () => {
      // Bm7b5 / Bø: B3 = 59, D4 = 62, F4 = 65, A4 = 69
      expect(parseChordToMidi('Bm7b5', 3)).toEqual([59, 62, 65, 69]);
      expect(parseChordToMidi('Bø7', 3)).toEqual([59, 62, 65, 69]);
      // Cdim7: C3 = 48, Eb3 = 51, Gb3 = 54, Bbb3 (A3) = 57
      expect(parseChordToMidi('Cdim7', 3)).toEqual([48, 51, 54, 57]);
    });

    it('parses Latin chord names correctly', () => {
      // Do = C -> [48, 52, 55]
      expect(parseChordToMidi('Do', 3)).toEqual([48, 52, 55]);
      // Sol7 = G7 -> [55, 59, 62, 65]
      expect(parseChordToMidi('Sol7', 3)).toEqual([55, 59, 62, 65]);
      // Lam = Am -> [57, 60, 64]
      expect(parseChordToMidi('Lam', 3)).toEqual([57, 60, 64]);
    });

    it('handles slash chords with lower bass note', () => {
      // C/E: E2 (40) + C3 (48), E3 (52), G3 (55)
      expect(parseChordToMidi('C/E', 3)).toEqual([40, 48, 52, 55]);
    });

    it('returns empty array for invalid inputs', () => {
      expect(parseChordToMidi('')).toEqual([]);
      expect(parseChordToMidi('xyz')).toEqual([]);
    });
  });
});
