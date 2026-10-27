import {
  Accidental,
  BarlineType,
  Clef,
  KeySignature,
  Measure,
  NoteDuration,
  Pitch,
  Score,
  ScoreItem,
  Staff,
  TimeSignature,
  TupletInfo,
} from '../types/music';
import { pitchToMidi } from '../constants/pitches';
import { detectKeyFromScore } from '../utils/keyDetection';
import { normalizeScore } from '../utils/scoreSchema';
import { OmrClefIR, OmrDurationIR, OmrPitchIR, OmrScoreIR } from './omrDecode';

export interface OmrMetadataHints {
  title?: string;
  subtitle?: string;
  composer?: string;
  lyricist?: string;
  tempo?: number;
  lyrics?: string[];
  chords?: string[];
}

export interface OmrConversionSummary {
  score: Score;
  averageConfidence: number;
  measuresCount: number;
  notesCount: number;
  stavesCount: number;
}

const FIFTHS_TO_MAJOR: Readonly<Record<number, KeySignature>> = {
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
  [-1]: 'F',
  [-2]: 'Bb',
  [-3]: 'Eb',
  [-4]: 'Ab',
  [-5]: 'Db',
  [-6]: 'Gb',
  [-7]: 'Cb',
};

const FIFTHS_TO_MINOR: Readonly<Record<number, KeySignature>> = {
  0: 'Am',
  1: 'Em',
  2: 'Bm',
  3: 'F#m',
  4: 'C#m',
  5: 'G#m',
  6: 'D#m',
  [-1]: 'Dm',
  [-2]: 'Gm',
  [-3]: 'Cm',
  [-4]: 'Fm',
  [-5]: 'Bbm',
  [-6]: 'Ebm',
};

function mapDuration(dur: OmrDurationIR): {
  duration: NoteDuration;
  isDotted?: boolean;
  tuplet?: TupletInfo;
} {
  const isDotted = dur.dots > 0 ? true : undefined;
  switch (dur.base) {
    case '0':
    case '1':
      return { duration: 'w', isDotted };
    case '2':
      return { duration: 'h', isDotted };
    case '4':
      return { duration: 'q', isDotted };
    case '8':
      return { duration: '8', isDotted };
    case '16':
      return { duration: '16', isDotted };
    case '32':
      return { duration: '32', isDotted };
    case '3':
      return { duration: 'h', tuplet: { actual: 3, normal: 2 } };
    case '6':
      return { duration: 'q', tuplet: { actual: 3, normal: 2 } };
    case '12':
      return { duration: '8', tuplet: { actual: 3, normal: 2 } };
    case '24':
      return { duration: '16', tuplet: { actual: 3, normal: 2 } };
    default:
      return { duration: 'q', isDotted };
  }
}

function mapPitch(p: OmrPitchIR): Pitch {
  let accidental: Accidental = null;
  if (p.rawToken === '##' || p.alter === 2) accidental = '##';
  else if (p.rawToken === '--' || p.alter === -2) accidental = 'bb';
  else if (p.rawToken === '#' || p.alter === 1) accidental = '#';
  else if (p.rawToken === '-' || p.alter === -1) accidental = 'b';
  else if (p.rawToken === 'n') accidental = 'n';

  return {
    step: p.step,
    octave: Math.max(1, Math.min(7, p.octave)),
    accidental,
  };
}

function mapClef(clefIr: OmrClefIR | undefined, clefStr: string | null | undefined): Clef | null {
  if (clefIr) {
    const s = clefIr.sign.toUpperCase();
    if (s === 'F') return 'bass';
    if (s === 'C') return 'alto';
    if (s === 'G') return 'treble';
  }
  if (clefStr) {
    const upper = clefStr.toUpperCase();
    if (upper.startsWith('F')) return 'bass';
    if (upper.startsWith('C')) return 'alto';
    if (upper.startsWith('G')) return 'treble';
  }
  return null;
}

function inferClefFromItems(measures: Measure[]): Clef {
  const midis: number[] = [];
  for (const m of measures) {
    for (const it of m.items) {
      if (it.type === 'note' && it.pitch) {
        midis.push(pitchToMidi(it.pitch));
      }
    }
  }
  if (midis.length === 0) return 'treble';
  midis.sort((a, b) => a - b);
  const median = midis[Math.floor(midis.length / 2)];
  return median < 55 ? 'bass' : 'treble';
}

function defaultStaffNames(count: number, clefs: Clef[]): Array<{ name: string; shortName: string }> {
  if (count === 1) {
    return [{ name: 'Voz / Melodía', shortName: 'Voz' }];
  }
  if (count === 2 && clefs[0] === 'treble' && clefs[1] === 'bass') {
    return [
      { name: 'Mano Derecha', shortName: 'M.D.' },
      { name: 'Mano Izquierda', shortName: 'M.I.' },
    ];
  }
  if (count === 4) {
    return [
      { name: 'Soprano', shortName: 'S.' },
      { name: 'Contralto', shortName: 'A.' },
      { name: 'Tenor', shortName: 'T.' },
      { name: 'Bajo', shortName: 'B.' },
    ];
  }
  return Array.from({ length: count }, (_, i) => ({
    name: `Pentagrama ${i + 1}`,
    shortName: `P.${i + 1}`,
  }));
}

/**
 * Convierte la representación intermedia `OmrScoreIR` en un objeto `Score` de Pautello.
 */
export function convertOmrIrToScore(
  ir: OmrScoreIR,
  hints: OmrMetadataHints = {}
): OmrConversionSummary {
  const confidences: number[] = [];
  let notesCount = 0;

  const rawTime = ir.structure.recognized.time;
  const timeSignature: TimeSignature =
    rawTime && rawTime.num >= 1 && rawTime.num <= 16 && [2, 4, 8, 16].includes(rawTime.den)
      ? { beats: rawTime.num, beatType: rawTime.den }
      : { beats: 4, beatType: 4 };

  const recognizedFifths = ir.structure.recognized.keyFifths;
  const clampedFifths =
    recognizedFifths !== null && recognizedFifths !== undefined
      ? Math.max(-7, Math.min(7, recognizedFifths))
      : null;

  let lyricCursor = 0;
  let chordCursor = 0;

  const staves: Staff[] = ir.parts.map((part, pIdx) => {
    let explicitClef: Clef | null = mapClef(undefined, ir.structure.recognized.clefs[pIdx]);
    let carryRepeatStart = false;

    const measures: Measure[] = part.measures.map((mIr, mIdx) => {
      if (!explicitClef && mIr.attributes?.clef) {
        explicitClef = mapClef(mIr.attributes.clef, null);
      }

      const items: ScoreItem[] = mIr.events.map((ev, evIdx) => {
        confidences.push(ev.confidence);
        const { duration, isDotted, tuplet } = mapDuration(ev.duration);

        if (ev.kind === 'rest') {
          return {
            id: `omr-rest-${pIdx}-${mIdx}-${evIdx}`,
            type: 'rest',
            duration,
            isDotted,
            tuplet,
          };
        }

        notesCount++;
        const mappedPitches =
          ev.pitches && ev.pitches.length > 0
            ? ev.pitches.map(mapPitch)
            : ev.pitch
              ? [mapPitch(ev.pitch)]
              : [{ step: 'C' as const, octave: 4, accidental: null }];

        const isTied = ev.tie === 'start' || ev.tie === 'continue' ? true : undefined;
        const lyric =
          pIdx === 0 && hints.lyrics && lyricCursor < hints.lyrics.length
            ? hints.lyrics[lyricCursor++]
            : undefined;
        const chord =
          pIdx === 0 && evIdx === 0 && hints.chords && chordCursor < hints.chords.length
            ? hints.chords[chordCursor++]
            : undefined;

        return {
          id: `omr-note-${pIdx}-${mIdx}-${evIdx}`,
          type: 'note',
          pitch: mappedPitches[0],
          pitches: mappedPitches,
          duration,
          isDotted,
          tuplet,
          isTied,
          slur: ev.slur,
          articulation: ev.fermata ? 'fermata' : undefined,
          lyric,
          chord,
        };
      });

      const finalItems: ScoreItem[] =
        items.length > 0
          ? items
          : [
              {
                id: `omr-empty-rest-${pIdx}-${mIdx}`,
                type: 'rest',
                duration: 'w',
              },
            ];

      let barline: BarlineType | undefined = undefined;
      let repeatStart = carryRepeatStart ? true : undefined;
      let repeatEnd: boolean | undefined = undefined;
      carryRepeatStart = false;

      const bType = mIr.barline?.type;
      if (bType === 'double') barline = 'double';
      else if (bType === 'final') barline = 'final';
      else if (bType === 'repeat-start') repeatStart = true;
      else if (bType === 'repeat-end' || bType === 'final-repeat-end') {
        repeatEnd = true;
        if (bType === 'final-repeat-end') barline = 'final';
      } else if (bType === 'repeat-both') {
        repeatEnd = true;
        carryRepeatStart = true;
      }

      let timeSignatureChange: TimeSignature | undefined = undefined;
      if (
        mIdx > 0 &&
        mIr.attributes?.time &&
        mIr.attributes.time.num >= 1 &&
        [2, 4, 8, 16].includes(mIr.attributes.time.den)
      ) {
        if (
          mIr.attributes.time.num !== timeSignature.beats ||
          mIr.attributes.time.den !== timeSignature.beatType
        ) {
          timeSignatureChange = {
            beats: mIr.attributes.time.num,
            beatType: mIr.attributes.time.den,
          };
        }
      }

      return {
        id: `omr-meas-${pIdx}-${mIdx}`,
        items: finalItems,
        barline,
        repeatStart,
        repeatEnd,
        timeSignatureChange,
      };
    });

    // Filtrar compases finales vacíos residuales tras la última barra si no tienen notas reales
    while (
      measures.length > 1 &&
      measures[measures.length - 1].items.length === 1 &&
      measures[measures.length - 1].items[0].type === 'rest' &&
      measures[measures.length - 1].items[0].id.startsWith('omr-empty-rest-')
    ) {
      measures.pop();
    }

    const clef = explicitClef ?? inferClefFromItems(measures);
    return {
      id: `staff-omr-${pIdx + 1}`,
      name: part.label || `Pentagrama ${pIdx + 1}`,
      clef,
      measures:
        measures.length > 0
          ? measures
          : [
              {
                id: `omr-meas-${pIdx}-0`,
                items: [{ id: `omr-rest-${pIdx}-0-0`, type: 'rest', duration: 'w' }],
              },
            ],
    };
  });

  if (staves.length === 0) {
    staves.push({
      id: 'staff-omr-1',
      name: 'Voz / Melodía',
      clef: 'treble',
      measures: [
        {
          id: 'omr-meas-0-0',
          items: [{ id: 'omr-rest-0-0-0', type: 'rest', duration: 'w' }],
        },
      ],
    });
  }

  // Igualar longitud de compases entre todos los pentagramas del sistema
  const maxMeasures = Math.max(1, ...staves.map((s) => s.measures.length));
  for (let sIdx = 0; sIdx < staves.length; sIdx++) {
    const st = staves[sIdx];
    while (st.measures.length < maxMeasures) {
      const mIdx = st.measures.length;
      st.measures.push({
        id: `omr-pad-meas-${sIdx}-${mIdx}`,
        items: [{ id: `omr-pad-rest-${sIdx}-${mIdx}`, type: 'rest', duration: 'w' }],
      });
    }
  }

  // Asignar nombres canónicos según plantilla instrumental
  const names = defaultStaffNames(
    staves.length,
    staves.map((s) => s.clef)
  );
  staves.forEach((st, idx) => {
    st.name = names[idx].name;
    st.shortName = names[idx].shortName;
  });

  const isGrandStaff =
    staves.length === 2 && staves[0].clef === 'treble' && staves[1].clef === 'bass';

  const preliminaryScore: Score = {
    id: `score-omr-${Date.now()}`,
    title: hints.title?.trim() || 'Partitura Reconocida (OMR)',
    subtitle: hints.subtitle?.trim() || undefined,
    composer: hints.composer?.trim() || 'Autor Desconocido',
    lyricist: hints.lyricist?.trim() || undefined,
    tempo: hints.tempo && hints.tempo >= 30 && hints.tempo <= 300 ? hints.tempo : 120,
    timeSignature,
    keySignature: clampedFifths !== null ? FIFTHS_TO_MAJOR[clampedFifths] || 'C' : 'C',
    staves,
    isGrandStaff: isGrandStaff || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Refinar tonalidad mayor vs menor relativo con Krumhansl-Schmuckler
  const detectedKeyInfo = detectKeyFromScore(preliminaryScore);
  if (clampedFifths !== null) {
    const majorCandidate = FIFTHS_TO_MAJOR[clampedFifths] || 'C';
    const minorCandidate = FIFTHS_TO_MINOR[clampedFifths];
    if (minorCandidate && detectedKeyInfo.key === minorCandidate) {
      preliminaryScore.keySignature = minorCandidate;
    } else {
      preliminaryScore.keySignature = majorCandidate;
    }
  } else {
    preliminaryScore.keySignature = detectedKeyInfo.key;
  }

  const normalized = normalizeScore(preliminaryScore) ?? preliminaryScore;

  const avgConf =
    confidences.length > 0
      ? Math.round(
          (confidences.reduce((acc, v) => acc + v, 0) / confidences.length) * 100
        )
      : 85;

  return {
    score: normalized,
    averageConfidence: Math.max(1, Math.min(100, avgConf)),
    measuresCount: maxMeasures,
    notesCount,
    stavesCount: staves.length,
  };
}
