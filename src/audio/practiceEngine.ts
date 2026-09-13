import { Score, Pitch } from '../types/music';
import { pitchToMidi } from '../constants/pitches';

export interface PlayableNoteInfo {
  measureIdx: number;
  itemIdx: number;
  pitch: Pitch;
  midi: number;
}

export interface PracticeCheckResult {
  isMatch: boolean;
  isCompleted: boolean;
  streak: number;
  accuracy: number;
  nextTargetNote: PlayableNoteInfo | null;
}

export class PracticeSession {
  private playableNotes: PlayableNoteInfo[] = [];
  public currentNoteIndex: number = 0;
  public correctHits: number = 0;
  public totalAttempts: number = 0;
  public streak: number = 0;
  public isCompleted: boolean = false;
  public isActive: boolean = false;

  constructor(score?: Score) {
    if (score) {
      this.loadScore(score);
    }
  }

  public loadScore(score: Score) {
    this.playableNotes = [];
    const staff = score.staves[0];
    if (!staff) return;

    staff.measures.forEach((measure, mIdx) => {
      measure.items.forEach((item, iIdx) => {
        if (item.type === 'note' && item.pitch) {
          this.playableNotes.push({
            measureIdx: mIdx,
            itemIdx: iIdx,
            pitch: item.pitch,
            midi: pitchToMidi(item.pitch),
          });
        }
      });
    });

    this.reset();
  }

  public get totalNotes(): number {
    return this.playableNotes.length;
  }

  public get targetNote(): PlayableNoteInfo | null {
    if (this.playableNotes.length === 0) return null;
    return this.playableNotes[this.currentNoteIndex] || null;
  }

  public get accuracy(): number {
    if (this.totalAttempts === 0) return 100;
    return Math.round((this.correctHits / this.totalAttempts) * 100);
  }

  public start() {
    this.isActive = true;
    this.reset();
  }

  public stop() {
    this.isActive = false;
  }

  public reset() {
    this.currentNoteIndex = 0;
    this.correctHits = 0;
    this.totalAttempts = 0;
    this.streak = 0;
    this.isCompleted = false;
  }

  public checkNote(playedMidi: number): PracticeCheckResult {
    if (!this.isActive || !this.targetNote || this.isCompleted) {
      return {
        isMatch: false,
        isCompleted: this.isCompleted,
        streak: this.streak,
        accuracy: this.accuracy,
        nextTargetNote: this.targetNote,
      };
    }

    this.totalAttempts++;

    const isMatch = playedMidi === this.targetNote.midi;

    if (isMatch) {
      this.correctHits++;
      this.streak++;
      this.currentNoteIndex++;

      if (this.currentNoteIndex >= this.playableNotes.length) {
        this.isCompleted = true;
      }
    } else {
      this.streak = 0;
    }

    return {
      isMatch,
      isCompleted: this.isCompleted,
      streak: this.streak,
      accuracy: this.accuracy,
      nextTargetNote: this.targetNote,
    };
  }
}
