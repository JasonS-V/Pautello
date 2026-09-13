import { Pitch } from '../types/music';
import { midiToPitch, formatPitchName } from '../constants/pitches';

export interface PitchDetectionResult {
  frequency: number;
  midi: number;
  cents: number; // Deviation from nearest note in cents (-50 to +50)
  noteName: string;
  pitch: Pitch;
  clarity: number; // 0 to 1 confidence
}

/**
 * Converts a frequency in Hz to closest MIDI note and cents deviation
 */
export function frequencyToMidiAndCents(freq: number): {
  midi: number;
  cents: number;
  noteName: string;
} {
  // A4 = 440 Hz = MIDI 69
  const midiFractional = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiFractional);
  const cents = Math.round((midiFractional - midi) * 100);
  const pitch = midiToPitch(midi);
  const noteName = formatPitchName(pitch, 'latin');

  return { midi, cents, noteName };
}

/**
 * Classifies tuning status based on cents deviation
 * Within +/- 8 cents is considered in-tune for amateur & student practice
 */
export function centsToStatus(cents: number): 'in-tune' | 'flat' | 'sharp' {
  if (Math.abs(cents) <= 8) return 'in-tune';
  return cents < 0 ? 'flat' : 'sharp';
}

/**
 * Autocorrelation algorithm with parabolic interpolation
 * Detects fundamental frequency in Hz from audio time-domain buffer
 * Optimally tuned for human voice and acoustic instruments (60 Hz - 1400 Hz)
 */
export function detectPitchFromBuffer(
  buffer: Float32Array,
  sampleRate: number,
  minVolumeRms: number = 0.012
): PitchDetectionResult | null {
  const bufferLength = buffer.length;
  if (bufferLength < 512) return null;

  // 1. Calculate Root Mean Square (RMS) volume
  let sumSquares = 0;
  for (let i = 0; i < bufferLength; i++) {
    const val = buffer[i];
    sumSquares += val * val;
  }
  const rms = Math.sqrt(sumSquares / bufferLength);
  if (rms < minVolumeRms) {
    return null; // Too quiet or silence
  }

  // 2. Frequency bounds: 65 Hz (C2) to 1350 Hz (E6)
  const minPeriod = Math.floor(sampleRate / 1350);
  const maxPeriod = Math.floor(sampleRate / 65);
  const searchMax = Math.min(maxPeriod, Math.floor(bufferLength / 2));

  const correlations = new Float32Array(searchMax + 1);
  let globalMax = -1;

  // 3. Compute normalized autocorrelation
  for (let period = minPeriod; period <= searchMax; period++) {
    let correlation = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < bufferLength - period; i++) {
      const a = buffer[i];
      const b = buffer[i + period];
      correlation += a * b;
      norm1 += a * a;
      norm2 += b * b;
    }

    const denom = Math.sqrt(norm1 * norm2);
    const normalizedCorr = denom > 0 ? correlation / denom : 0;
    correlations[period] = normalizedCorr;

    if (normalizedCorr > globalMax) {
      globalMax = normalizedCorr;
    }
  }

  // Threshold for periodicity confidence
  if (globalMax < 0.55) {
    return null;
  }

  // Pick first local maximum that is at least 85% of globalMax (avoids subharmonic octave doubling)
  const threshold = Math.max(0.55, globalMax * 0.85);
  let bestPeriod = -1;

  for (let period = minPeriod + 1; period < searchMax; period++) {
    const val = correlations[period];
    if (val >= threshold && val >= correlations[period - 1] && val >= correlations[period + 1]) {
      bestPeriod = period;
      break;
    }
  }

  if (bestPeriod <= 0) {
    for (let period = minPeriod; period <= searchMax; period++) {
      if (correlations[period] === globalMax) {
        bestPeriod = period;
        break;
      }
    }
  }

  if (bestPeriod <= 0) return null;

  // 4. Parabolic interpolation around the peak for sub-sample accuracy
  let refinedPeriod = bestPeriod;
  if (bestPeriod > minPeriod && bestPeriod < searchMax) {
    const y1 = correlations[bestPeriod - 1];
    const y2 = correlations[bestPeriod];
    const y3 = correlations[bestPeriod + 1];
    const denom = 2 * (2 * y2 - y1 - y3);
    if (Math.abs(denom) > 1e-6) {
      const delta = (y1 - y3) / denom;
      refinedPeriod = bestPeriod + delta;
    }
  }

  const frequency = sampleRate / refinedPeriod;
  if (frequency < 55 || frequency > 1500) {
    return null;
  }

  const { midi, cents, noteName } = frequencyToMidiAndCents(frequency);
  const pitch = midiToPitch(midi);

  return {
    frequency: Math.round(frequency * 10) / 10,
    midi,
    cents,
    noteName,
    pitch,
    clarity: Math.min(1, Math.max(0, correlations[bestPeriod] || globalMax)),
  };
}
