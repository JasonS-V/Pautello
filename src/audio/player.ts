import { Score, isPianoGrandStaff } from '../types/music';
import { getMeasureItemStreamTimings, resolveMeasureCapacity } from '../utils/measureTiming';
import { audioEngine, resolveStaffInstrument } from './synth';
import { parseChordToMidi } from '../utils/chordUtils';
import {
  buildPlaybackPlan,
  collectPerformedNotes,
  PerformedNote,
  PlaybackPlan,
} from './playbackPlan';

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMeasureIndex: number;
  currentItemIndex: number;
  currentBeat: number;
}
export type PlaybackListener = (state: PlaybackState) => void;

interface CursorEvent {
  time: number;
  measureIndex: number;
  itemIndex?: number;
  beat?: number;
}

export class ScorePlayer {
  private score: Score | null = null;
  private plan: PlaybackPlan = { visits: [], diagnostics: [], durationSeconds: 0 };
  private notes: PerformedNote[] = [];
  private listeners: PlaybackListener[] = [];
  private state: PlaybackState = {
    isPlaying: false,
    isPaused: false,
    currentMeasureIndex: 0,
    currentItemIndex: -1,
    currentBeat: 0,
  };
  private loop = false;
  private metronome = false;
  private comping = false;
  private compingVolume = 0.65;
  private timer: ReturnType<typeof setInterval> | null = null;
  private origin = 0;
  private nextVisit = 0;
  private nextNote = 0;
  private nextChord = 0;
  private nextTick = 0;
  private loopOffset = 0;
  private cursor: CursorEvent[] = [];
  private startItem = 0;
  private startVisit = 0;
  private pausedVisit: number | null = null;

  getSnapshot(): PlaybackState {
    return this.state;
  }
  getDiagnostics(): string[] {
    return this.plan.diagnostics;
  }
  setScore(score: Score) {
    if (this.state.isPlaying) this.stop();
    this.score = score;
    this.plan = buildPlaybackPlan(score);
    this.notes = collectPerformedNotes(score, this.plan);
    audioEngine.preloadScoreInstruments(score);
  }
  setLoop(value: boolean) {
    this.loop = value;
  }
  setMetronome(value: boolean) {
    this.metronome = value;
  }
  setChordComping(value: boolean, volume = 0.65) {
    this.comping = value;
    this.compingVolume = Math.max(0, Math.min(1, volume));
  }
  isChordCompingEnabled() {
    return this.comping;
  }
  subscribe(listener: PlaybackListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }
  private notify() {
    for (const listener of this.listeners) listener(this.state);
  }

  play(startMeasure = 0, startItem = 0) {
    if (!this.score || this.plan.visits.length === 0) return;
    this.stopTimer();
    const visitIndex =
      this.state.isPaused && this.pausedVisit !== null
        ? this.pausedVisit
        : Math.max(
            0,
            this.plan.visits.findIndex((visit) => visit.measureIndex === startMeasure)
          );
    this.pausedVisit = null;
    this.startVisit = visitIndex;
    this.nextVisit = visitIndex;
    this.nextNote = this.notes.findIndex((note) => note.visitIndex >= visitIndex);
    if (this.nextNote < 0) this.nextNote = this.notes.length;
    this.nextChord = visitIndex;
    this.nextTick = visitIndex;
    this.loopOffset = 0;
    this.startItem = startItem;
    this.cursor = [];
    this.origin = audioEngine.getCurrentTime() + 0.05 - this.plan.visits[visitIndex].startSeconds;
    this.state = {
      isPlaying: true,
      isPaused: false,
      currentMeasureIndex: this.plan.visits[visitIndex].measureIndex,
      currentItemIndex: startItem,
      currentBeat: 0,
    };
    this.notify();
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  pause() {
    if (!this.state.isPlaying) return;
    const elapsed = audioEngine.getCurrentTime() - this.origin - this.loopOffset;
    this.pausedVisit = 0;
    for (let index = 0; index < this.plan.visits.length; index++) {
      if (this.plan.visits[index].startSeconds > elapsed) break;
      this.pausedVisit = index;
    }
    this.stopTimer();
    audioEngine.stopAll();
    this.state = { ...this.state, isPlaying: false, isPaused: true };
    this.notify();
  }
  stop() {
    this.pausedVisit = null;
    this.stopTimer();
    audioEngine.stopAll();
    this.cursor = [];
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentMeasureIndex: 0,
      currentItemIndex: -1,
      currentBeat: 0,
    };
    this.notify();
  }
  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    if (!this.state.isPlaying || !this.score) return;
    const now = audioEngine.getCurrentTime();
    const ahead = now + 0.12;
    const visits = this.plan.visits;
    const end = this.origin + this.loopOffset + this.plan.durationSeconds;
    while (
      this.nextVisit < visits.length &&
      this.origin + this.loopOffset + visits[this.nextVisit].startSeconds < ahead
    ) {
      const visit = visits[this.nextVisit];
      const staff = this.score.staves[0];
      const written = staff?.measures[visit.measureIndex];
      const measure =
        written?.isMeasureRepeat && visit.measureIndex > 0
          ? staff.measures[visit.measureIndex - 1]
          : written;
      const start = this.origin + this.loopOffset + visit.startSeconds;
      this.cursor.push({
        time: start,
        measureIndex: visit.measureIndex,
        itemIndex: -1,
        beat: 0,
      });
      if (measure) {
        const capacity = resolveMeasureCapacity(this.score, measure, visit.measureIndex);
        for (const { item, itemIndex, startBeat } of getMeasureItemStreamTimings(
          measure.items,
          capacity
        )) {
          if ((item.voice ?? 1) !== 1) continue;
          if (
            this.loopOffset === 0 &&
            this.nextVisit === this.startVisit &&
            itemIndex < this.startItem
          )
            continue;
          this.cursor.push({
            time: start + (startBeat * 60) / visit.tempo,
            measureIndex: visit.measureIndex,
            itemIndex,
          });
        }
      }
      for (let beat = 1; beat < Math.ceil(visit.durationBeats); beat++)
        this.cursor.push({
          time: start + (beat * 60) / visit.tempo,
          measureIndex: visit.measureIndex,
          beat,
        });
      this.nextVisit++;
    }
    while (
      this.nextNote < this.notes.length &&
      this.origin + this.loopOffset + this.notes[this.nextNote].startSeconds < ahead
    ) {
      const note = this.notes[this.nextNote++];
      if (
        this.loopOffset === 0 &&
        note.visitIndex === this.startVisit &&
        note.staffIndex === 0 &&
        note.itemIndex < this.startItem
      )
        continue;
      const item = note.item;
      const total = note.endSeconds - note.startSeconds;
      const factor =
        item.articulation === 'staccato'
          ? 0.45
          : item.articulation === 'fermata'
            ? 1.8
            : item.articulation === 'tenuto'
              ? 1
              : 0.96;
      const velocities: Record<string, number> = {
        ppp: 0.25,
        pp: 0.4,
        p: 0.55,
        mp: 0.7,
        mf: 0.82,
        f: 0.95,
        ff: 1,
        fff: 1,
      };
      let velocity = item.dynamic ? (velocities[item.dynamic] ?? 0.8) : 0.8;
      if (item.articulation === 'accent') velocity = Math.min(1, velocity * 1.25);
      const staff = this.score.staves[note.staffIndex];
      audioEngine.playMidi(
        note.pitch,
        total * factor,
        velocity,
        this.origin + this.loopOffset + note.startSeconds,
        resolveStaffInstrument(staff, isPianoGrandStaff(this.score), audioEngine.instrument),
        note.staffIndex
      );
    }
    if (this.comping) this.scheduleChords(ahead);
    if (this.metronome) this.scheduleMetronome(ahead);
    this.cursor.sort((a, b) => a.time - b.time);
    while (this.cursor.length && this.cursor[0].time <= now) {
      const event = this.cursor.shift()!;
      this.state = {
        ...this.state,
        currentMeasureIndex: event.measureIndex,
        currentItemIndex: event.itemIndex ?? this.state.currentItemIndex,
        currentBeat: event.beat ?? this.state.currentBeat,
      };
      this.notify();
    }
    if (this.nextVisit === visits.length && this.nextNote === this.notes.length && now >= end) {
      if (this.loop && this.plan.durationSeconds > 0) {
        this.loopOffset += this.plan.durationSeconds;
        this.nextVisit = this.nextChord = this.nextTick = this.nextNote = 0;
      } else if (this.cursor.length === 0) {
        this.stopTimer();
        this.state = {
          isPlaying: false,
          isPaused: false,
          currentMeasureIndex: 0,
          currentItemIndex: -1,
          currentBeat: 0,
        };
        this.notify();
      }
    }
  }

  private scheduleMetronome(ahead: number) {
    while (this.nextTick < this.plan.visits.length) {
      const visit = this.plan.visits[this.nextTick];
      const start = this.origin + this.loopOffset + visit.startSeconds;
      if (start >= ahead) break;
      for (let beat = 0; beat < Math.ceil(visit.durationBeats); beat++) {
        const time = start + (beat * 60) / visit.tempo;
        if (time >= audioEngine.getCurrentTime()) audioEngine.playMetronomeTick(beat === 0, time);
      }
      this.nextTick++;
    }
  }

  private scheduleChords(ahead: number) {
    if (!this.score) return;
    while (this.nextChord < this.plan.visits.length) {
      const visit = this.plan.visits[this.nextChord];
      const start = this.origin + this.loopOffset + visit.startSeconds;
      if (start >= ahead) break;
      const measure = this.score.staves[0]?.measures[visit.measureIndex];
      if (measure) {
        const timings = getMeasureItemStreamTimings(
          measure.items,
          resolveMeasureCapacity(this.score, measure, visit.measureIndex)
        );
        timings.forEach(({ item, startBeat, durationBeats }) => {
          if (!item.chord) return;
          const time = start + (startBeat * 60) / visit.tempo;
          parseChordToMidi(item.chord).forEach((midi) =>
            audioEngine.playMidi(
              midi,
              ((durationBeats * 60) / visit.tempo) * 0.96,
              this.compingVolume,
              time,
              'piano',
              0
            )
          );
        });
      }
      this.nextChord++;
    }
  }
}

export const scorePlayer = new ScorePlayer();
