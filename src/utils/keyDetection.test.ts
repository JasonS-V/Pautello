import { describe, it, expect } from 'vitest';
import { detectKeyFromScore, getSemitoneOffsetBetweenKeys, transposeScoreNotes, transposePitch } from './keyDetection';
import { Score, Pitch } from '../types/music';

describe('keyDetection algorithm', () => {
  it('correctly detects C Major for a C major scale', () => {
    const score: Score = {
      id: 'test-c-major',
      title: 'C Major Scale',
      composer: 'Test',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [{
        id: 'staff-1',
        name: 'Staff',
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

    const result = detectKeyFromScore(score);
    expect(result.key).toBe('C');
    expect(result.isMajor).toBe(true);
    expect(result.confidence).toBeGreaterThan(70);
  });

  it('correctly detects G Major when F# is prominent', () => {
    const score: Score = {
      id: 'test-g-major',
      title: 'G Major Passage',
      composer: 'Test',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C', // initial is C, but notes are G major!
      staves: [{
        id: 'staff-1',
        name: 'Staff',
        clef: 'treble',
        measures: [{
          id: 'm-1',
          items: [
            { id: '1', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'h' },
            { id: '2', type: 'note', pitch: { step: 'B', octave: 4, accidental: null }, duration: 'q' },
            { id: '3', type: 'note', pitch: { step: 'D', octave: 5, accidental: null }, duration: 'q' },
          ]
        }, {
          id: 'm-2',
          items: [
            { id: '4', type: 'note', pitch: { step: 'F', octave: 4, accidental: '#' }, duration: 'q' },
            { id: '5', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'h' },
            { id: '6', type: 'rest', duration: 'q' },
          ]
        }]
      }],
      createdAt: 0,
      updatedAt: 0,
    };

    const result = detectKeyFromScore(score);
    expect(result.key).toBe('G');
    expect(result.isMajor).toBe(true);
  });

  it('correctly calculates semitone distance between keys', () => {
    expect(getSemitoneOffsetBetweenKeys('C', 'G')).toBe(7 - 12); // -5 or 7
    // Difference between C (0) and D (2) is 2
    expect(getSemitoneOffsetBetweenKeys('C', 'D')).toBe(2);
    // Difference between C (0) and F (5) is 5 or -7 -> shortest is 5
    expect(getSemitoneOffsetBetweenKeys('C', 'F')).toBe(5);
  });

  it('transposes pitches correctly', () => {
    const c4: Pitch = { step: 'C', octave: 4, accidental: null };
    const d4 = transposePitch(c4, 2);
    expect(d4).toEqual({ step: 'D', octave: 4, accidental: null });

    const e4 = transposePitch(c4, 4);
    expect(e4).toEqual({ step: 'E', octave: 4, accidental: null });

    const c5 = transposePitch(c4, 12);
    expect(c5).toEqual({ step: 'C', octave: 5, accidental: null });
  });

  it('transposes an entire score and updates key signature', () => {
    const score: Score = {
      id: 'test-trans',
      title: 'Transposable',
      composer: 'Test',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [{
        id: 'staff-1',
        name: 'Staff',
        clef: 'treble',
        measures: [{
          id: 'm-1',
          items: [
            { id: '1', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q' },
          ]
        }]
      }],
      createdAt: 0,
      updatedAt: 0,
    };

    const transposed = transposeScoreNotes(score, 2, 'D');
    expect(transposed.keySignature).toBe('D');
    expect(transposed.staves[0].measures[0].items[0].pitch).toEqual({
      step: 'D',
      octave: 4,
      accidental: null,
    });
  });
});
