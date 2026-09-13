import { describe, it, expect } from 'vitest';
import { pitchToMidi, midiToFrequency, pitchToFrequency, getItemBeats, formatPitchName } from './pitches';

describe('Pitches and Musical Math', () => {
  it('correctly maps C4 (middle C) to MIDI 60 and ~261.63 Hz', () => {
    const midi = pitchToMidi({ step: 'C', octave: 4, accidental: null });
    expect(midi).toBe(60);
    const freq = midiToFrequency(midi);
    expect(Math.round(freq * 100) / 100).toBe(261.63);
  });

  it('correctly maps A4 (tuning pitch) to MIDI 69 and exactly 440 Hz', () => {
    const midi = pitchToMidi({ step: 'A', octave: 4, accidental: null });
    expect(midi).toBe(69);
    const freq = midiToFrequency(midi);
    expect(Math.round(freq)).toBe(440);
    expect(Math.round(pitchToFrequency({ step: 'A', octave: 4, accidental: null }))).toBe(440);
  });

  it('correctly handles sharps and flats', () => {
    const cSharp4 = pitchToMidi({ step: 'C', octave: 4, accidental: '#' });
    const dFlat4 = pitchToMidi({ step: 'D', octave: 4, accidental: 'b' });
    expect(cSharp4).toBe(61);
    expect(dFlat4).toBe(61); // Enharmonic equivalence

    const fSharp4 = pitchToMidi({ step: 'F', octave: 4, accidental: '#' });
    expect(fSharp4).toBe(66);
  });

  it('calculates beat durations accurately', () => {
    expect(getItemBeats('w', false)).toBe(4.0);
    expect(getItemBeats('h', false)).toBe(2.0);
    expect(getItemBeats('q', false)).toBe(1.0);
    expect(getItemBeats('8', false)).toBe(0.5);
    expect(getItemBeats('16', false)).toBe(0.25);

    // Dotted notes (1.5x)
    expect(getItemBeats('h', true)).toBe(3.0);
    expect(getItemBeats('q', true)).toBe(1.5);
    expect(getItemBeats('8', true)).toBe(0.75);
  });

  it('formats pitch names in Latin (Do-Re-Mi) and English (C-D-E)', () => {
    expect(formatPitchName({ step: 'C', octave: 4, accidental: null }, 'latin')).toBe('Do4');
    expect(formatPitchName({ step: 'C', octave: 4, accidental: null }, 'english')).toBe('C4');
    expect(formatPitchName({ step: 'F', octave: 4, accidental: '#' }, 'latin')).toBe('Fa♯4');
    expect(formatPitchName({ step: 'B', octave: 3, accidental: 'b' }, 'latin')).toBe('Si♭3');
  });
});
