import { midiToFrequency } from '../constants/pitches';
import { soundfontManager } from './soundfontLoader';
import { Staff, Score, isPianoGrandStaff } from '../types/music';

export type InstrumentType =
  'piano' | 'melody' | 'bass' | 'harmony' | 'marimba' | 'strings' | 'flute';

/**
 * Deduce de forma inteligente el instrumento adecuado para un pentagrama basándose en:
 * 1. Si es Gran Pentagrama (piano a dos manos)
 * 2. Nombres o palabras clave (melodía, flauta, bajo, contrabajo, armonía, cuerdas, piano, etc.)
 * 3. Clave musical del pentagrama (bass -> bass, alto -> harmony)
 * 4. Instrumento por defecto o configurado en el sintetizador
 */
export function resolveStaffInstrument(
  staff: Staff,
  isGrandStaff?: boolean,
  defaultInstrument?: InstrumentType
): InstrumentType {
  if (isGrandStaff) {
    return 'piano';
  }

  const name = `${staff.name || ''} ${staff.shortName || ''}`.toLowerCase();

  // Piano / Teclado
  if (
    name.includes('piano') ||
    name.includes('pno') ||
    name.includes('teclado') ||
    name.includes('keyboard') ||
    name.includes('mano derecha') ||
    name.includes('mano izquierda')
  ) {
    return 'piano';
  }

  // Bajo / Línea grave
  if (
    name.includes('bajo') ||
    name.includes('bass') ||
    name.includes('contrabajo') ||
    name.includes('cello') ||
    name.includes('violonchelo') ||
    name.includes('tuba') ||
    name.includes('fagot') ||
    name.includes('bassoon')
  ) {
    return 'bass';
  }

  // Armonía / Cuerdas / Acompañamiento
  if (
    name.includes('armonía') ||
    name.includes('armonia') ||
    name.includes('harmony') ||
    name.includes('cuerda') ||
    name.includes('strings') ||
    name.includes('viola') ||
    name.includes('acomp') ||
    name.includes('synth') ||
    name.includes('pad')
  ) {
    return 'harmony';
  }

  // Melodía / Viento / Voz solista
  if (
    name.includes('melodía') ||
    name.includes('melodia') ||
    name.includes('melody') ||
    name.includes('voz') ||
    name.includes('voice') ||
    name.includes('vocal') ||
    name.includes('canto') ||
    name.includes('flauta') ||
    name.includes('flute') ||
    name.includes('violín') ||
    name.includes('violin') ||
    name.includes('trompeta') ||
    name.includes('trumpet') ||
    name.includes('sax') ||
    name.includes('clarinete') ||
    name.includes('clarinet')
  ) {
    return 'melody';
  }

  // Inferencia por clave musical
  if (staff.clef === 'bass') {
    return 'bass';
  }
  if (staff.clef === 'alto') {
    return 'harmony';
  }

  // Fallback a defaultInstrument si se especificó, o 'melody' por ser clave de sol
  return defaultInstrument || 'melody';
}

export interface StaffChannelState {
  volume: number; // 0..1 (default 1)
  pan: number; // -1..1 (default 0)
  mute: boolean; // default false
  solo: boolean; // default false
  instrument?: InstrumentType;
}

interface StaffAudioNodes {
  gainNode: GainNode;
  pannerNode: StereoPannerNode | null;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public instrument: InstrumentType = 'piano';
  public volume: number = 0.8;
  private activeVoices: { stop: () => void }[] = [];
  private staffChannels: Map<number, StaffChannelState> = new Map();
  private staffNodes: Map<number, StaffAudioNodes> = new Map();

  private init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Iniciar precarga del instrumento activo en segundo plano
      soundfontManager.preloadInstrument(this.instrument, this.ctx).catch(() => {});
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getOrCreateStaffNodes(staffIndex: number): StaffAudioNodes | null {
    if (!this.ctx || !this.masterGain) return null;
    let nodes = this.staffNodes.get(staffIndex);
    if (!nodes) {
      const gainNode = this.ctx.createGain();
      let pannerNode: StereoPannerNode | null = null;
      if (typeof this.ctx.createStereoPanner === 'function') {
        pannerNode = this.ctx.createStereoPanner();
        gainNode.connect(pannerNode);
        pannerNode.connect(this.masterGain);
      } else {
        gainNode.connect(this.masterGain);
      }
      nodes = { gainNode, pannerNode };
      this.staffNodes.set(staffIndex, nodes);
    }
    this.updateStaffNodeValues(staffIndex, nodes);
    return nodes;
  }

  private updateStaffNodeValues(staffIndex: number, nodes: StaffAudioNodes) {
    if (!this.ctx) return;
    const ch = this.getStaffChannel(staffIndex);
    const anySolo = Array.from(this.staffChannels.values()).some((c) => c.solo);
    const isMuted = ch.mute || (anySolo && !ch.solo);
    const effectiveGain = isMuted ? 0 : Math.max(0, Math.min(1, ch.volume));

    nodes.gainNode.gain.setValueAtTime(effectiveGain, this.ctx.currentTime);
    if (nodes.pannerNode) {
      nodes.pannerNode.pan.setValueAtTime(Math.max(-1, Math.min(1, ch.pan)), this.ctx.currentTime);
    }
  }

  public setStaffChannel(staffIndex: number, settings: Partial<StaffChannelState>) {
    const current = this.getStaffChannel(staffIndex);
    const updated: StaffChannelState = { ...current, ...settings };
    this.staffChannels.set(staffIndex, updated);

    if (settings.instrument && this.ctx) {
      soundfontManager.preloadInstrument(settings.instrument, this.ctx).catch(() => {});
    }

    this.init();
    for (const [idx, nodes] of this.staffNodes.entries()) {
      this.updateStaffNodeValues(idx, nodes);
    }
  }

  public getStaffChannel(staffIndex: number): StaffChannelState {
    return (
      this.staffChannels.get(staffIndex) || {
        volume: 1,
        pan: 0,
        mute: false,
        solo: false,
      }
    );
  }

  public getStaffChannels(): Record<number, StaffChannelState> {
    const res: Record<number, StaffChannelState> = {};
    for (const [idx, ch] of this.staffChannels.entries()) {
      res[idx] = { ...ch };
    }
    return res;
  }

  public resetStaffChannels() {
    this.staffChannels.clear();
    this.init();
    for (const [idx, nodes] of this.staffNodes.entries()) {
      this.updateStaffNodeValues(idx, nodes);
    }
  }

  public preloadScoreInstruments(score: Score) {
    this.init();
    if (!this.ctx) return;
    const isGrand = isPianoGrandStaff(score);
    const insts = new Set<InstrumentType>();
    for (let sIdx = 0; sIdx < score.staves.length; sIdx++) {
      const staff = score.staves[sIdx];
      const ch = this.getStaffChannel(sIdx);
      insts.add(ch.instrument || resolveStaffInstrument(staff, isGrand, this.instrument));
    }
    for (const inst of insts) {
      soundfontManager.preloadInstrument(inst, this.ctx).catch(() => {});
    }
  }

  public setInstrument(inst: InstrumentType) {
    this.instrument = inst;
    this.init();
    if (this.ctx) {
      soundfontManager.preloadInstrument(inst, this.ctx).catch(() => {});
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getCurrentTime(): number {
    this.init();
    return this.ctx
      ? this.ctx.currentTime
      : typeof performance !== 'undefined'
        ? performance.now() / 1000
        : Date.now() / 1000;
  }

  public playMidi(
    midi: number,
    durationSeconds: number = 0.5,
    velocity: number = 0.8,
    startTime?: number,
    instrument?: InstrumentType,
    staffIndex?: number
  ) {
    this.init();
    let inst = instrument || this.instrument;
    let targetNode: AudioNode = this.masterGain!;

    if (staffIndex !== undefined && this.ctx && this.masterGain) {
      const ch = this.getStaffChannel(staffIndex);
      const anySolo = Array.from(this.staffChannels.values()).some((c) => c.solo);
      if (ch.mute || (anySolo && !ch.solo) || ch.volume <= 0) {
        return;
      }
      if (ch.instrument) {
        inst = ch.instrument;
      }
      const nodes = this.getOrCreateStaffNodes(staffIndex);
      if (nodes) {
        targetNode = nodes.gainNode;
      }
    }

    // 1. Intentar reproducir la muestra acústica real desde el Soundfont
    if (this.ctx && targetNode) {
      const sampleVoice = soundfontManager.playSample(
        this.ctx,
        targetNode,
        inst,
        midi,
        durationSeconds,
        velocity,
        startTime
      );
      if (sampleVoice) {
        this.activeVoices.push(sampleVoice);
        setTimeout(
          () => {
            const idx = this.activeVoices.indexOf(sampleVoice);
            if (idx !== -1) this.activeVoices.splice(idx, 1);
          },
          (durationSeconds + 0.5) * 1000
        );
        return;
      }
    }

    // 2. Si la muestra no está en caché o se está offline, usar síntesis algorítmica enriquecida
    const freq = midiToFrequency(midi);
    this.playFrequency(freq, durationSeconds, velocity, startTime, inst, staffIndex);
  }

  public playFrequency(
    frequency: number,
    durationSeconds: number = 0.5,
    velocity: number = 0.8,
    startTime?: number,
    instrument?: InstrumentType,
    staffIndex?: number
  ) {
    try {
      this.init();
      if (!this.ctx || !this.masterGain) return;

      let inst = instrument || this.instrument;
      let targetNode: AudioNode = this.masterGain;

      if (staffIndex !== undefined) {
        const ch = this.getStaffChannel(staffIndex);
        const anySolo = Array.from(this.staffChannels.values()).some((c) => c.solo);
        if (ch.mute || (anySolo && !ch.solo) || ch.volume <= 0) {
          return;
        }
        if (ch.instrument) {
          inst = ch.instrument;
        }
        const nodes = this.getOrCreateStaffNodes(staffIndex);
        if (nodes) {
          targetNode = nodes.gainNode;
        }
      }

      const now =
        startTime !== undefined ? Math.max(this.ctx.currentTime, startTime) : this.ctx.currentTime;
      const duration = Math.max(0.05, durationSeconds);
      const vel = Math.max(0.1, Math.min(1.0, velocity));

      // Voice gain envelope
      const voiceGain = this.ctx.createGain();
      voiceGain.connect(targetNode);

      // Lowpass filter for warm acoustic character
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(frequency * 6, 12000), now);
      filter.connect(voiceGain);

      // Multi-oscillator additive synthesis for rich organic timbre
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();

      osc1.frequency.setValueAtTime(frequency, now);
      osc2.frequency.setValueAtTime(frequency * 2, now); // 2nd harmonic
      osc3.frequency.setValueAtTime(frequency * 3, now); // 3rd harmonic

      const oscGain1 = this.ctx.createGain();
      const oscGain2 = this.ctx.createGain();
      const oscGain3 = this.ctx.createGain();

      if (inst === 'piano') {
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc3.type = 'sine';
        oscGain1.gain.setValueAtTime(0.7, now);
        oscGain2.gain.setValueAtTime(0.2, now);
        oscGain3.gain.setValueAtTime(0.08, now);

        // Piano envelope: sharp percussive attack, natural exponential decay
        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.exponentialRampToValueAtTime(vel * 0.9, now + 0.008);
        voiceGain.gain.exponentialRampToValueAtTime(vel * 0.4, now + 0.15);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.3);
      } else if (inst === 'bass') {
        // Bajo acústico / eléctrico: fundamental profunda sub-octava con ataque con cuerpo
        osc1.frequency.setValueAtTime(frequency / 2, now);
        osc1.type = 'sine';
        osc2.frequency.setValueAtTime(frequency, now);
        osc2.type = 'triangle';
        osc3.frequency.setValueAtTime(frequency * 2, now);
        osc3.type = 'sine';
        oscGain1.gain.setValueAtTime(0.75, now);
        oscGain2.gain.setValueAtTime(0.35, now);
        oscGain3.gain.setValueAtTime(0.12, now);

        filter.frequency.setValueAtTime(Math.min(frequency * 3.5, 3200), now);
        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.exponentialRampToValueAtTime(vel * 1.0, now + 0.005);
        voiceGain.gain.exponentialRampToValueAtTime(vel * 0.65, now + 0.09);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.2);
      } else if (inst === 'harmony' || inst === 'strings') {
        // Armonía / Cuerdas: ensemble con chorus desfasado (-5 cents / +5 cents)
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc3.type = 'sine';
        osc1.detune.setValueAtTime(-5, now);
        osc2.detune.setValueAtTime(5, now);
        oscGain1.gain.setValueAtTime(0.4, now);
        oscGain2.gain.setValueAtTime(0.4, now);
        oscGain3.gain.setValueAtTime(0.2, now);

        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.linearRampToValueAtTime(vel * 0.85, now + 0.07);
        voiceGain.gain.setValueAtTime(vel * 0.75, now + duration);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.25);
      } else if (inst === 'marimba') {
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc3.type = 'triangle';
        oscGain1.gain.setValueAtTime(0.8, now);
        oscGain2.gain.setValueAtTime(0.3, now);
        oscGain3.gain.setValueAtTime(0.05, now);

        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.exponentialRampToValueAtTime(vel, now + 0.004);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(duration, 0.4));
      } else {
        // Melodía ('melody' o 'flute'): timbre lírico puro y expresivo
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc3.type = 'triangle';
        oscGain1.gain.setValueAtTime(0.82, now);
        oscGain2.gain.setValueAtTime(0.12, now);
        oscGain3.gain.setValueAtTime(0.06, now);

        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.linearRampToValueAtTime(vel * 0.85, now + 0.025);
        voiceGain.gain.setValueAtTime(vel * 0.75, now + duration);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.12);
      }

      osc1.connect(oscGain1);
      osc2.connect(oscGain2);
      osc3.connect(oscGain3);

      oscGain1.connect(filter);
      oscGain2.connect(filter);
      oscGain3.connect(filter);

      const stopTime = now + duration + 0.4;
      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(stopTime);
      osc2.stop(stopTime);
      osc3.stop(stopTime);

      const voice = {
        stop: () => {
          try {
            voiceGain.gain.cancelScheduledValues(this.ctx!.currentTime);
            voiceGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx!.currentTime + 0.05);
            setTimeout(() => {
              osc1.disconnect();
              osc2.disconnect();
              osc3.disconnect();
            }, 60);
          } catch {
            // ignore
          }
        },
      };

      this.activeVoices.push(voice);
      setTimeout(
        () => {
          const idx = this.activeVoices.indexOf(voice);
          if (idx !== -1) this.activeVoices.splice(idx, 1);
        },
        (duration + 0.5) * 1000
      );
    } catch (e) {
      console.warn('AudioEngine error:', e);
    }
  }

  public playMetronomeTick(isDownbeat: boolean, startTime?: number) {
    try {
      this.init();
      if (!this.ctx || !this.masterGain) return;

      const now =
        startTime !== undefined ? Math.max(this.ctx.currentTime, startTime) : this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // High pitch for downbeat (beat 1), mid pitch for other beats
      osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore
    }
  }

  public stopAll() {
    this.activeVoices.forEach((v) => v.stop());
    this.activeVoices = [];
  }
}

export const audioEngine = new AudioEngine();
