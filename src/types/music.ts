export type Clef = 'treble' | 'bass' | 'alto';

export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '32'; // whole, half, quarter, eighth, sixteenth, 32nd

export type Accidental = '#' | 'b' | 'n' | '##' | 'bb' | null;

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type Articulation =
  | 'staccato'
  | 'accent'
  | 'tenuto'
  | 'fermata'
  | 'marcato'
  | 'staccatissimo'
  | 'downBow'
  | 'upBow'
  | 'harmonic'
  | 'portato'
  | null;

export type Ornament = 'trill' | 'mordent' | 'turn' | 'arpeggio' | 'glissando' | null;

export type Dynamic =
  'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | 'sfz' | 'fp' | 'sfp' | 'rfz' | null;

export type BarlineType = 'standard' | 'double' | 'final';

export type NavigationMark =
  | 'segno'
  | 'coda'
  | 'daCapo'
  | 'dalSegno'
  | 'daCapoAlFine'
  | 'dalSegnoAlCoda'
  | 'toCoda'
  | 'fine'
  | null;

export interface Pitch {
  step: Step;
  octave: number;
  accidental: Accidental;
}

export interface TupletInfo {
  actual: number; // e.g. 3 (notes played)
  normal: number; // e.g. 2 (notes in equivalent normal duration)
  type?: 'start' | 'continue' | 'stop';
}

export interface ScoreItem {
  id: string;
  type: 'note' | 'rest';
  pitch?: Pitch; // primary / single pitch
  pitches?: Pitch[]; // polyphonic chord pitches (for chords on the same beat)
  duration: NoteDuration;
  isDotted?: boolean;
  isTied?: boolean;
  slur?: 'start' | 'stop';
  tuplet?: TupletInfo;
  articulation?: Articulation;
  ornament?: Ornament;
  dynamic?: Dynamic;
  hairpin?: 'cresc' | 'decresc' | 'stop' | null;
  lyric?: string;
  chord?: string; // Lead sheet chord symbol e.g. "C", "G7", "Am", "F#m7", "C/E"
  noteType?: 'standard' | 'grace' | 'slash';
  graceType?: 'acciaccatura' | 'appoggiatura';
  fingering?: number; // 1 - 5
  pedal?: 'start' | 'stop';
  voice?: 1 | 2; // Polyphonic voice: Voice 1 (stems up by default) or Voice 2 (stems down)
  stemDirection?: 'up' | 'down' | 'auto'; // Explicit override of stem direction
}

/**
 * Returns all pitches associated with a score item (supports both single pitch and multi-pitch chords)
 */
export function getItemPitches(item: ScoreItem): Pitch[] {
  if (item.type !== 'note') return [];
  if (item.pitches && item.pitches.length > 0) return item.pitches;
  if (item.pitch) return [item.pitch];
  return [];
}

export interface Measure {
  id: string;
  items: ScoreItem[];
  repeatStart?: boolean;
  repeatEnd?: boolean;
  repeatCount?: number;
  volta?: string; // e.g. "1.", "2.", "1, 3.", "2, 4."
  barline?: BarlineType; // e.g. 'double' for section boundary
  navigationMark?: NavigationMark; // Segno, Coda, D.S. al Coda, Fine, etc.
  rehearsalMark?: string; // e.g. "A", "B", "Intro"
  isMeasureRepeat?: boolean; // % repeat measure sign
  caesura?: boolean; // // caesura break
  breathMark?: boolean; // ' breath mark
  tempoText?: string; // e.g. "Allegro", "Andante", "Rit.", "A tempo"
  tempoBpm?: number; // Local BPM tempo change
  timeSignatureChange?: TimeSignature; // Metric modulation at measure
  keySignatureChange?: KeySignature; // Key change at measure
  isAnacrusis?: boolean;
  pickupBeats?: number;
  systemBreak?: boolean;
  pageBreak?: boolean;
  multimeasureRest?: number; // Count of bars for multimeasure rest (Tacet)
}

export interface Staff {
  id: string;
  name: string;
  shortName?: string; // Abbreviated instrument name for subsequent systems (e.g. "Tpt. 1")
  clef: Clef;
  transposition?: number; // Transposition semitones (0 for C, 2 for Bb, 9 for Eb, 7 for F)
  measures: Measure[];
}

export interface TimeSignature {
  beats: number; // numerator: 2, 3, 4, 6, etc.
  beatType: number; // denominator: 2, 4, 8, etc.
}

export type KeySignature =
  | 'C'
  | 'G'
  | 'D'
  | 'A'
  | 'E'
  | 'B'
  | 'F#'
  | 'C#'
  | 'F'
  | 'Bb'
  | 'Eb'
  | 'Ab'
  | 'Db'
  | 'Gb'
  | 'Cb'
  | 'Am'
  | 'Em'
  | 'Bm'
  | 'F#m'
  | 'C#m'
  | 'G#m'
  | 'D#m'
  | 'Dm'
  | 'Gm'
  | 'Cm'
  | 'Fm'
  | 'Bbm'
  | 'Ebm';

export interface Score {
  id: string;
  title: string;
  subtitle?: string; // e.g. "Huapango", "Vals", "Canción"
  composer: string;
  lyricist?: string; // Lyricist or Arranger ("Arr. por...")
  partName?: string; // e.g. "Trompeta 1", "Violín I"
  copyright?: string; // e.g. "© 2026 Todos los derechos reservados"
  tempo: number; // BPM (beats per minute)
  timeSignature: TimeSignature;
  keySignature: KeySignature;
  staves: Staff[];
  isGrandStaff?: boolean; // Par de pentagramas unidos por llave (estilo piano)
  /** Versión del esquema al que se normalizó la partitura (ver scoreSchema.ts). */
  schemaVersion?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Indica si la partitura es un gran pentagrama (dos pentagramas unidos por una
 * llave). El nombre del pentagrama NO define la estructura, porque el usuario
 * puede conservar el nombre y la clave de su instrumento; la fuente de verdad es
 * `Score.isGrandStaff`. La comprobación por nombre se mantiene solo para
 * partituras guardadas antes de que existiera esa bandera.
 */
export function isPianoGrandStaff(score: Score): boolean {
  if (score.staves.length !== 2) return false;
  if (score.isGrandStaff) return true;
  // Compatibilidad con partituras guardadas antes de la bandera: el toggle
  // antiguo renombraba el par entero a "Mano Derecha" / "Mano Izquierda".
  const [upper, lower] = score.staves;
  return (
    upper.name.trim().toLowerCase() === 'mano derecha' &&
    lower.name.trim().toLowerCase() === 'mano izquierda'
  );
}

export type NamingConvention = 'latin' | 'english'; // 'latin' = Do, Re, Mi... | 'english' = C, D, E...

export type KeyboardInputMode = 'piano' | 'notation';
