import { describe, it, expect } from 'vitest';
import { pitchToStaffStep, staffStepToPitch, getLedgerLines } from './engraverMath';
import { Pitch } from '../types/music';

describe('Engraver Math & Positioning', () => {
  it('maps Treble Clef pitches to staff steps accurately', () => {
    // Top line F5 -> step 0
    const f5: Pitch = { step: 'F', octave: 5, accidental: null };
    expect(pitchToStaffStep(f5, 'treble')).toBe(0);

    // Middle line B4 -> step 4
    const b4: Pitch = { step: 'B', octave: 4, accidental: null };
    expect(pitchToStaffStep(b4, 'treble')).toBe(4);

    // Bottom line E4 -> step 8
    const e4: Pitch = { step: 'E', octave: 4, accidental: null };
    expect(pitchToStaffStep(e4, 'treble')).toBe(8);

    // Middle C (C4) -> step 10 (one ledger line below)
    const c4: Pitch = { step: 'C', octave: 4, accidental: null };
    expect(pitchToStaffStep(c4, 'treble')).toBe(10);

    // High A5 -> step -2 (one ledger line above)
    const a5: Pitch = { step: 'A', octave: 5, accidental: null };
    expect(pitchToStaffStep(a5, 'treble')).toBe(-2);
  });

  it('inverts staff step back to exact pitch in Treble Clef', () => {
    const pitch = staffStepToPitch(10, 'treble', null);
    expect(pitch.step).toBe('C');
    expect(pitch.octave).toBe(4);

    const pitchTop = staffStepToPitch(0, 'treble', null);
    expect(pitchTop.step).toBe('F');
    expect(pitchTop.octave).toBe(5);
  });

  it('maps Bass Clef pitches correctly', () => {
    // Top line A3 -> step 0
    const a3: Pitch = { step: 'A', octave: 3, accidental: null };
    expect(pitchToStaffStep(a3, 'bass')).toBe(0);

    // Middle line D3 -> step 4
    const d3: Pitch = { step: 'D', octave: 3, accidental: null };
    expect(pitchToStaffStep(d3, 'bass')).toBe(4);

    // Bottom line G2 -> step 8
    const g2: Pitch = { step: 'G', octave: 2, accidental: null };
    expect(pitchToStaffStep(g2, 'bass')).toBe(8);

    // Middle C (C4) in Bass clef is one ledger line above top line -> step -2
    const c4: Pitch = { step: 'C', octave: 4, accidental: null };
    expect(pitchToStaffStep(c4, 'bass')).toBe(-2);
  });

  it('calculates ledger lines correctly according to standard musical engraving', () => {
    // D4 (step 9) sits on the space directly below the staff: NO ledger line
    expect(getLedgerLines(9)).toEqual([]);

    // Middle C in Treble (step 10) needs 1 ledger line at 10
    expect(getLedgerLines(10)).toEqual([10]);

    // B3 (step 11) sits in space below middle C: needs ledger line through C4 (10)
    expect(getLedgerLines(11)).toEqual([10]);

    // A3 (step 12) needs ledger lines at 10 and 12
    expect(getLedgerLines(12)).toEqual([10, 12]);

    // G5 (step -1) sits on the space directly above the staff: NO ledger line
    expect(getLedgerLines(-1)).toEqual([]);

    // High A5 (step -2) needs ledger line at -2
    expect(getLedgerLines(-2)).toEqual([-2]);

    // High B5 (step -3) needs ledger line through A5 at -2
    expect(getLedgerLines(-3)).toEqual([-2]);

    // Regular note inside staff (e.g. B4 = step 4) has no ledger lines
    expect(getLedgerLines(4)).toEqual([]);
  });
});
