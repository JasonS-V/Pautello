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

/**
 * Detecta *ataques* de nota, no fotogramas.
 *
 * El analizador entrega una lectura continua mientras una nota suena, así que
 * contar cada lectura hunde la precisión de la práctica sin que el usuario haya
 * tocado nada nuevo. Aquí una nota solo cuenta al empezar a sonar: cuando cambia
 * de altura, o cuando vuelve después de un silencio real.
 */
export class OnsetDetector {
  private readonly releaseMs: number;
  private lastMidi: number | null = null;
  private isSounding: boolean = false;
  private silentSince: number | null = null;

  constructor(releaseMs: number = 120) {
    this.releaseMs = releaseMs;
  }

  /**
   * Registra una lectura del analizador y responde si es un ataque.
   * Un silencio más corto que `releaseMs` es un hueco del análisis (vibrato,
   * respiración), no el final de la nota.
   */
  public update(midi: number | null, now: number): boolean {
    if (midi === null) {
      if (!this.isSounding) return false;
      if (this.silentSince === null) this.silentSince = now;
      else if (now - this.silentSince >= this.releaseMs) this.release();
      return false;
    }

    // La nota puede volver sin que haya habido una lectura de silencio después
    // del umbral; si el hueco ya era lo bastante largo, la nota anterior acabó.
    if (this.silentSince !== null && now - this.silentSince >= this.releaseMs) this.release();

    const isAttack = !this.isSounding || midi !== this.lastMidi;
    this.lastMidi = midi;
    this.isSounding = true;
    this.silentSince = null;
    return isAttack;
  }

  /** Vuelve al estado inicial: la próxima nota siempre cuenta. */
  public reset(): void {
    this.release();
  }

  private release(): void {
    this.lastMidi = null;
    this.isSounding = false;
    this.silentSince = null;
  }
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
