import { Score, KeySignature, Measure, ScoreItem, getItemPitches } from '../types/music';
import { ALL_KEYS, transposePitch } from './keyDetection';
import { transposeChord } from './chordUtils';
import { KEY_SIGNATURE_DATA } from '../constants/pitches';

export interface TranspositionPreset {
  id: string;
  name: string;
  shortLabel: string;
  semitones: number; // Semitones above concert pitch
  description: string;
}

export const TRANSPOSITION_PRESETS: TranspositionPreset[] = [
  {
    id: 'C',
    name: 'Tono de Concierto (Do)',
    shortLabel: 'Do (C)',
    semitones: 0,
    description: 'Flauta, Violín, Piano, Oboe, Trombón, Guitarrón, Vihuela',
  },
  {
    id: 'Bb',
    name: 'Instrumento en Si♭ (B♭)',
    shortLabel: 'Si♭ (+2)',
    semitones: 2,
    description: 'Trompeta en Si♭, Clarinete en Si♭, Saxofón Tenor, Soprano',
  },
  {
    id: 'Eb',
    name: 'Instrumento en Mi♭ (E♭)',
    shortLabel: 'Mi♭ (+9)',
    semitones: 9,
    description: 'Saxofón Alto, Saxofón Barítono, Clarinete Mi♭',
  },
  {
    id: 'F',
    name: 'Instrumento en Fa (F)',
    shortLabel: 'Fa (+7)',
    semitones: 7,
    description: 'Corno Francés (Trompa), Corno Inglés',
  },
];

/**
 * Calculates the transposed key signature given a concert key signature and transposition semitones
 */
export function getTransposedKeySignature(
  concertKey: KeySignature,
  transpositionSemitones: number
): KeySignature {
  if (transpositionSemitones === 0) return concertKey;

  const currentCandidate = ALL_KEYS.find((k) => k.key === concertKey);
  if (!currentCandidate) return concertKey;

  const newRoot = (currentCandidate.rootPitchClass + transpositionSemitones) % 12;

  // Find candidate with matching root and mode (major/minor)
  const matches = ALL_KEYS.filter(
    (k) => k.rootPitchClass === newRoot && k.isMajor === currentCandidate.isMajor
  );

  if (matches.length === 0) return concertKey;
  if (matches.length === 1) return matches[0].key;

  // If both enharmonics exist (e.g. F# vs Gb), choose the one with simpler accidentals
  const accCount = (k: KeySignature) => KEY_SIGNATURE_DATA[k]?.accidentals ?? 7;
  matches.sort((a, b) => accCount(a.key) - accCount(b.key));
  return matches[0].key;
}

/**
 * Creates a transposed clone of a staff's measures for particella viewing and printing
 */
export function transposeStaffMeasures(
  measures: Measure[],
  semitones: number,
  targetKeySignature?: KeySignature
): Measure[] {
  if (semitones === 0) return measures;

  const keyData = targetKeySignature ? KEY_SIGNATURE_DATA[targetKeySignature] : null;
  const preferSharps = keyData ? keyData.type !== 'b' : true;

  const cloned = JSON.parse(JSON.stringify(measures)) as Measure[];

  cloned.forEach((measure) => {
    measure.items.forEach((item: ScoreItem) => {
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

  return cloned;
}

/**
 * Extracts an isolated, standalone score for a specific staff (particella),
 * transposing its notes, chords, and key signature according to the instrument preset.
 */
export function extractPartScore(
  score: Score,
  staffIndex: number,
  transpositionPresetId?: string
): Score {
  const staff = score.staves[staffIndex];
  if (!staff) return score;

  let semitones = 0;
  if (transpositionPresetId) {
    const preset = TRANSPOSITION_PRESETS.find((p) => p.id === transpositionPresetId);
    if (preset) semitones = preset.semitones;
  } else if (typeof staff.transposition === 'number') {
    semitones = staff.transposition;
  }

  const targetKey = getTransposedKeySignature(score.keySignature, semitones);
  const transposedMeasures = transposeStaffMeasures(staff.measures, semitones, targetKey);

  return {
    ...score,
    id: `${score.id}-part-${staffIndex}`,
    title: `${score.title} - ${staff.name || `Parte ${staffIndex + 1}`}`,
    partName: staff.name,
    keySignature: targetKey,
    staves: [
      {
        ...staff,
        measures: transposedMeasures,
      },
    ],
  };
}
