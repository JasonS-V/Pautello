import { describe, it, expect } from 'vitest';
import { encodeWav, calculateScoreDuration } from './wavExport';
import { Score } from '../types/music';

describe('WAV Audio Export and RIFF Encoding', () => {
  it('generates a valid RIFF WAVE header structure', () => {
    const sampleRate = 44100;
    const numSamples = 100;
    const leftChannel = new Float32Array(numSamples);
    const rightChannel = new Float32Array(numSamples);

    // Populate with test sine wave
    for (let i = 0; i < numSamples; i++) {
      leftChannel[i] = Math.sin((i / numSamples) * Math.PI * 2);
      rightChannel[i] = Math.cos((i / numSamples) * Math.PI * 2);
    }

    const wavBytes = encodeWav([leftChannel, rightChannel], sampleRate);
    const view = new DataView(wavBytes.buffer);

    // 1. 'RIFF' identifier at 0..3
    const riff = String.fromCharCode(wavBytes[0], wavBytes[1], wavBytes[2], wavBytes[3]);
    expect(riff).toBe('RIFF');

    // 2. 'WAVE' format at 8..11
    const wave = String.fromCharCode(wavBytes[8], wavBytes[9], wavBytes[10], wavBytes[11]);
    expect(wave).toBe('WAVE');

    // 3. 'fmt ' chunk at 12..15
    const fmt = String.fromCharCode(wavBytes[12], wavBytes[13], wavBytes[14], wavBytes[15]);
    expect(fmt).toBe('fmt ');

    // 4. PCM format (1), stereo (2), 44100 sample rate, 16 bits per sample
    expect(view.getUint16(20, true)).toBe(1); // AudioFormat = 1 (PCM)
    expect(view.getUint16(22, true)).toBe(2); // NumChannels = 2
    expect(view.getUint32(24, true)).toBe(44100); // SampleRate = 44100
    expect(view.getUint16(34, true)).toBe(16); // BitsPerSample = 16

    // 5. 'data' chunk at 36..39
    const data = String.fromCharCode(wavBytes[36], wavBytes[37], wavBytes[38], wavBytes[39]);
    expect(data).toBe('data');

    // 6. Data length: 100 samples * 2 channels * 2 bytes = 400 bytes
    const dataSize = view.getUint32(40, true);
    expect(dataSize).toBe(400);

    // 7. Total size: 44 bytes header + 400 bytes data = 444 bytes
    expect(wavBytes.length).toBe(444);
  });

  it('calculates score duration accurately based on BPM and time signature', () => {
    const testScore: Score = {
      id: 'test-score',
      title: 'Test',
      composer: 'Tester',
      tempo: 120, // 120 BPM = 0.5s per quarter note beat
      timeSignature: { beats: 4, beatType: 4 }, // 4 beats per bar = 2.0s per bar
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
                { id: 'n1', type: 'note', duration: 'q', pitch: { step: 'C', octave: 4, accidental: null } },
                { id: 'n2', type: 'note', duration: 'q', pitch: { step: 'D', octave: 4, accidental: null } },
                { id: 'n3', type: 'note', duration: 'q', pitch: { step: 'E', octave: 4, accidental: null } },
                { id: 'n4', type: 'note', duration: 'q', pitch: { step: 'F', octave: 4, accidental: null } },
              ],
            },
            {
              id: 'm2',
              items: [
                { id: 'n5', type: 'note', duration: 'w', pitch: { step: 'G', octave: 4, accidental: null } },
              ],
            },
          ],
        },
      ],
    };

    // 2 bars of 4/4 at 120 BPM = 8 beats * 0.5s = 4.0s
    const duration = calculateScoreDuration(testScore);
    expect(duration).toBe(4.0);
  });
});
