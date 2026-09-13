import { midiToFrequency } from '../constants/pitches';

export type InstrumentType = 'piano' | 'marimba' | 'strings' | 'flute';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: { stop: () => void }[] = [];
  public instrument: InstrumentType = 'piano';
  public volume: number = 0.7;

  private init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public playMidi(midi: number, durationSeconds: number = 0.5, velocity: number = 0.8) {
    const freq = midiToFrequency(midi);
    this.playFrequency(freq, durationSeconds, velocity);
  }

  public playFrequency(frequency: number, durationSeconds: number = 0.5, velocity: number = 0.8) {
    try {
      this.init();
      if (!this.ctx || !this.masterGain) return;

      const now = this.ctx.currentTime;
      const duration = Math.max(0.1, durationSeconds);
      const vel = Math.max(0.1, Math.min(1.0, velocity));

      // Voice gain envelope
      const voiceGain = this.ctx.createGain();
      voiceGain.connect(this.masterGain);

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

      if (this.instrument === 'piano') {
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
      } else if (this.instrument === 'marimba') {
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc3.type = 'triangle';
        oscGain1.gain.setValueAtTime(0.8, now);
        oscGain2.gain.setValueAtTime(0.3, now);
        oscGain3.gain.setValueAtTime(0.05, now);

        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.exponentialRampToValueAtTime(vel, now + 0.004);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(duration, 0.4));
      } else if (this.instrument === 'strings') {
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc3.type = 'sine';
        osc1.detune.setValueAtTime(-4, now);
        osc2.detune.setValueAtTime(4, now);
        oscGain1.gain.setValueAtTime(0.4, now);
        oscGain2.gain.setValueAtTime(0.4, now);
        oscGain3.gain.setValueAtTime(0.2, now);

        // Strings envelope: slow swell attack, full sustain
        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.linearRampToValueAtTime(vel * 0.8, now + 0.06);
        voiceGain.gain.setValueAtTime(vel * 0.7, now + duration);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.2);
      } else {
        // Flute / Clean sine
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc3.type = 'triangle';
        oscGain1.gain.setValueAtTime(0.8, now);
        oscGain2.gain.setValueAtTime(0.1, now);
        oscGain3.gain.setValueAtTime(0.05, now);

        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.linearRampToValueAtTime(vel * 0.8, now + 0.03);
        voiceGain.gain.setValueAtTime(vel * 0.7, now + duration);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.1);
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
        }
      };

      this.activeVoices.push(voice);
      setTimeout(() => {
        const idx = this.activeVoices.indexOf(voice);
        if (idx !== -1) this.activeVoices.splice(idx, 1);
      }, (duration + 0.5) * 1000);

    } catch (e) {
      console.warn('AudioEngine error:', e);
    }
  }

  public playMetronomeTick(isDownbeat: boolean) {
    try {
      this.init();
      if (!this.ctx || !this.masterGain) return;

      const now = this.ctx.currentTime;
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
    this.activeVoices.forEach(v => v.stop());
    this.activeVoices = [];
  }
}

export const audioEngine = new AudioEngine();
