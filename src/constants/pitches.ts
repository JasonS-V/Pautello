import { Step, Pitch, Accidental, NoteDuration, KeySignature, NamingConvention } from '../types/music';


export const STEP_INDEX: Record<Step, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

export const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const LATIN_STEP_NAMES: Record<Step, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

// Base semitones above C in an octave
export const STEP_SEMITONES: Record<Step, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const ACCIDENTAL_OFFSETS: Record<string, number> = {
  '#': 1,
  '##': 2,
  'b': -1,
  'bb': -2,
  'n': 0,
};

/**
 * Calculates MIDI note number for a pitch (e.g., C4 = 60, A4 = 69)
 */
export function pitchToMidi(pitch: Pitch): number {
  const base = 12 * (pitch.octave + 1); // C-1 is 0, C4 is 60
  const stepSemi = STEP_SEMITONES[pitch.step];
  const accOffset = pitch.accidental ? (ACCIDENTAL_OFFSETS[pitch.accidental] || 0) : 0;
  return base + stepSemi + accOffset;
}

/**
 * Calculates frequency in Hertz for a given MIDI note (A4 = 440 Hz)
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Frequency for a Pitch
 */
export function pitchToFrequency(pitch: Pitch): number {
  return midiToFrequency(pitchToMidi(pitch));
}

/**
 * Formats a pitch into a readable string (e.g. "Do4" or "C4")
 */
export function formatPitchName(pitch: Pitch, convention: NamingConvention = 'latin'): string {
  const stepName = convention === 'latin' ? LATIN_STEP_NAMES[pitch.step] : pitch.step;
  const acc = pitch.accidental ? (pitch.accidental === 'n' ? '♮' : pitch.accidental === '#' ? '♯' : pitch.accidental === 'b' ? '♭' : pitch.accidental) : '';
  return `${stepName}${acc}${pitch.octave}`;
}

/**
 * Duration in quarter notes (beats in 4/4 time)
 */
export const DURATION_BEATS: Record<NoteDuration, number> = {
  w: 4.0,   // whole note (redonda)
  h: 2.0,   // half note (blanca)
  q: 1.0,   // quarter note (negra)
  '8': 0.5, // eighth note (corchea)
  '16': 0.25, // sixteenth note (semicorchea)
  '32': 0.125, // 32nd note (fusa)
};

export const DURATION_SPANISH_NAMES: Record<NoteDuration, string> = {
  w: 'Redonda',
  h: 'Blanca',
  q: 'Negra',
  '8': 'Corchea',
  '16': 'Semicorchea',
  '32': 'Fusa',
};

/**
 * Calculates total beat duration of an item (accounting for dotted notes)
 */
export function getItemBeats(duration: NoteDuration, isDotted?: boolean): number {
  const base = DURATION_BEATS[duration] || 1;
  return isDotted ? base * 1.5 : base;
}

/**
 * Key signature definitions: count of sharps (positive) or flats (negative)
 */
export const KEY_SIGNATURE_DATA: Record<KeySignature, { accidentals: number; type: '#' | 'b' | 'none'; name: string }> = {
  'C': { accidentals: 0, type: 'none', name: 'Do Mayor / La menor' },
  'G': { accidentals: 1, type: '#', name: 'Sol Mayor (1♯)' },
  'D': { accidentals: 2, type: '#', name: 'Re Mayor (2♯)' },
  'A': { accidentals: 3, type: '#', name: 'La Mayor (3♯)' },
  'E': { accidentals: 4, type: '#', name: 'Mi Mayor (4♯)' },
  'B': { accidentals: 5, type: '#', name: 'Si Mayor (5♯)' },
  'F#': { accidentals: 6, type: '#', name: 'Fa♯ Mayor (6♯)' },
  'C#': { accidentals: 7, type: '#', name: 'Do♯ Mayor (7♯)' },
  'F': { accidentals: 1, type: 'b', name: 'Fa Mayor (1♭)' },
  'Bb': { accidentals: 2, type: 'b', name: 'Si♭ Mayor (2♭)' },
  'Eb': { accidentals: 3, type: 'b', name: 'Mi♭ Mayor (3♭)' },
  'Ab': { accidentals: 4, type: 'b', name: 'La♭ Mayor (4♭)' },
  'Db': { accidentals: 5, type: 'b', name: 'Re♭ Mayor (5♭)' },
  'Gb': { accidentals: 6, type: 'b', name: 'Sol♭ Mayor (6♭)' },
  'Cb': { accidentals: 7, type: 'b', name: 'Do♭ Mayor (7♭)' },
  'Am': { accidentals: 0, type: 'none', name: 'La menor (0)' },
  'Em': { accidentals: 1, type: '#', name: 'Mi menor (1♯)' },
  'Bm': { accidentals: 2, type: '#', name: 'Si menor (2♯)' },
  'F#m': { accidentals: 3, type: '#', name: 'Fa♯ menor (3♯)' },
  'C#m': { accidentals: 4, type: '#', name: 'Do♯ menor (4♯)' },
  'G#m': { accidentals: 5, type: '#', name: 'Sol♯ menor (5♯)' },
  'D#m': { accidentals: 6, type: '#', name: 'Re♯ menor (6♯)' },
  'Dm': { accidentals: 1, type: 'b', name: 'Re menor (1♭)' },
  'Gm': { accidentals: 2, type: 'b', name: 'Sol menor (2♭)' },
  'Cm': { accidentals: 3, type: 'b', name: 'Do menor (3♭)' },
  'Fm': { accidentals: 4, type: 'b', name: 'Fa menor (4♭)' },
  'Bbm': { accidentals: 5, type: 'b', name: 'Si♭ menor (5♭)' },
  'Ebm': { accidentals: 6, type: 'b', name: 'Mi♭ menor (6♭)' },
};

// Order of sharps and flats in key signatures
export const ORDER_OF_SHARPS: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const ORDER_OF_FLATS: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const MIDI_NOTE_TABLE: { step: Step; accidental: Accidental }[] = [
  { step: 'C', accidental: null },
  { step: 'C', accidental: '#' },
  { step: 'D', accidental: null },
  { step: 'D', accidental: '#' },
  { step: 'E', accidental: null },
  { step: 'F', accidental: null },
  { step: 'F', accidental: '#' },
  { step: 'G', accidental: null },
  { step: 'G', accidental: '#' },
  { step: 'A', accidental: null },
  { step: 'A', accidental: '#' },
  { step: 'B', accidental: null },
];

/**
 * Converts a MIDI note number (0-127) to a musical Pitch object
 * e.g., 60 -> C4, 61 -> C#4, 69 -> A4
 */
export function midiToPitch(midi: number): Pitch {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = ((midi % 12) + 12) % 12;
  const { step, accidental } = MIDI_NOTE_TABLE[noteIndex];
  return { step, octave, accidental };
}

