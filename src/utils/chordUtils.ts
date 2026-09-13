import { KeySignature, Step, Accidental, NamingConvention } from '../types/music';

// Map pitch class to diatonic step and accidental
const PITCH_CLASS_TO_SHARP_NOTE: { step: Step; accidental: Accidental }[] = [
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

const PITCH_CLASS_TO_FLAT_NOTE: { step: Step; accidental: Accidental }[] = [
  { step: 'C', accidental: null },
  { step: 'D', accidental: 'b' },
  { step: 'D', accidental: null },
  { step: 'E', accidental: 'b' },
  { step: 'E', accidental: null },
  { step: 'F', accidental: null },
  { step: 'G', accidental: 'b' },
  { step: 'G', accidental: null },
  { step: 'A', accidental: 'b' },
  { step: 'A', accidental: null },
  { step: 'B', accidental: 'b' },
  { step: 'B', accidental: null },
];

const NOTE_TO_PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

const LATIN_TO_ENGLISH: Record<string, string> = {
  Do: 'C',
  Re: 'D',
  Mi: 'E',
  Fa: 'F',
  Sol: 'G',
  La: 'A',
  Si: 'B',
};

const ENGLISH_TO_LATIN: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

/**
 * Transposes a single note string (e.g. "C", "F#", "Bb") by semitones
 */
export function transposeNoteName(note: string, semitones: number, preferSharps = true): string {
  // Normalize Latin note to English if needed
  let latinPrefix = '';
  let engNote = note;

  for (const [lat, eng] of Object.entries(LATIN_TO_ENGLISH)) {
    if (note.startsWith(lat)) {
      latinPrefix = lat;
      engNote = eng + note.slice(lat.length);
      break;
    }
  }

  const match = /^([A-G][#b]?)$/i.exec(engNote);
  if (!match) return note;

  const originalPitchClass = NOTE_TO_PITCH_CLASS[match[1]];
  if (originalPitchClass === undefined) return note;

  const newPitchClass = (originalPitchClass + semitones % 12 + 12) % 12;
  const table = preferSharps ? PITCH_CLASS_TO_SHARP_NOTE : PITCH_CLASS_TO_FLAT_NOTE;
  const target = table[newPitchClass];
  const transposedEng = `${target.step}${target.accidental || ''}`;

  if (latinPrefix) {
    const latName = ENGLISH_TO_LATIN[target.step];
    return `${latName}${target.accidental || ''}`;
  }

  return transposedEng;
}

/**
 * Transposes a full chord symbol string (e.g. "Cmaj7", "F#m7", "G7/B", "Lam7") by semitones
 */
export function transposeChord(chord: string, semitones: number, preferSharps = true): string {
  if (!chord || semitones === 0) return chord;

  // Split slash chord into main chord and bass note if present (e.g. "C/E" -> "C", "E")
  const parts = chord.split('/');
  const mainChord = parts[0];
  const bassNote = parts[1];

  // Regex to extract root note (English: C-B, or Latin: Do, Re, Mi, Fa, Sol, La, Si)
  const regex = /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b]?)(.*)$/i;
  const match = regex.exec(mainChord);

  if (!match) return chord;

  const rootName = match[1];
  const rootAcc = match[2];
  const quality = match[3];

  const fullRoot = `${rootName}${rootAcc}`;
  const transposedRoot = transposeNoteName(fullRoot, semitones, preferSharps);

  let result = `${transposedRoot}${quality}`;

  if (bassNote) {
    const transposedBass = transposeNoteName(bassNote, semitones, preferSharps);
    result += `/${transposedBass}`;
  }

  return result;
}

/**
 * Returns diatonic chord suggestions for a given key signature
 */
export function getDiatonicChordsForKey(
  key: KeySignature,
  convention: NamingConvention = 'english'
): string[] {
  const isMinor = key.endsWith('m');

  // Major scale intervals and qualities: I, ii, iii, IV, V, vi, vii°
  const MAJOR_CHORD_DEGREES = [
    { semitones: 0, suffix: '' },
    { semitones: 2, suffix: 'm' },
    { semitones: 4, suffix: 'm' },
    { semitones: 5, suffix: '' },
    { semitones: 7, suffix: '7' },
    { semitones: 9, suffix: 'm' },
    { semitones: 11, suffix: 'dim' },
  ];

  // Natural minor scale intervals and qualities: i, ii°, III, iv, v/V7, VI, VII
  const MINOR_CHORD_DEGREES = [
    { semitones: 0, suffix: 'm' },
    { semitones: 2, suffix: 'dim' },
    { semitones: 3, suffix: '' },
    { semitones: 5, suffix: 'm' },
    { semitones: 7, suffix: '7' }, // Harmonic minor V7
    { semitones: 8, suffix: '' },
    { semitones: 10, suffix: '' },
  ];

  // Determine root pitch
  const rootBase = key.replace('m', '');
  const degrees = isMinor ? MINOR_CHORD_DEGREES : MAJOR_CHORD_DEGREES;

  return degrees.map(deg => {
    const note = transposeNoteName(rootBase, deg.semitones, true);
    let chord = `${note}${deg.suffix}`;
    if (convention === 'latin') {
      const match = /^([A-G][#b]?)(.*)$/.exec(chord);
      if (match) {
        const engLetter = match[1].charAt(0);
        const acc = match[1].slice(1);
        const lat = ENGLISH_TO_LATIN[engLetter] || engLetter;
        chord = `${lat}${acc}${match[2]}`;
      }
    }
    return chord;
  });
}
