import { Score, Staff, getItemPitches, isPianoGrandStaff } from '../types/music';
import { getItemBeats, pitchToMidi } from '../constants/pitches';
import {
  MeasureTiming,
  getMeasureTimings,
  resolveMeasureCapacity,
  getMeasureItemStreamTimings,
} from '../utils/measureTiming';
import { audioEngine, resolveStaffInstrument } from './synth';
import { parseChordToMidi } from '../utils/chordUtils';

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMeasureIndex: number;
  currentItemIndex: number;
  currentBeat: number;
}

export type PlaybackListener = (state: PlaybackState) => void;

interface ScheduledVisualEvent {
  audioTime: number;
  measureIndex: number;
  itemIndex: number;
}

function getTiedSoundingDuration(
  staff: Staff,
  measureIdx: number,
  itemIdx: number,
  beatDurationSec: number
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
    totalSec += b * beatDurationSec;

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

function isTiedFromPrevious(staff: Staff, measureIdx: number, itemIdx: number): boolean {
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

export class ScorePlayer {
  private score: Score | null = null;
  // Cambios locales de métrica/tempo ya resueltos, cacheados por partitura.
  private measureTimings: MeasureTiming[] = [];
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private isLooping: boolean = false;
  private metronomeEnabled: boolean = false;
  private chordCompingEnabled: boolean = false;
  private chordCompingVolume: number = 0.65;

  // Visual playback cursor state
  private visualMeasureIndex: number = 0;
  private visualItemIndex: number = 0;

  // Audio lookahead scheduler state
  private schedulerAudioMeasureIndex: number = 0;
  private schedulerAudioItemIndex: number = 0;
  private nextNoteTime: number = 0;
  private measureStartTime: number = 0;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private cursorTimer: ReturnType<typeof setInterval> | null = null;
  private scheduledEvents: ScheduledVisualEvent[] = [];
  private repeatCounts: Record<number, number> = {};
  private hasExecutedDaCapo: boolean = false;
  private hasExecutedDalSegno: boolean = false;
  private listeners: ((state: PlaybackState) => void)[] = [];

  // Lookahead settings (120ms buffer, 25ms tick interval)
  private readonly scheduleAheadTime: number = 0.12;
  private readonly schedulerIntervalMs: number = 25;

  constructor() {}

  public setScore(score: Score) {
    this.score = score;
    this.measureTimings = getMeasureTimings(score);
    this.repeatCounts = {};
    this.hasExecutedDaCapo = false;
    this.hasExecutedDalSegno = false;
    audioEngine.preloadScoreInstruments(score);
  }

  public setLoop(loop: boolean) {
    this.isLooping = loop;
  }

  public setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  public setChordComping(enabled: boolean, volume: number = 0.65) {
    this.chordCompingEnabled = enabled;
    this.chordCompingVolume = Math.max(0, Math.min(1, volume));
  }

  public isChordCompingEnabled(): boolean {
    return this.chordCompingEnabled;
  }

  public subscribe(listener: (state: PlaybackState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const state: PlaybackState = {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentMeasureIndex: this.visualMeasureIndex,
      currentItemIndex: this.visualItemIndex,
      currentBeat: 0,
    };
    this.listeners.forEach((l) => l(state));
  }

  public play(startMeasure = 0, startItem = 0) {
    if (!this.score) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.visualMeasureIndex = startMeasure;
    this.visualItemIndex = startItem;
    this.schedulerAudioMeasureIndex = startMeasure;
    this.schedulerAudioItemIndex = startItem;
    this.scheduledEvents = [];

    if (startMeasure === 0 && startItem === 0) {
      this.repeatCounts = {};
      this.hasExecutedDaCapo = false;
      this.hasExecutedDalSegno = false;
    }

    // Initialize audio clock with small 50ms buffer
    const now = audioEngine.getCurrentTime();
    this.nextNoteTime = now + 0.05;

    this.notify();
    this.startScheduler();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = true;
    this.stopTimers();
    audioEngine.stopAll();
    this.notify();
  }

  public stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.visualMeasureIndex = 0;
    this.visualItemIndex = -1;
    this.schedulerAudioMeasureIndex = 0;
    this.schedulerAudioItemIndex = 0;
    this.scheduledEvents = [];
    this.repeatCounts = {};
    this.hasExecutedDaCapo = false;
    this.hasExecutedDalSegno = false;
    this.stopTimers();
    audioEngine.stopAll();
    this.notify();
  }

  private stopTimers() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.cursorTimer) {
      clearInterval(this.cursorTimer);
      this.cursorTimer = null;
    }
  }

  private startScheduler() {
    this.stopTimers();

    // Run scheduler immediately and on intervals
    this.schedulerLoop();
    this.schedulerTimer = setInterval(() => this.schedulerLoop(), this.schedulerIntervalMs);
    this.cursorTimer = setInterval(() => this.cursorLoop(), 16);
  }

  private getEffectiveMeasureItems(staff: Staff, measureIdx: number) {
    const measure = staff.measures[measureIdx];
    if (!measure) return [];
    if (measure.isMeasureRepeat && measureIdx > 0) {
      const prevMeasure = staff.measures[measureIdx - 1];
      if (prevMeasure && prevMeasure.items.length > 0) {
        return prevMeasure.items;
      }
    }
    return measure.items;
  }

  /**
   * Lookahead scheduler: reads ahead and schedules audio events into Web Audio context
   */
  private schedulerLoop() {
    if (!this.isPlaying || !this.score) return;

    const staff = this.score.staves[0];
    if (!staff || staff.measures.length === 0) {
      this.onFinish();
      return;
    }

    const currentTime = audioEngine.getCurrentTime();

    while (this.isPlaying && this.nextNoteTime < currentTime + this.scheduleAheadTime) {
      if (this.schedulerAudioMeasureIndex >= staff.measures.length) {
        if (this.isLooping) {
          this.repeatCounts = {};
          this.hasExecutedDaCapo = false;
          this.hasExecutedDalSegno = false;
          this.schedulerAudioMeasureIndex = 0;
          this.schedulerAudioItemIndex = 0;
        } else {
          // Reached end of score, stop scheduling and let queued events finish
          break;
        }
      }

      const measure = staff.measures[this.schedulerAudioMeasureIndex];
      if (!measure) {
        this.schedulerAudioMeasureIndex++;
        this.schedulerAudioItemIndex = 0;
        continue;
      }

      const effectiveItems = this.getEffectiveMeasureItems(staff, this.schedulerAudioMeasureIndex);

      // Check if current measure is completed
      if (this.schedulerAudioItemIndex >= effectiveItems.length) {
        // 1. Navigation: Fine (if already executed D.C. or D.S.)
        if (
          measure.navigationMark === 'fine' &&
          (this.hasExecutedDaCapo || this.hasExecutedDalSegno)
        ) {
          this.schedulerAudioMeasureIndex = staff.measures.length;
          break;
        }

        // 2. Navigation: Da Capo / Da Capo al Fine
        if (
          (measure.navigationMark === 'daCapo' || measure.navigationMark === 'daCapoAlFine') &&
          !this.hasExecutedDaCapo
        ) {
          this.hasExecutedDaCapo = true;
          this.schedulerAudioMeasureIndex = 0;
          this.schedulerAudioItemIndex = 0;
          continue;
        }

        // 3. Navigation: Dal Segno / Dal Segno al Coda
        if (
          (measure.navigationMark === 'dalSegno' || measure.navigationMark === 'dalSegnoAlCoda') &&
          !this.hasExecutedDalSegno
        ) {
          this.hasExecutedDalSegno = true;
          const segnoIdx = staff.measures.findIndex((m) => m.navigationMark === 'segno');
          if (segnoIdx !== -1) {
            this.schedulerAudioMeasureIndex = segnoIdx;
            this.schedulerAudioItemIndex = 0;
            continue;
          }
        }

        // 4. Navigation: To Coda (on second pass after D.S. or D.C.)
        if (
          measure.navigationMark === 'toCoda' &&
          (this.hasExecutedDalSegno || this.hasExecutedDaCapo)
        ) {
          const codaIdx = staff.measures.findIndex(
            (m, idx) => idx > this.schedulerAudioMeasureIndex && m.navigationMark === 'coda'
          );
          if (codaIdx !== -1) {
            this.schedulerAudioMeasureIndex = codaIdx;
            this.schedulerAudioItemIndex = 0;
            continue;
          }
        }

        // 5. Normal Repeat End
        if (measure.repeatEnd) {
          const timesRepeated = this.repeatCounts[this.schedulerAudioMeasureIndex] || 0;
          const maxRepeats = measure.repeatCount || 2;
          if (timesRepeated + 1 < maxRepeats) {
            this.repeatCounts[this.schedulerAudioMeasureIndex] = timesRepeated + 1;
            let startIdx = 0;
            for (let i = this.schedulerAudioMeasureIndex; i >= 0; i--) {
              if (staff.measures[i]?.repeatStart) {
                startIdx = i;
                break;
              }
            }
            this.schedulerAudioMeasureIndex = startIdx;
            this.schedulerAudioItemIndex = 0;
            continue;
          }
        }

        // Advance to next measure
        this.schedulerAudioMeasureIndex++;
        this.schedulerAudioItemIndex = 0;

        // Handle Voltas
        if (this.schedulerAudioMeasureIndex < staff.measures.length) {
          const nextM = staff.measures[this.schedulerAudioMeasureIndex];
          if (nextM?.volta && (nextM.volta.startsWith('1') || nextM.volta.includes('1.'))) {
            let repeatEndIdx = -1;
            for (let i = this.schedulerAudioMeasureIndex; i < staff.measures.length; i++) {
              if (staff.measures[i]?.repeatEnd) {
                repeatEndIdx = i;
                break;
              }
            }
            if (repeatEndIdx !== -1 && (this.repeatCounts[repeatEndIdx] || 0) > 0) {
              let secondEndingIdx = -1;
              for (let i = repeatEndIdx + 1; i < staff.measures.length; i++) {
                const m = staff.measures[i];
                if (m?.volta && (m.volta.startsWith('2') || m.volta.includes('2.'))) {
                  secondEndingIdx = i;
                  break;
                }
              }
              this.schedulerAudioMeasureIndex =
                secondEndingIdx !== -1 ? secondEndingIdx : repeatEndIdx + 1;
            }
          }
        }
        continue;
      }

      // Schedule current item
      this.scheduleCurrentItem(staff, measure);
    }

    // Check if playback has naturally finished
    if (
      this.schedulerAudioMeasureIndex >= staff.measures.length &&
      this.scheduledEvents.length === 0 &&
      currentTime >= this.nextNoteTime
    ) {
      this.onFinish();
    }
  }

  private scheduleCurrentItem(staff: Staff, measure: (typeof staff.measures)[0]) {
    if (!this.score) return;

    const measureIdx = this.schedulerAudioMeasureIndex;
    const itemIdx = this.schedulerAudioItemIndex;
    const effectiveItems = this.getEffectiveMeasureItems(staff, measureIdx);
    const item = effectiveItems[itemIdx];
    if (!item) {
      this.schedulerAudioItemIndex++;
      return;
    }

    // Los cambios locales de compás y tempo se heredan, así que la métrica y la
    // duración del pulso se resuelven compás a compás en lugar de usar solo los
    // valores globales de la partitura.
    const timing =
      this.measureTimings[measureIdx] || this.measureTimings[this.measureTimings.length - 1];
    const maxMeasureBeats = resolveMeasureCapacity(this.score, measure, measureIdx);
    const tempo = timing?.tempo ?? this.score.tempo;
    const beatDurationSec = 60 / Math.max(30, Math.min(300, tempo));

    // Handle Multimeasure Rest (Tacet)
    if (measure.multimeasureRest && measure.multimeasureRest > 1) {
      const totalTacetBeats = measure.multimeasureRest * maxMeasureBeats;
      const tacetDurationSec = totalTacetBeats * beatDurationSec;

      if (this.metronomeEnabled) {
        for (let b = 0; b < totalTacetBeats; b++) {
          const isDownbeat = b % maxMeasureBeats === 0;
          audioEngine.playMetronomeTick(isDownbeat, this.nextNoteTime + b * beatDurationSec);
        }
      }

      this.scheduledEvents.push({
        audioTime: this.nextNoteTime,
        measureIndex: measureIdx,
        itemIndex: 0,
      });

      this.nextNoteTime += tacetDurationSec;
      this.schedulerAudioItemIndex = effectiveItems.length; // Jump to next bar
      return;
    }

    // Normal item duration calculation
    let beats = getItemBeats(item.duration, item.isDotted, item.tuplet);
    if (item.type === 'rest' && item.duration === 'w' && beats > maxMeasureBeats) {
      beats = maxMeasureBeats;
    }

    let itemDurationSec = beats * beatDurationSec;
    if (item.articulation === 'fermata') {
      itemDurationSec *= 1.8;
    }

    const isGrand = isPianoGrandStaff(this.score);
    const staffInstrument = resolveStaffInstrument(staff, isGrand, audioEngine.instrument);

    const DYNAMIC_VELOCITIES: Record<string, number> = {
      ppp: 0.25,
      pp: 0.4,
      p: 0.55,
      mp: 0.7,
      mf: 0.82,
      f: 0.95,
      ff: 1.0,
      fff: 1.0,
      sfz: 1.0,
      fp: 0.7,
      sfp: 0.65,
      rfz: 0.95,
    };

    // When starting measure, record measureStartTime and schedule Voice 2 + secondary staves
    if (itemIdx === 0) {
      this.measureStartTime = this.nextNoteTime;

      // Polyphonic Voice 2 scheduling on primary staff
      const hasVoice2 = effectiveItems.some((it) => it.voice === 2);
      if (hasVoice2) {
        const v2Timings = getMeasureItemStreamTimings(effectiveItems, maxMeasureBeats);
        v2Timings.forEach(
          ({ item: v2Item, itemIndex: v2Idx, startBeat: v2StartBeat, durationBeats: v2Dur }) => {
            if (v2Item.voice === 2 && v2Item.type === 'note') {
              const isV2ContinuingTie = isTiedFromPrevious(staff, measureIdx, v2Idx);
              if (!isV2ContinuingTie) {
                const v2Pitches = getItemPitches(v2Item);
                const noteStartTime = this.measureStartTime + v2StartBeat * beatDurationSec;
                const v2DurationSec = v2Dur * beatDurationSec;
                const totalV2Duration = v2Item.isTied
                  ? getTiedSoundingDuration(staff, measureIdx, v2Idx, beatDurationSec)
                  : v2DurationSec;

                let vel = v2Item.dynamic ? DYNAMIC_VELOCITIES[v2Item.dynamic] || 0.8 : 0.8;
                if (v2Item.articulation === 'accent') vel = Math.min(1.0, vel * 1.25);
                else if (v2Item.articulation === 'staccato') vel = Math.min(1.0, vel * 1.05);

                const playDur =
                  v2Item.articulation === 'staccato'
                    ? totalV2Duration * 0.45
                    : v2Item.articulation === 'tenuto'
                      ? totalV2Duration * 1.0
                      : v2Item.articulation === 'fermata'
                        ? totalV2Duration * 1.8
                        : totalV2Duration * 0.96;

                v2Pitches.forEach((p) => {
                  audioEngine.playMidi(
                    pitchToMidi(p),
                    playDur,
                    vel,
                    noteStartTime,
                    staffInstrument,
                    0
                  );
                });

                this.scheduledEvents.push({
                  audioTime: noteStartTime,
                  measureIndex: measureIdx,
                  itemIndex: v2Idx,
                });
              }
            }
          }
        );
      }

      // Secondary staves scheduling with multi-voice support
      if (this.score.staves.length > 1) {
        for (let sIdx = 1; sIdx < this.score.staves.length; sIdx++) {
          const secStaff = this.score.staves[sIdx];
          const secMeasure = secStaff?.measures[measureIdx];
          if (secMeasure) {
            const secItems = this.getEffectiveMeasureItems(secStaff, measureIdx);
            const secInstrument = resolveStaffInstrument(secStaff, isGrand, audioEngine.instrument);
            const secTimings = getMeasureItemStreamTimings(secItems, maxMeasureBeats);
            secTimings.forEach(
              ({
                item: secItem,
                itemIndex: secItemIdx,
                startBeat: secStartBeat,
                durationBeats: secDur,
              }) => {
                const secDuration = secDur * beatDurationSec;
                const isSecContinuingTie = isTiedFromPrevious(secStaff, measureIdx, secItemIdx);

                if (secItem.type === 'note' && !isSecContinuingTie) {
                  const secPitches = getItemPitches(secItem);
                  const noteStartTime = this.measureStartTime + secStartBeat * beatDurationSec;
                  const totalSecDuration = secItem.isTied
                    ? getTiedSoundingDuration(secStaff, measureIdx, secItemIdx, beatDurationSec)
                    : secDuration;

                  let secVel = secItem.dynamic ? DYNAMIC_VELOCITIES[secItem.dynamic] || 0.8 : 0.75;
                  if (secItem.articulation === 'accent') secVel = Math.min(1.0, secVel * 1.25);
                  else if (secItem.articulation === 'staccato')
                    secVel = Math.min(1.0, secVel * 1.05);

                  const secPlayDur =
                    secItem.articulation === 'staccato'
                      ? totalSecDuration * 0.45
                      : secItem.articulation === 'tenuto'
                        ? totalSecDuration * 1.0
                        : secItem.articulation === 'fermata'
                          ? totalSecDuration * 1.8
                          : totalSecDuration * 0.96;

                  secPitches.forEach((sp) => {
                    const secMidi = pitchToMidi(sp);
                    audioEngine.playMidi(
                      secMidi,
                      secPlayDur,
                      secVel,
                      noteStartTime,
                      secInstrument,
                      sIdx
                    );
                  });
                }
              }
            );
          }
        }
      }
    }

    // Voice 2 items on primary staff were already scheduled at measure start
    if (item.voice === 2) {
      this.schedulerAudioItemIndex++;
      if (this.schedulerAudioItemIndex >= effectiveItems.length) {
        this.nextNoteTime = Math.max(
          this.nextNoteTime,
          this.measureStartTime + maxMeasureBeats * beatDurationSec
        );
      }
      return;
    }

    // Metronome tick scheduling
    if (this.metronomeEnabled) {
      const isDownbeat = itemIdx === 0 && !(measureIdx === 0 && measure.isAnacrusis);
      audioEngine.playMetronomeTick(isDownbeat, this.nextNoteTime);

      const fullBeats = Math.floor(beats);
      for (let b = 1; b < fullBeats; b++) {
        audioEngine.playMetronomeTick(false, this.nextNoteTime + b * beatDurationSec);
      }
    }

    // Sound generation for primary staff note
    const isContinuingTie = isTiedFromPrevious(staff, measureIdx, itemIdx);
    if (item.type === 'note' && !isContinuingTie) {
      const pitches = getItemPitches(item);
      let velocity = item.dynamic ? DYNAMIC_VELOCITIES[item.dynamic] || 0.8 : 0.8;
      if (item.articulation === 'accent') velocity = Math.min(1.0, velocity * 1.25);
      else if (item.articulation === 'staccato') velocity = Math.min(1.0, velocity * 1.05);

      const totalDurationSec = item.isTied
        ? getTiedSoundingDuration(staff, measureIdx, itemIdx, beatDurationSec)
        : itemDurationSec;

      const playDuration =
        item.articulation === 'staccato'
          ? totalDurationSec * 0.45
          : item.articulation === 'tenuto'
            ? totalDurationSec * 1.0
            : item.articulation === 'fermata'
              ? totalDurationSec * 1.8
              : totalDurationSec * 0.96;

      pitches.forEach((p) => {
        const midi = pitchToMidi(p);
        audioEngine.playMidi(midi, playDuration, velocity, this.nextNoteTime, staffInstrument, 0);
      });
    }

    // Chord comping harmonic accompaniment
    if (this.chordCompingEnabled && item.chord) {
      const chordMidis = parseChordToMidi(item.chord);
      if (chordMidis.length > 0) {
        const chordPlayDur = Math.max(0.3, Math.min(itemDurationSec * 0.96, 2.5));
        chordMidis.forEach((cMidi) => {
          audioEngine.playMidi(
            cMidi,
            chordPlayDur,
            this.chordCompingVolume,
            this.nextNoteTime,
            'piano',
            0
          );
        });
      }
    }

    // Enqueue visual cursor synchronization event
    this.scheduledEvents.push({
      audioTime: this.nextNoteTime,
      measureIndex: measureIdx,
      itemIndex: itemIdx,
    });

    this.scheduledEvents.sort((a, b) => a.audioTime - b.audioTime);

    this.nextNoteTime += itemDurationSec;
    this.schedulerAudioItemIndex++;

    if (this.schedulerAudioItemIndex >= effectiveItems.length) {
      this.nextNoteTime = Math.max(
        this.nextNoteTime,
        this.measureStartTime + maxMeasureBeats * beatDurationSec
      );
    }
  }

  /**
   * Sync visual playhead cursor with native Web Audio currentTime
   */
  private cursorLoop() {
    if (!this.isPlaying) return;

    const currentTime = audioEngine.getCurrentTime();
    let updated = false;

    while (this.scheduledEvents.length > 0 && this.scheduledEvents[0].audioTime <= currentTime) {
      const ev = this.scheduledEvents.shift()!;
      this.visualMeasureIndex = ev.measureIndex;
      this.visualItemIndex = ev.itemIndex;
      updated = true;
    }

    if (updated) {
      this.notify();
    }
  }

  private onFinish() {
    this.isPlaying = false;
    this.isPaused = false;
    this.visualMeasureIndex = 0;
    this.visualItemIndex = -1;
    this.stopTimers();
    this.notify();
  }
}

export const scorePlayer = new ScorePlayer();
