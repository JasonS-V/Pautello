import { describe, it, expect } from 'vitest';
import { PracticeSession } from './practiceEngine';
import { Score } from '../types/music';

describe('Interactive Practice Engine', () => {
  const mockScore: Score = {
    id: 'test-score',
    title: 'Scale',
    composer: 'Test',
    tempo: 120,
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 'C',
    createdAt: 1000,
    updatedAt: 1000,
    staves: [
      {
        id: 'staff-1',
        name: 'Piano',
        clef: 'treble',
        measures: [
          {
            id: 'm1',
            items: [
              { id: 'n1', type: 'note', duration: 'q', pitch: { step: 'C', octave: 4, accidental: null } }, // MIDI 60
              { id: 'n2', type: 'note', duration: 'q', pitch: { step: 'D', octave: 4, accidental: null } }, // MIDI 62
            ],
          },
          {
            id: 'm2',
            items: [
              { id: 'n3', type: 'note', duration: 'h', pitch: { step: 'E', octave: 4, accidental: null } }, // MIDI 64
            ],
          },
        ],
      },
    ],
  };

  it('initializes with target note pointing to first note C4 (MIDI 60)', () => {
    const session = new PracticeSession(mockScore);
    session.start();

    expect(session.isActive).toBe(true);
    expect(session.totalNotes).toBe(3);
    expect(session.targetNote).not.toBeNull();
    expect(session.targetNote?.midi).toBe(60);
    expect(session.accuracy).toBe(100);
  });

  it('rejects wrong notes, resets streak and keeps target on same note', () => {
    const session = new PracticeSession(mockScore);
    session.start();

    // Try playing wrong note (A4 = 69 instead of C4 = 60)
    const res = session.checkNote(69);
    expect(res.isMatch).toBe(false);
    expect(res.streak).toBe(0);
    expect(res.accuracy).toBe(0);
    expect(res.isCompleted).toBe(false);
    // Target is still C4 (60)
    expect(session.targetNote?.midi).toBe(60);
  });

  it('advances through notes on correct matches and completes the score', () => {
    const session = new PracticeSession(mockScore);
    session.start();

    // 1. Play C4 (60)
    const res1 = session.checkNote(60);
    expect(res1.isMatch).toBe(true);
    expect(res1.streak).toBe(1);
    expect(session.targetNote?.midi).toBe(62); // Next is D4

    // 2. Play D4 (62)
    const res2 = session.checkNote(62);
    expect(res2.isMatch).toBe(true);
    expect(res2.streak).toBe(2);
    expect(session.targetNote?.midi).toBe(64); // Next is E4

    // 3. Play E4 (64)
    const res3 = session.checkNote(64);
    expect(res3.isMatch).toBe(true);
    expect(res3.streak).toBe(3);
    expect(res3.isCompleted).toBe(true);
    expect(session.isCompleted).toBe(true);
    expect(session.accuracy).toBe(100);
  });
});
