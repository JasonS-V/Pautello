import { describe, it, expect } from 'vitest';
import { calculateItemPositions, detectBeamGroups } from './beaming';
import { ScoreItem } from '../types/music';

describe('beaming engraver', () => {
  it('centers a single item in a measure', () => {
    const items: ScoreItem[] = [{ id: '1', type: 'rest', duration: 'w' }];
    const positions = calculateItemPositions(items, 300, { beats: 4, beatType: 4 });
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBe(150);
  });

  it('calculates proportional positions for mixed durations', () => {
    const items: ScoreItem[] = [
      { id: '1', type: 'note', duration: 'h', pitch: { step: 'C', octave: 4, accidental: null } },
      { id: '2', type: 'note', duration: 'q', pitch: { step: 'D', octave: 4, accidental: null } },
      { id: '3', type: 'note', duration: 'q', pitch: { step: 'E', octave: 4, accidental: null } },
    ];
    const positions = calculateItemPositions(items, 400, { beats: 4, beatType: 4 });
    expect(positions).toHaveLength(3);
    expect(positions[0].x).toBeLessThan(positions[1].x);
    expect(positions[1].x).toBeLessThan(positions[2].x);
    // Half note occupies more beat space than the quarter note
    const dist1 = positions[1].x - positions[0].x;
    const dist2 = positions[2].x - positions[1].x;
    expect(dist1).toBeGreaterThan(dist2);
  });

  it('detects beam groups for two consecutive eighth notes in the same beat', () => {
    const items: ScoreItem[] = [
      { id: '1', type: 'note', duration: '8', pitch: { step: 'C', octave: 4, accidental: null } },
      { id: '2', type: 'note', duration: '8', pitch: { step: 'D', octave: 4, accidental: null } },
      { id: '3', type: 'note', duration: 'q', pitch: { step: 'E', octave: 4, accidental: null } },
    ];
    const positions = calculateItemPositions(items, 400, { beats: 4, beatType: 4 });
    const { beamGroups, beamedItemIndices } = detectBeamGroups(items, positions, 'treble', 60, 10, {
      beats: 4,
      beatType: 4,
    });

    expect(beamGroups).toHaveLength(1);
    expect(beamGroups[0].notes).toHaveLength(2);
    expect(beamedItemIndices.has(0)).toBe(true);
    expect(beamedItemIndices.has(1)).toBe(true);
    expect(beamedItemIndices.has(2)).toBe(false); // Quarter note is not beamed
  });

  it('does not beam across rests', () => {
    const items: ScoreItem[] = [
      { id: '1', type: 'note', duration: '8', pitch: { step: 'C', octave: 4, accidental: null } },
      { id: '2', type: 'rest', duration: '8' },
      { id: '3', type: 'note', duration: '8', pitch: { step: 'E', octave: 4, accidental: null } },
    ];
    const positions = calculateItemPositions(items, 400, { beats: 4, beatType: 4 });
    const { beamGroups } = detectBeamGroups(items, positions, 'treble', 60, 10, {
      beats: 4,
      beatType: 4,
    });

    expect(beamGroups).toHaveLength(0);
  });

  it('detects secondary beams for sixteenth notes', () => {
    const items: ScoreItem[] = [
      { id: '1', type: 'note', duration: '16', pitch: { step: 'C', octave: 4, accidental: null } },
      { id: '2', type: 'note', duration: '16', pitch: { step: 'D', octave: 4, accidental: null } },
    ];
    const positions = calculateItemPositions(items, 400, { beats: 4, beatType: 4 });
    const { beamGroups } = detectBeamGroups(items, positions, 'treble', 60, 10, {
      beats: 4,
      beatType: 4,
    });

    expect(beamGroups).toHaveLength(1);
    expect(beamGroups[0].secondaryBeams.length).toBeGreaterThan(0);
  });

  it('beams three eighth notes together in 6/8 compound meter', () => {
    const items: ScoreItem[] = [
      { id: '1', type: 'note', duration: '8', pitch: { step: 'C', octave: 4, accidental: null } },
      { id: '2', type: 'note', duration: '8', pitch: { step: 'D', octave: 4, accidental: null } },
      { id: '3', type: 'note', duration: '8', pitch: { step: 'E', octave: 4, accidental: null } },
    ];
    const positions = calculateItemPositions(items, 400, { beats: 6, beatType: 8 });
    const { beamGroups } = detectBeamGroups(items, positions, 'treble', 60, 10, {
      beats: 6,
      beatType: 8,
    });

    expect(beamGroups).toHaveLength(1);
    expect(beamGroups[0].notes).toHaveLength(3);
  });

  it('sets stem direction down for notes above middle line (B4)', () => {
    const items: ScoreItem[] = [
      { id: '1', type: 'note', duration: '8', pitch: { step: 'C', octave: 5, accidental: null } },
      { id: '2', type: 'note', duration: '8', pitch: { step: 'D', octave: 5, accidental: null } },
    ];
    const positions = calculateItemPositions(items, 400, { beats: 4, beatType: 4 });
    const { beamGroups } = detectBeamGroups(items, positions, 'treble', 60, 10, {
      beats: 4,
      beatType: 4,
    });

    expect(beamGroups).toHaveLength(1);
    // C5 (step 3) and D5 (step 2) are above middle line (step 4), so stemUp is false (stems point down)
    expect(beamGroups[0].stemUp).toBe(false);
  });

  it('correctly handles chords in beam groups', () => {
    const items: ScoreItem[] = [
      {
        id: '1',
        type: 'note',
        duration: '8',
        pitches: [
          { step: 'C', octave: 4, accidental: null },
          { step: 'E', octave: 4, accidental: null },
          { step: 'G', octave: 4, accidental: null },
        ],
      },
      {
        id: '2',
        type: 'note',
        duration: '8',
        pitches: [
          { step: 'D', octave: 4, accidental: null },
          { step: 'F', octave: 4, accidental: null },
          { step: 'A', octave: 4, accidental: null },
        ],
      },
    ];
    const positions = calculateItemPositions(items, 400, { beats: 4, beatType: 4 });
    const { beamGroups } = detectBeamGroups(items, positions, 'treble', 60, 10, {
      beats: 4,
      beatType: 4,
    });
    expect(beamGroups).toHaveLength(1);
    expect(beamGroups[0].notes).toHaveLength(2);
  });
});
