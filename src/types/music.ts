export type Clef = 'treble' | 'bass' | 'alto';

export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '32'; // whole, half, quarter, eighth, sixteenth, 32nd

export type Accidental = '#' | 'b' | 'n' | '##' | 'bb' | null;

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type Articulation = 'staccato' | 'accent' | 'tenuto' | 'fermata' | null;

export interface Pitch {
  step: Step;
  octave: number;
  accidental: Accidental;
}

export interface ScoreItem {
  id: string;
  type: 'note' | 'rest';
  pitch?: Pitch; // only for note
  duration: NoteDuration;
  isDotted?: boolean;
  isTied?: boolean;
  articulation?: Articulation;
  lyric?: string;
  chord?: string; // Lead sheet chord symbol e.g. "C", "G7", "Am", "F#m7", "C/E"
}

export interface Measure {
  id: string;
  items: ScoreItem[];
}

export interface Staff {
  id: string;
  name: string;
  clef: Clef;
  measures: Measure[];
}

export interface TimeSignature {
  beats: number; // numerator: 2, 3, 4, 6, etc.
  beatType: number; // denominator: 2, 4, 8, etc.
}

export type KeySignature = 
  | 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#'
  | 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb'
  | 'Am' | 'Em' | 'Bm' | 'F#m' | 'C#m' | 'G#m' | 'D#m'
  | 'Dm' | 'Gm' | 'Cm' | 'Fm' | 'Bbm' | 'Ebm';

export interface Score {
  id: string;
  title: string;
  composer: string;
  tempo: number; // BPM (beats per minute)
  timeSignature: TimeSignature;
  keySignature: KeySignature;
  staves: Staff[];
  createdAt: number;
  updatedAt: number;
}

export type NamingConvention = 'latin' | 'english'; // 'latin' = Do, Re, Mi... | 'english' = C, D, E...
