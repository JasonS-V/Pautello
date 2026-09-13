import { describe, it, expect } from 'vitest';
import {
  detectPitchFromBuffer,
  frequencyToMidiAndCents,
  centsToStatus,
} from './pitchDetection';

describe('Pitch Detection Engine', () => {
  it('identifies 440 Hz as A4 with 0 cents deviation', () => {
    const result = frequencyToMidiAndCents(440);
    expect(result.midi).toBe(69);
    expect(result.cents).toBe(0);
    expect(result.noteName).toContain('La');
  });

  it('identifies 261.63 Hz as C4 (Do 4)', () => {
    const result = frequencyToMidiAndCents(261.63);
    expect(result.midi).toBe(60);
    expect(result.cents).toBeCloseTo(0, 0);
    expect(result.noteName).toContain('Do');
  });

  it('correctly classifies tuning status based on cents', () => {
    expect(centsToStatus(0)).toBe('in-tune');
    expect(centsToStatus(5)).toBe('in-tune');
    expect(centsToStatus(-6)).toBe('in-tune');
    expect(centsToStatus(15)).toBe('sharp');
    expect(centsToStatus(-20)).toBe('flat');
  });

  it('rejects silent or very quiet buffers', () => {
    const silentBuffer = new Float32Array(2048);
    const result = detectPitchFromBuffer(silentBuffer, 44100);
    expect(result).toBeNull();
  });

  it('detects fundamental frequency from a generated 440 Hz sine wave', () => {
    const sampleRate = 44100;
    const targetFreq = 440; // A4
    const buffer = new Float32Array(2048);

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
    }

    const result = detectPitchFromBuffer(buffer, sampleRate);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.midi).toBe(69); // A4
      expect(Math.abs(result.frequency - 440)).toBeLessThan(3); // Within 3 Hz
      expect(Math.abs(result.cents)).toBeLessThan(12);
      expect(result.clarity).toBeGreaterThan(0.7);
    }
  });

  it('detects fundamental frequency from a generated 330 Hz (E4) sine wave', () => {
    const sampleRate = 44100;
    const targetFreq = 329.63; // E4
    const buffer = new Float32Array(2048);

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
    }

    const result = detectPitchFromBuffer(buffer, sampleRate);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.midi).toBe(64); // E4
      expect(Math.abs(result.frequency - 329.63)).toBeLessThan(3);
    }
  });
});
