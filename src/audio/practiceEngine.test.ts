import { describe, it, expect } from 'vitest';
import { OnsetDetector, PracticeSession } from './practiceEngine';
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
              {
                id: 'n1',
                type: 'note',
                duration: 'q',
                pitch: { step: 'C', octave: 4, accidental: null },
              }, // MIDI 60
              {
                id: 'n2',
                type: 'note',
                duration: 'q',
                pitch: { step: 'D', octave: 4, accidental: null },
              }, // MIDI 62
            ],
          },
          {
            id: 'm2',
            items: [
              {
                id: 'n3',
                type: 'note',
                duration: 'h',
                pitch: { step: 'E', octave: 4, accidental: null },
              }, // MIDI 64
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

describe('OnsetDetector: contar ataques y no fotogramas', () => {
  it('cuenta una nota sostenida una sola vez', () => {
    const detector = new OnsetDetector();

    expect(detector.update(60, 0)).toBe(true);
    expect(detector.update(60, 16)).toBe(false);
    expect(detector.update(60, 320)).toBe(false);
    expect(detector.update(60, 2000)).toBe(false);
  });

  it('cuenta un cambio de altura mientras la nota sigue sonando', () => {
    const detector = new OnsetDetector();
    detector.update(60, 0);

    expect(detector.update(62, 50)).toBe(true);
    expect(detector.update(62, 100)).toBe(false);
  });

  it('vuelve a contar la misma nota tras un silencio real', () => {
    const detector = new OnsetDetector(120);
    detector.update(60, 0);

    expect(detector.update(null, 200)).toBe(false);
    expect(detector.update(60, 340)).toBe(true);
  });

  it('no cuenta de nuevo si el silencio es un hueco del análisis', () => {
    const detector = new OnsetDetector(120);
    detector.update(60, 0);

    // 80 ms de silencio: es un hipo del analizador, la nota seguía sonando.
    expect(detector.update(null, 100)).toBe(false);
    expect(detector.update(60, 180)).toBe(false);
  });

  it('no dispara nada mientras no haya nota', () => {
    const detector = new OnsetDetector();

    expect(detector.update(null, 0)).toBe(false);
    expect(detector.update(null, 5000)).toBe(false);
  });

  it('cuenta un ataque tras un silencio corto si la altura cambió', () => {
    const detector = new OnsetDetector(120);
    detector.update(60, 0);
    detector.update(null, 100);

    expect(detector.update(64, 150)).toBe(true);
  });

  it('reinicia el estado para que la próxima nota vuelva a contar', () => {
    const detector = new OnsetDetector();
    detector.update(60, 0);

    detector.reset();

    expect(detector.update(60, 10)).toBe(true);
  });
});
