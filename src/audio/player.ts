import { Score, ScoreItem } from '../types/music';
import { getItemBeats, pitchToMidi } from '../constants/pitches';
import { audioEngine } from './synth';

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMeasureIndex: number;
  currentItemIndex: number;
  currentBeat: number;
}

export class ScorePlayer {
  private score: Score | null = null;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private isLooping: boolean = false;
  private metronomeEnabled: boolean = false;
  private currentStaffIndex: number = 0;
  private currentMeasureIndex: number = 0;
  private currentItemIndex: number = 0;
  private playbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners: ((state: PlaybackState) => void)[] = [];

  constructor() {}

  public setScore(score: Score) {
    this.score = score;
  }

  public setLoop(loop: boolean) {
    this.isLooping = loop;
  }

  public setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  public subscribe(listener: (state: PlaybackState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const state: PlaybackState = {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentMeasureIndex: this.currentMeasureIndex,
      currentItemIndex: this.currentItemIndex,
      currentBeat: 0,
    };
    this.listeners.forEach(l => l(state));
  }

  public play(startMeasure: number = 0, startItem: number = 0) {
    if (!this.score) return;
    this.isPlaying = true;
    this.isPaused = false;
    this.currentMeasureIndex = startMeasure;
    this.currentItemIndex = startItem;
    this.notify();
    this.scheduleNextItem();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = true;
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    audioEngine.stopAll();
    this.notify();
  }

  public stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentMeasureIndex = 0;
    this.currentItemIndex = -1;
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    audioEngine.stopAll();
    this.notify();
  }

  private scheduleNextItem() {
    if (!this.isPlaying || !this.score) return;

    const staff = this.score.staves[this.currentStaffIndex] || this.score.staves[0];
    if (!staff || !staff.measures[this.currentMeasureIndex]) {
      this.onFinish();
      return;
    }

    const measure = staff.measures[this.currentMeasureIndex];
    if (this.currentItemIndex >= measure.items.length) {
      // Advance to next measure
      this.currentMeasureIndex++;
      this.currentItemIndex = 0;

      if (this.currentMeasureIndex >= staff.measures.length) {
        if (this.isLooping) {
          this.currentMeasureIndex = 0;
          this.currentItemIndex = 0;
        } else {
          this.onFinish();
          return;
        }
      }
    }

    const currentMeasure = staff.measures[this.currentMeasureIndex];
    if (!currentMeasure || currentMeasure.items.length === 0) {
      // Empty measure, advance or delay a full bar
      this.currentMeasureIndex++;
      this.currentItemIndex = 0;
      this.scheduleNextItem();
      return;
    }

    const item: ScoreItem = currentMeasure.items[this.currentItemIndex];
    if (!item) {
      this.currentMeasureIndex++;
      this.currentItemIndex = 0;
      this.scheduleNextItem();
      return;
    }

    // Calculate duration in seconds based on score tempo (BPM)
    const maxMeasureBeats = this.score.timeSignature.beats * (4 / this.score.timeSignature.beatType);
    let beats = getItemBeats(item.duration, item.isDotted);

    // If whole rest represents a full measure of silence in 3/4 or 2/4, cap to measure length
    if (item.type === 'rest' && item.duration === 'w' && beats > maxMeasureBeats) {
      beats = maxMeasureBeats;
    }

    const beatDurationSec = 60 / Math.max(30, Math.min(300, this.score.tempo));
    const itemDurationSec = beats * beatDurationSec;

    // Metronome ticks
    if (this.metronomeEnabled) {
      const isDownbeat = this.currentItemIndex === 0;
      audioEngine.playMetronomeTick(isDownbeat);

      // For notes lasting more than 1 beat (e.g. half or whole notes), schedule intermediate beat ticks
      const fullBeats = Math.floor(beats);
      for (let b = 1; b < fullBeats; b++) {
        setTimeout(() => {
          if (this.isPlaying && this.metronomeEnabled) {
            audioEngine.playMetronomeTick(false);
          }
        }, b * beatDurationSec * 1000);
      }
    }

    // Play note if it is not a rest
    if (item.type === 'note' && item.pitch) {
      const midi = pitchToMidi(item.pitch);
      let velocity = 0.8;
      if (item.articulation === 'accent') velocity = 1.0;
      else if (item.articulation === 'staccato') velocity = 0.85;

      const playDuration = item.articulation === 'staccato' ? itemDurationSec * 0.45 : itemDurationSec * 0.95;
      audioEngine.playMidi(midi, playDuration, velocity);
    }

    this.notify();

    // Advance to next item after duration
    this.playbackTimeout = setTimeout(() => {
      if (!this.isPlaying) return;
      this.currentItemIndex++;
      this.scheduleNextItem();
    }, itemDurationSec * 1000);
  }

  private onFinish() {
    this.stop();
  }
}

export const scorePlayer = new ScorePlayer();
