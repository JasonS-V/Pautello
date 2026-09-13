import { Pitch, Clef, Accidental, Step } from '../types/music';

// Step sequence from C0 upwards: 7 steps per octave
const DIATONIC_ORDER: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function diatonicAbsoluteStep(step: Step, octave: number): number {
  const stepIdx = DIATONIC_ORDER.indexOf(step);
  return octave * 7 + stepIdx;
}

function absoluteStepToPitch(absStep: number, accidental: Accidental = null): Pitch {
  const octave = Math.floor(absStep / 7);
  let stepIdx = absStep % 7;
  if (stepIdx < 0) {
    stepIdx += 7;
  }
  return {
    step: DIATONIC_ORDER[stepIdx],
    octave,
    accidental
  };
}

// Reference pitches for line 0 (top line of the 5 staff lines)
// Treble line 0 = F5
const TREBLE_LINE_0_ABS = diatonicAbsoluteStep('F', 5);
// Bass line 0 = A3
const BASS_LINE_0_ABS = diatonicAbsoluteStep('A', 3);
// Alto line 0 = G4
const ALTO_LINE_0_ABS = diatonicAbsoluteStep('G', 4);

/**
 * Returns vertical staff step relative to line 0 (0 = top line).
 * Higher pitch = smaller or negative value (higher up).
 * Lower pitch = larger positive value (lower down).
 * Each unit corresponds to a half-space (e.g. line to adjacent space = 1 unit).
 */
export function pitchToStaffStep(pitch: Pitch, clef: Clef): number {
  const pitchAbs = diatonicAbsoluteStep(pitch.step, pitch.octave);
  let refLine0 = TREBLE_LINE_0_ABS;
  if (clef === 'bass') refLine0 = BASS_LINE_0_ABS;
  else if (clef === 'alto') refLine0 = ALTO_LINE_0_ABS;

  return refLine0 - pitchAbs;
}

/**
 * Inverts staff step back into a Pitch
 */
export function staffStepToPitch(stepValue: number, clef: Clef, accidental: Accidental = null): Pitch {
  let refLine0 = TREBLE_LINE_0_ABS;
  if (clef === 'bass') refLine0 = BASS_LINE_0_ABS;
  else if (clef === 'alto') refLine0 = ALTO_LINE_0_ABS;

  const targetAbs = refLine0 - stepValue;
  return absoluteStepToPitch(targetAbs, accidental);
}

/**
 * Converts a Y pixel offset relative to staff top into the nearest staff step
 * @param yOffset pixels from staff top line
 * @param lineSpacing pixels between two lines (e.g. 10px)
 */
export function yToStaffStep(yOffset: number, lineSpacing: number = 10): number {
  const halfSpacing = lineSpacing / 2;
  return Math.round(yOffset / halfSpacing);
}

/**
 * Converts a staff step into pixel Y offset relative to staff top line
 */
export function staffStepToY(step: number, lineSpacing: number = 10): number {
  return step * (lineSpacing / 2);
}

/**
 * Returns ledger lines needed for a note at given staff step.
 * Even steps >= 10 get ledger lines below (10, 12, 14...)
 * Even steps <= -2 get ledger lines above (-2, -4, -6...)
 */
export function getLedgerLines(step: number): number[] {
  const lines: number[] = [];
  if (step >= 10) {
    // Note is at or below middle C (step 10 in treble clef).
    // For step 10 (C4) or step 11 (B3), line at 10.
    // For step 12 (A3) or step 13 (G3), lines at 10 and 12.
    const maxLine = step % 2 === 0 ? step : step - 1;
    for (let l = 10; l <= maxLine; l += 2) {
      lines.push(l);
    }
  } else if (step <= -2) {
    // Note is at or above A5 (step -2 in treble clef).
    // For step -2 (A5) or step -3 (B5), line at -2.
    // For step -4 (C6) or step -5 (D6), lines at -2 and -4.
    const minLine = step % 2 === 0 ? step : step + 1;
    for (let l = -2; l >= minLine; l -= 2) {
      lines.push(l);
    }
  }
  return lines;
}
