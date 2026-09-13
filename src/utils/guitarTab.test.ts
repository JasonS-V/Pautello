import { describe, it, expect } from 'vitest';
import { pitchToGuitarTab, getPossibleGuitarPositions } from './guitarTab';

describe('Guitar Tablature Calculations', () => {
  it('correctly maps standard open strings to fret 0', () => {
    // 6th string: Low E (E2)
    const e2 = pitchToGuitarTab({ step: 'E', octave: 2, accidental: null });
    expect(e2).toEqual({ stringNumber: 6, fret: 0 });

    // 5th string: A2
    const a2 = pitchToGuitarTab({ step: 'A', octave: 2, accidental: null });
    expect(a2).toEqual({ stringNumber: 5, fret: 0 });

    // 4th string: D3
    const d3 = pitchToGuitarTab({ step: 'D', octave: 3, accidental: null });
    expect(d3).toEqual({ stringNumber: 4, fret: 0 });

    // 3rd string: G3
    const g3 = pitchToGuitarTab({ step: 'G', octave: 3, accidental: null });
    expect(g3).toEqual({ stringNumber: 3, fret: 0 });

    // 2nd string: B3
    const b3 = pitchToGuitarTab({ step: 'B', octave: 3, accidental: null });
    expect(b3).toEqual({ stringNumber: 2, fret: 0 });

    // 1st string: High E (E4)
    const e4 = pitchToGuitarTab({ step: 'E', octave: 4, accidental: null });
    expect(e4).toEqual({ stringNumber: 1, fret: 0 });
  });

  it('correctly maps standard melody notes to first position', () => {
    // Middle C (C4) should be string 2, fret 1
    const c4 = pitchToGuitarTab({ step: 'C', octave: 4, accidental: null });
    expect(c4).toEqual({ stringNumber: 2, fret: 1 });

    // D4 should be string 2, fret 3
    const d4 = pitchToGuitarTab({ step: 'D', octave: 4, accidental: null });
    expect(d4).toEqual({ stringNumber: 2, fret: 3 });

    // G4 should be string 1, fret 3
    const g4 = pitchToGuitarTab({ step: 'G', octave: 4, accidental: null });
    expect(g4).toEqual({ stringNumber: 1, fret: 3 });

    // F2 should be string 6, fret 1
    const f2 = pitchToGuitarTab({ step: 'F', octave: 2, accidental: null });
    expect(f2).toEqual({ stringNumber: 6, fret: 1 });
  });

  it('computes all possible guitar string positions for a note', () => {
    // E4 is MIDI 64:
    // String 1 (open 64) -> fret 0
    // String 2 (open 59) -> fret 5
    // String 3 (open 55) -> fret 9
    // String 4 (open 50) -> fret 14
    // String 5 (open 45) -> fret 19
    const positions = getPossibleGuitarPositions(64);
    expect(positions).toHaveLength(5);
    expect(positions[0]).toEqual({ stringNumber: 1, fret: 0 });
    expect(positions[1]).toEqual({ stringNumber: 2, fret: 5 });
    expect(positions[2]).toEqual({ stringNumber: 3, fret: 9 });
    expect(positions[3]).toEqual({ stringNumber: 4, fret: 14 });
    expect(positions[4]).toEqual({ stringNumber: 5, fret: 19 });
  });

  it('returns null for pitches below guitar range', () => {
    // C1 (MIDI 24) is below guitar Low E (MIDI 40)
    const subBass = pitchToGuitarTab({ step: 'C', octave: 1, accidental: null });
    expect(subBass).toBeNull();
  });
});
