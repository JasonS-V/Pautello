import { Score, Pitch, KeySignature, Step, Accidental, getItemPitches } from '../types/music';
import { pitchToMidi, getItemBeats, KEY_SIGNATURE_DATA } from '../constants/pitches';
import { transposeChord } from './chordUtils';

// Krumhansl-Kessler key profiles for major and minor keys
// Reference: Krumhansl, C. L. (1990). Cognitive Foundations of Musical Pitch.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Pitch Class to semitones from C: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
export interface KeyCandidate {
  key: KeySignature;
  rootPitchClass: number;
  isMajor: boolean;
  preferSharps: boolean;
}

export const ALL_KEYS: KeyCandidate[] = [
  // Major keys
  { key: 'C', rootPitchClass: 0, isMajor: true, preferSharps: true },
  { key: 'G', rootPitchClass: 7, isMajor: true, preferSharps: true },
  { key: 'D', rootPitchClass: 2, isMajor: true, preferSharps: true },
  { key: 'A', rootPitchClass: 9, isMajor: true, preferSharps: true },
  { key: 'E', rootPitchClass: 4, isMajor: true, preferSharps: true },
  { key: 'B', rootPitchClass: 11, isMajor: true, preferSharps: true },
  { key: 'F#', rootPitchClass: 6, isMajor: true, preferSharps: true },
  { key: 'C#', rootPitchClass: 1, isMajor: true, preferSharps: true },
  { key: 'F', rootPitchClass: 5, isMajor: true, preferSharps: false },
  { key: 'Bb', rootPitchClass: 10, isMajor: true, preferSharps: false },
  { key: 'Eb', rootPitchClass: 3, isMajor: true, preferSharps: false },
  { key: 'Ab', rootPitchClass: 8, isMajor: true, preferSharps: false },
  { key: 'Db', rootPitchClass: 1, isMajor: true, preferSharps: false },
  { key: 'Gb', rootPitchClass: 6, isMajor: true, preferSharps: false },
  { key: 'Cb', rootPitchClass: 11, isMajor: true, preferSharps: false },

  // Minor keys
  { key: 'Am', rootPitchClass: 9, isMajor: false, preferSharps: true },
  { key: 'Em', rootPitchClass: 4, isMajor: false, preferSharps: true },
  { key: 'Bm', rootPitchClass: 11, isMajor: false, preferSharps: true },
  { key: 'F#m', rootPitchClass: 6, isMajor: false, preferSharps: true },
  { key: 'C#m', rootPitchClass: 1, isMajor: false, preferSharps: true },
  { key: 'G#m', rootPitchClass: 8, isMajor: false, preferSharps: true },
  { key: 'D#m', rootPitchClass: 3, isMajor: false, preferSharps: true },
  { key: 'Dm', rootPitchClass: 2, isMajor: false, preferSharps: false },
  { key: 'Gm', rootPitchClass: 7, isMajor: false, preferSharps: false },
  { key: 'Cm', rootPitchClass: 0, isMajor: false, preferSharps: false },
  { key: 'Fm', rootPitchClass: 5, isMajor: false, preferSharps: false },
  { key: 'Bbm', rootPitchClass: 10, isMajor: false, preferSharps: false },
  { key: 'Ebm', rootPitchClass: 3, isMajor: false, preferSharps: false },
];

/**
 * Calculates Pearson Correlation Coefficient between two vectors
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || y.length !== n) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    num += diffX * diffY;
    denX += diffX * diffX;
    denY += diffY * diffY;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return 0;
  return num / den;
}

export interface DetectedKeyResult {
  key: KeySignature;
  name: string;
  confidence: number; // 0 to 100%
  isMajor: boolean;
}

/**
 * Detects the musical key signature of a Score using the Krumhansl-Schmuckler algorithm
 */
export function detectKeyFromScore(score: Score): DetectedKeyResult {
  // 12-dimensional Pitch Class Profile vector (C=0, C#=1, ..., B=11)
  const pitchClassDistribution = new Array(12).fill(0);
  let totalNoteWeight = 0;

  score.staves.forEach((staff) => {
    staff.measures.forEach((measure) => {
      measure.items.forEach((item) => {
        if (item.type === 'note' && item.pitch) {
          const midi = pitchToMidi(item.pitch);
          const pitchClass = midi % 12;
          const durationWeight = getItemBeats(item.duration, item.isDotted);

          pitchClassDistribution[pitchClass] += durationWeight;
          totalNoteWeight += durationWeight;
        }
      });
    });
  });

  // If no notes exist in the score, return current key signature or C default
  if (totalNoteWeight === 0) {
    const defaultKey = score.keySignature || 'C';
    const keyData = KEY_SIGNATURE_DATA[defaultKey];
    return {
      key: defaultKey,
      name: keyData?.name || defaultKey,
      confidence: 100,
      isMajor: !defaultKey.endsWith('m'),
    };
  }

  // Correlate with all key candidates
  let bestCandidate = ALL_KEYS[0];
  let highestScore = -Infinity;

  ALL_KEYS.forEach((candidate) => {
    const template = candidate.isMajor ? MAJOR_PROFILE : MINOR_PROFILE;
    // Rotate template vector by root pitch class
    const rotatedTemplate = new Array(12);
    for (let i = 0; i < 12; i++) {
      rotatedTemplate[i] = template[(i - candidate.rootPitchClass + 12) % 12];
    }

    const correlation = pearsonCorrelation(pitchClassDistribution, rotatedTemplate);
    if (correlation > highestScore) {
      highestScore = correlation;
      bestCandidate = candidate;
    }
  });

  // Scale correlation from [-1, 1] to percentage [0, 100]
  // Usually strong tonal matches have correlation > 0.6
  const confidence = Math.max(30, Math.min(99, Math.round(((highestScore + 1) / 2) * 100)));

  const keyData = KEY_SIGNATURE_DATA[bestCandidate.key];
  return {
    key: bestCandidate.key,
    name: keyData?.name || bestCandidate.key,
    confidence,
    isMajor: bestCandidate.isMajor,
  };
}

/**
 * Calculates the shortest directed semitone offset between two keys
 */
export function getSemitoneOffsetBetweenKeys(fromKey: KeySignature, toKey: KeySignature): number {
  const fromCandidate = ALL_KEYS.find((k) => k.key === fromKey) || ALL_KEYS[0];
  const toCandidate = ALL_KEYS.find((k) => k.key === toKey) || ALL_KEYS[0];

  let diff = (toCandidate.rootPitchClass - fromCandidate.rootPitchClass) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

const SHARP_SEMITONE_MAP: { step: Step; accidental: Accidental }[] = [
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

const FLAT_SEMITONE_MAP: { step: Step; accidental: Accidental }[] = [
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

/**
 * Transposes a single pitch by an arbitrary number of semitones
 */
export function transposePitch(pitch: Pitch, semitones: number, preferSharps = true): Pitch {
  const currentMidi = pitchToMidi(pitch);
  const newMidi = Math.max(21, Math.min(108, currentMidi + semitones));

  const octave = Math.floor(newMidi / 12) - 1;
  const pitchClass = newMidi % 12;

  const map = preferSharps ? SHARP_SEMITONE_MAP : FLAT_SEMITONE_MAP;
  const target = map[pitchClass];

  return {
    step: target.step,
    octave,
    accidental: target.accidental,
  };
}

/**
 * Transposes all notes in a Score by given semitones and optionally updates the key signature
 */
export function transposeScoreNotes(score: Score, semitones: number, newKey?: KeySignature): Score {
  if (semitones === 0 && (!newKey || newKey === score.keySignature)) {
    return score;
  }

  const targetKey = newKey || score.keySignature;
  const keyData = KEY_SIGNATURE_DATA[targetKey];
  const preferSharps = keyData ? keyData.type !== 'b' : true;

  const cloned = JSON.parse(JSON.stringify(score)) as Score;
  if (newKey) cloned.keySignature = newKey;

  cloned.staves.forEach((staff) => {
    staff.measures.forEach((measure) => {
      measure.items.forEach((item) => {
        if (item.type === 'note') {
          const pitches = getItemPitches(item);
          if (pitches.length > 0) {
            const transposed = pitches.map((p) => transposePitch(p, semitones, preferSharps));
            item.pitches = transposed;
            item.pitch = transposed[0];
          }
        }
        if (item.chord) {
          item.chord = transposeChord(item.chord, semitones, preferSharps);
        }
      });
    });
  });

  cloned.updatedAt = Date.now();
  return cloned;
}
