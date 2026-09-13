import { describe, it, expect } from 'vitest';
import { transposeChord, transposeNoteName, getDiatonicChordsForKey } from './chordUtils';

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
});
