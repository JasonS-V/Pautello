import { Pitch } from '../types/music';
import { pitchToMidi } from '../constants/pitches';

export interface GuitarTabPosition {
  stringNumber: number; // 1 = High E (prima), 6 = Low E (bordón)
  fret: number; // 0 (open) to 22
}

export interface GuitarStringDef {
  stringNumber: number;
  openMidi: number;
  name: string;
}

export const GUITAR_STRINGS: GuitarStringDef[] = [
  { stringNumber: 1, openMidi: 64, name: 'E4' }, // 1st string (High E)
  { stringNumber: 2, openMidi: 59, name: 'B3' }, // 2nd string (B)
  { stringNumber: 3, openMidi: 55, name: 'G3' }, // 3rd string (G)
  { stringNumber: 4, openMidi: 50, name: 'D3' }, // 4th string (D)
  { stringNumber: 5, openMidi: 45, name: 'A2' }, // 5th string (A)
  { stringNumber: 6, openMidi: 40, name: 'E2' }, // 6th string (Low E)
];

/**
 * Returns all possible guitar string and fret combinations for a MIDI note number
 */
export function getPossibleGuitarPositions(
  midi: number,
  maxFret: number = 22
): GuitarTabPosition[] {
  const positions: GuitarTabPosition[] = [];

  for (const str of GUITAR_STRINGS) {
    const fret = midi - str.openMidi;
    if (fret >= 0 && fret <= maxFret) {
      positions.push({ stringNumber: str.stringNumber, fret });
    }
  }

  return positions;
}

/**
 * Picks the most ergonomic and standard guitar tab position (string & fret) for a Pitch
 * Prioritizes first position (frets 0-5) and open strings as taught in standard guitar pedagogy.
 */
export function pitchToGuitarTab(
  pitch: Pitch,
  maxFret: number = 20
): GuitarTabPosition | null {
  const midi = pitchToMidi(pitch);
  const possible = getPossibleGuitarPositions(midi, maxFret);

  if (possible.length === 0) {
    return null;
  }

  // Sort by ergonomic scoring:
  // Open strings (fret 0) and low frets (1-5) are heavily preferred
  possible.sort((a, b) => {
    const scoreA =
      a.fret === 0
        ? 0
        : (a.fret <= 5 ? a.fret : a.fret * 1.6) + (a.stringNumber - 1) * 0.15;
    const scoreB =
      b.fret === 0
        ? 0
        : (b.fret <= 5 ? b.fret : b.fret * 1.6) + (b.stringNumber - 1) * 0.15;
    return scoreA - scoreB;
  });

  return possible[0] || null;
}
