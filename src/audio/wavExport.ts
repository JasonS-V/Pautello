import { Score, isPianoGrandStaff } from '../types/music';
import { InstrumentType, resolveStaffInstrument } from './synth';
import { midiToFrequency } from '../constants/pitches';
import { buildPlaybackPlan, collectPerformedNotes } from './playbackPlan';

/**
 * Encodes audio channel data (Float32Array) to a 16-bit PCM RIFF WAVE Uint8Array
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channels.length;
  const numSamples = channels[0]?.length || 0;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write 16-bit PCM samples interleaved
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Clamp between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Calculates total duration in seconds for a score given its tempo and meter
 */
export function calculateScoreDuration(score: Score): number {
  return buildPlaybackPlan(score).durationSeconds;
}

/**
 * Synthesizes a note inside an OfflineAudioContext matching the synthesizer timbres
 */
function scheduleOfflineNote(
  ctx: OfflineAudioContext,
  destination: AudioNode,
  frequency: number,
  startTime: number,
  durationSeconds: number,
  instrument: InstrumentType,
  velocity: number = 0.85
) {
  const duration = Math.max(0.1, durationSeconds);
  const vel = Math.max(0.1, Math.min(1.0, velocity));

  const voiceGain = ctx.createGain();
  voiceGain.connect(destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(frequency * 6, 12000), startTime);
  filter.connect(voiceGain);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();

  osc1.frequency.setValueAtTime(frequency, startTime);
  osc2.frequency.setValueAtTime(frequency * 2, startTime);
  osc3.frequency.setValueAtTime(frequency * 3, startTime);

  const oscGain1 = ctx.createGain();
  const oscGain2 = ctx.createGain();
  const oscGain3 = ctx.createGain();

  if (instrument === 'piano') {
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc3.type = 'sine';
    oscGain1.gain.setValueAtTime(0.7, startTime);
    oscGain2.gain.setValueAtTime(0.2, startTime);
    oscGain3.gain.setValueAtTime(0.08, startTime);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.exponentialRampToValueAtTime(vel * 0.9, startTime + 0.008);
    voiceGain.gain.exponentialRampToValueAtTime(vel * 0.4, startTime + 0.15);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.3);
  } else if (instrument === 'bass') {
    osc1.frequency.setValueAtTime(frequency / 2, startTime);
    osc1.type = 'sine';
    osc2.frequency.setValueAtTime(frequency, startTime);
    osc2.type = 'triangle';
    osc3.frequency.setValueAtTime(frequency * 2, startTime);
    osc3.type = 'sine';
    oscGain1.gain.setValueAtTime(0.75, startTime);
    oscGain2.gain.setValueAtTime(0.35, startTime);
    oscGain3.gain.setValueAtTime(0.12, startTime);

    filter.frequency.setValueAtTime(Math.min(frequency * 3.5, 3200), startTime);
    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.exponentialRampToValueAtTime(vel * 1.0, startTime + 0.005);
    voiceGain.gain.exponentialRampToValueAtTime(vel * 0.65, startTime + 0.09);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.2);
  } else if (instrument === 'harmony' || instrument === 'strings') {
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc3.type = 'sine';
    osc1.detune.setValueAtTime(-5, startTime);
    osc2.detune.setValueAtTime(5, startTime);
    oscGain1.gain.setValueAtTime(0.4, startTime);
    oscGain2.gain.setValueAtTime(0.4, startTime);
    oscGain3.gain.setValueAtTime(0.2, startTime);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(vel * 0.85, startTime + 0.07);
    voiceGain.gain.setValueAtTime(vel * 0.75, startTime + duration);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.25);
  } else if (instrument === 'marimba') {
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'triangle';
    oscGain1.gain.setValueAtTime(0.8, startTime);
    oscGain2.gain.setValueAtTime(0.3, startTime);
    oscGain3.gain.setValueAtTime(0.05, startTime);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.exponentialRampToValueAtTime(vel, startTime + 0.004);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(duration, 0.4));
  } else {
    // Melodía / Flute
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'triangle';
    oscGain1.gain.setValueAtTime(0.82, startTime);
    oscGain2.gain.setValueAtTime(0.12, startTime);
    oscGain3.gain.setValueAtTime(0.06, startTime);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(vel * 0.85, startTime + 0.025);
    voiceGain.gain.setValueAtTime(vel * 0.75, startTime + duration);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.12);
  }

  osc1.connect(oscGain1);
  osc2.connect(oscGain2);
  osc3.connect(oscGain3);

  oscGain1.connect(filter);
  oscGain2.connect(filter);
  oscGain3.connect(filter);

  const stopTime = startTime + duration + 0.4;
  osc1.start(startTime);
  osc2.start(startTime);
  osc3.start(startTime);

  osc1.stop(stopTime);
  osc2.stop(stopTime);
  osc3.stop(stopTime);
}

/**
 * Renders an entire Score into a downloadable WAV Blob using OfflineAudioContext
 */
export async function renderScoreToWav(
  score: Score,
  instrument: InstrumentType = 'piano',
  volume: number = 0.8,
  signal?: AbortSignal
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException('Exportación cancelada', 'AbortError');
  const sampleRate = 44100;
  const plan = buildPlaybackPlan(score);
  if (plan.diagnostics.length) throw new Error(plan.diagnostics.join('; '));
  const notes = collectPerformedNotes(score, plan);
  const soundEnd = notes.reduce((latest, note) => {
    const factor =
      note.item.articulation === 'staccato'
        ? 0.45
        : note.item.articulation === 'fermata'
          ? 1.8
          : note.item.articulation === 'tenuto'
            ? 1
            : 0.96;
    return Math.max(
      latest,
      note.startSeconds + (note.endSeconds - note.startSeconds) * factor + 0.5
    );
  }, 0);
  const totalDuration = Math.max(1.0, plan.durationSeconds + 0.2, soundEnd + 0.05);
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  // Offline float channels and the encoded stereo PCM buffer coexist during export.
  if (totalSamples * (2 * 4 + 2 * 2) > 256 * 1024 * 1024) {
    throw new Error('El WAV excede el presupuesto de memoria de 256 MiB');
  }

  // Check if OfflineAudioContext is available in current environment
  const OfflineCtxClass =
    typeof window !== 'undefined'
      ? window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext
      : null;

  if (!OfflineCtxClass) {
    throw new Error('La exportación WAV requiere OfflineAudioContext');
  }

  if (signal?.aborted) throw new DOMException('Exportación cancelada', 'AbortError');
  const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0.1, Math.min(1.0, volume)), 0);
  masterGain.connect(offlineCtx.destination);

  const isGrand = isPianoGrandStaff(score);
  for (const note of notes) {
    if (signal?.aborted) throw new DOMException('Exportación cancelada', 'AbortError');
    const staffInstrument = resolveStaffInstrument(
      score.staves[note.staffIndex],
      isGrand,
      instrument
    );
    const item = note.item;
    const totalSec = note.endSeconds - note.startSeconds;
    const dynamicVelocities: Record<string, number> = {
      pp: 0.4,
      p: 0.55,
      mp: 0.7,
      mf: 0.82,
      f: 0.95,
      ff: 1,
    };
    let vel = item.dynamic ? dynamicVelocities[item.dynamic] || 0.85 : 0.85;
    if (item.articulation === 'accent') vel = Math.min(1, vel * 1.25);
    const factor =
      item.articulation === 'staccato'
        ? 0.45
        : item.articulation === 'fermata'
          ? 1.8
          : item.articulation === 'tenuto'
            ? 1
            : 0.96;
    scheduleOfflineNote(
      offlineCtx,
      masterGain,
      midiToFrequency(note.pitch),
      note.startSeconds + 0.05,
      totalSec * factor,
      staffInstrument,
      vel
    );
  }

  // Render the audio graph to an AudioBuffer
  const renderedBuffer = await offlineCtx.startRendering();
  if (signal?.aborted) throw new DOMException('Exportación cancelada', 'AbortError');

  // Extract left and right channels
  const left = renderedBuffer.getChannelData(0);
  const right = renderedBuffer.numberOfChannels > 1 ? renderedBuffer.getChannelData(1) : left;

  const wavData = encodeWav([left, right], sampleRate);
  return new Blob([wavData.buffer as ArrayBuffer], { type: 'audio/wav' });
}

/**
 * Triggers a direct browser file download for a Blob
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
