import { Score, Staff, getItemPitches, isPianoGrandStaff } from '../types/music';
import { InstrumentType, resolveStaffInstrument } from './synth';
import { getItemBeats, pitchToFrequency } from '../constants/pitches';
import { getMeasureItemStreamTimings, resolveMeasureCapacity } from '../utils/measureTiming';

function getTiedSecs(
  staff: Staff,
  measureIdx: number,
  itemIdx: number,
  secondsPerBeat: number
): number {
  let totalSec = 0;
  let m = measureIdx;
  let i = itemIdx;
  const currentItem = staff.measures[m]?.items[i];
  if (!currentItem) return 0;
  const targetVoice = currentItem.voice || 1;

  while (m < staff.measures.length) {
    const cur = staff.measures[m]?.items[i];
    if (!cur) break;
    const b = getItemBeats(cur.duration, cur.isDotted, cur.tuplet);
    totalSec += b * secondsPerBeat;

    if (!cur.isTied) break;

    let nextIdx = -1;
    for (let k = i + 1; k < staff.measures[m].items.length; k++) {
      if ((staff.measures[m].items[k].voice || 1) === targetVoice) {
        nextIdx = k;
        break;
      }
    }

    if (nextIdx !== -1) {
      i = nextIdx;
    } else {
      m++;
      if (m >= staff.measures.length) break;
      const nextMeas = staff.measures[m];
      const firstSameVoiceIdx = nextMeas.items.findIndex((it) => (it.voice || 1) === targetVoice);
      if (firstSameVoiceIdx !== -1) {
        i = firstSameVoiceIdx;
      } else {
        break;
      }
    }
  }

  return totalSec;
}

function isTiedFromPrev(staff: Staff, measureIdx: number, itemIdx: number): boolean {
  const currentMeasure = staff.measures[measureIdx];
  if (!currentMeasure) return false;
  const currentItem = currentMeasure.items[itemIdx];
  if (!currentItem) return false;
  const targetVoice = currentItem.voice || 1;

  for (let i = itemIdx - 1; i >= 0; i--) {
    const it = currentMeasure.items[i];
    if ((it.voice || 1) === targetVoice) {
      return !!it.isTied;
    }
  }

  if (measureIdx > 0) {
    const prevMeasure = staff.measures[measureIdx - 1];
    if (prevMeasure && prevMeasure.items.length > 0) {
      for (let i = prevMeasure.items.length - 1; i >= 0; i--) {
        const it = prevMeasure.items[i];
        if ((it.voice || 1) === targetVoice) {
          return !!it.isTied;
        }
      }
    }
  }
  return false;
}

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
  const staff = score.staves[0];
  if (!staff || staff.measures.length === 0 || score.tempo <= 0) return 0;

  const secondsPerBeat = 60 / Math.max(30, Math.min(300, score.tempo));

  let totalBeats = 0;
  for (let mIdx = 0; mIdx < staff.measures.length; mIdx++) {
    const measure = staff.measures[mIdx];
    const measCapacity = resolveMeasureCapacity(score, measure, mIdx);
    totalBeats += measCapacity;
  }

  return totalBeats * secondsPerBeat;
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
  volume: number = 0.8
): Promise<Blob> {
  const sampleRate = 44100;
  const duration = calculateScoreDuration(score);
  const totalDuration = Math.max(1.0, duration + 1.2); // Tail for release/reverb
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  // Check if OfflineAudioContext is available in current environment
  const OfflineCtxClass =
    typeof window !== 'undefined'
      ? window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext
      : null;

  if (!OfflineCtxClass) {
    // Fallback simple silence / dummy buffer if Web Audio not available
    const dummyChannels = [new Float32Array(sampleRate), new Float32Array(sampleRate)];
    const wavBytes = encodeWav(dummyChannels, sampleRate);
    return new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  }

  const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0.1, Math.min(1.0, volume)), 0);
  masterGain.connect(offlineCtx.destination);

  const secondsPerBeat = 60 / Math.max(30, Math.min(300, score.tempo));
  const isGrand = isPianoGrandStaff(score);
  for (const staff of score.staves) {
    const staffInstrument = resolveStaffInstrument(staff, isGrand, instrument);
    let currentMeasureTime = 0.05; // 50ms initial silence for clean attack
    for (let mIdx = 0; mIdx < staff.measures.length; mIdx++) {
      const measure = staff.measures[mIdx];
      const measCapacity = resolveMeasureCapacity(score, measure, mIdx);
      const streamTimings = getMeasureItemStreamTimings(measure.items, measCapacity);

      for (let itemIdx = 0; itemIdx < measure.items.length; itemIdx++) {
        const item = measure.items[itemIdx];
        const timing = streamTimings[itemIdx];
        const startBeat = timing ? timing.startBeat : 0;
        const durBeats = timing
          ? timing.durationBeats
          : getItemBeats(item.duration, item.isDotted, item.tuplet);
        const itemDurationSec = durBeats * secondsPerBeat;
        const noteStartTime = currentMeasureTime + startBeat * secondsPerBeat;

        const isContinuingTie = isTiedFromPrev(staff, mIdx, itemIdx);
        if (item.type === 'note' && !isContinuingTie) {
          const pitches = getItemPitches(item);
          const totalSec = item.isTied
            ? getTiedSecs(staff, mIdx, itemIdx, secondsPerBeat)
            : itemDurationSec;

          const DYNAMIC_WAV_VELOCITIES: Record<string, number> = {
            pp: 0.4,
            p: 0.55,
            mp: 0.7,
            mf: 0.82,
            f: 0.95,
            ff: 1.0,
          };
          let vel = item.dynamic ? DYNAMIC_WAV_VELOCITIES[item.dynamic] || 0.85 : 0.85;
          if (item.articulation === 'accent') vel = Math.min(1.0, vel * 1.25);

          const soundSec =
            item.articulation === 'staccato'
              ? totalSec * 0.45
              : item.articulation === 'tenuto'
                ? totalSec * 1.0
                : item.articulation === 'fermata'
                  ? totalSec * 1.8
                  : totalSec * 0.98;

          pitches.forEach((p) => {
            const freq = pitchToFrequency(p);
            scheduleOfflineNote(
              offlineCtx,
              masterGain,
              freq,
              noteStartTime,
              soundSec,
              staffInstrument,
              vel
            );
          });
        }
      }

      currentMeasureTime += measCapacity * secondsPerBeat;
    }
  }

  // Render the audio graph to an AudioBuffer
  const renderedBuffer = await offlineCtx.startRendering();

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
