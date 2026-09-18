import {
  Accidental,
  BarlineType,
  Clef,
  Dynamic,
  KeySignature,
  Measure,
  NavigationMark,
  NoteDuration,
  Ornament,
  Pitch,
  Score,
  ScoreItem,
  Staff,
  Step,
  TimeSignature,
} from '../types/music';
import {
  ACCIDENTAL_OFFSETS,
  DURATION_BEATS,
  KEY_SIGNATURE_DATA,
  STEPS,
} from '../constants/pitches';

/**
 * Versión del esquema de `Score`. Se sella en cada partitura normalizada para
 * poder migrarla cuando el modelo cambie.
 *
 * 1 — Estructura actual: `staves[]` > `measures[]` > `items[]`, símbolos
 *     musicales opcionales y `isGrandStaff` explícito.
 */
export const SCORE_SCHEMA_VERSION = 1;

/** Comprueba pertenencia sin caer en las claves heredadas de Object.prototype. */
const hasOwn = (source: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(source, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  return value.trim() ? value : undefined;
};

const asNumber = (value: unknown, fallback: number, min?: number, max?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
};

const asOptionalNumber = (value: unknown, min: number, max: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
};

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;

const asDuration = (value: unknown): NoteDuration | undefined =>
  typeof value === 'string' && hasOwn(DURATION_BEATS, value) ? (value as NoteDuration) : undefined;

const asAccidental = (value: unknown): Accidental => {
  if (value === null) return null;
  if (typeof value === 'string' && hasOwn(ACCIDENTAL_OFFSETS, value)) return value as Accidental;
  return null;
};

const asKeySignature = (value: unknown): KeySignature | undefined =>
  typeof value === 'string' && hasOwn(KEY_SIGNATURE_DATA, value)
    ? (value as KeySignature)
    : undefined;

const CLEFS: readonly Clef[] = ['treble', 'bass', 'alto'];
const BARLINES: readonly BarlineType[] = ['standard', 'double', 'final'];
const ORNAMENTS: readonly NonNullable<Ornament>[] = [
  'trill',
  'mordent',
  'turn',
  'arpeggio',
  'glissando',
];
const ARTICULATIONS = [
  'staccato',
  'accent',
  'tenuto',
  'fermata',
  'marcato',
  'staccatissimo',
  'downBow',
  'upBow',
  'harmonic',
  'portato',
] as const;
const DYNAMICS: readonly NonNullable<Dynamic>[] = [
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'sfz',
  'fp',
  'sfp',
  'rfz',
];
const NAVIGATION_MARKS: readonly NonNullable<NavigationMark>[] = [
  'segno',
  'coda',
  'daCapo',
  'dalSegno',
  'daCapoAlFine',
  'dalSegnoAlCoda',
  'toCoda',
  'fine',
];

/** Genera ids únicos: un archivo importado puede traer ids repetidos o vacíos. */
function createIdFactory(usedIds: Set<string>) {
  let counter = 0;
  const makeId = (prefix: string, preferred?: string): string => {
    const candidate = typeof preferred === 'string' ? preferred.trim() : '';
    if (candidate && !usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
    let generated: string;
    do {
      counter += 1;
      generated = `${prefix}-${counter}`;
    } while (usedIds.has(generated));
    usedIds.add(generated);
    return generated;
  };
  return makeId;
}

function normalizePitch(raw: unknown): Pitch | null {
  if (!isRecord(raw)) return null;
  const step = asEnum<Step>(raw.step, STEPS);
  if (!step) return null;
  const octave = asOptionalNumber(raw.octave, -1, 9);
  if (octave === undefined) return null;
  return { step, octave: Math.round(octave), accidental: asAccidental(raw.accidental) };
}

function normalizeTimeSignature(raw: unknown): TimeSignature | undefined {
  if (!isRecord(raw)) return undefined;
  const beats = asOptionalNumber(raw.beats, 1, 32);
  const beatType = asOptionalNumber(raw.beatType, 1, 32);
  if (beats === undefined || beatType === undefined) return undefined;
  return { beats: Math.round(beats), beatType: Math.round(beatType) };
}

function normalizeItem(
  raw: unknown,
  makeId: (prefix: string, preferred?: string) => string
): ScoreItem | null {
  if (!isRecord(raw)) return null;

  const duration = asDuration(raw.duration) ?? 'q';
  const requestedType = asEnum(raw.type, ['note', 'rest'] as const) ?? 'rest';

  const pitches = Array.isArray(raw.pitches)
    ? raw.pitches.map(normalizePitch).filter((p): p is Pitch => p !== null)
    : [];
  const singlePitch = normalizePitch(raw.pitch);
  const resolvedPitches = pitches.length > 0 ? pitches : singlePitch ? [singlePitch] : [];

  // Una nota sin altura no se puede dibujar ni sonar: se degrada a silencio
  // antes que perder el valor rítmico que escribió el usuario.
  const type: ScoreItem['type'] =
    requestedType === 'note' && resolvedPitches.length === 0 ? 'rest' : requestedType;

  const item: ScoreItem = {
    id: makeId('item', asString(raw.id)),
    type,
    duration,
  };

  if (type === 'note') {
    item.pitches = resolvedPitches;
    item.pitch = resolvedPitches[0];
  }

  const dotted = asBoolean(raw.isDotted);
  if (dotted) item.isDotted = true;
  const tied = asBoolean(raw.isTied);
  if (tied) item.isTied = true;

  const slur = asEnum(raw.slur, ['start', 'stop'] as const);
  if (slur) item.slur = slur;

  if (isRecord(raw.tuplet)) {
    const actual = asOptionalNumber(raw.tuplet.actual, 1, 16);
    const normal = asOptionalNumber(raw.tuplet.normal, 1, 16);
    if (actual !== undefined && normal !== undefined) {
      item.tuplet = { actual: Math.round(actual), normal: Math.round(normal) };
    }
  }

  const articulation = asEnum(raw.articulation, ARTICULATIONS);
  if (articulation) item.articulation = articulation;

  const ornament = asEnum(raw.ornament, ORNAMENTS);
  if (ornament) item.ornament = ornament;

  const dynamic = asEnum(raw.dynamic, DYNAMICS);
  if (dynamic) item.dynamic = dynamic;

  const hairpin = asEnum(raw.hairpin, ['cresc', 'decresc', 'stop'] as const);
  if (hairpin) item.hairpin = hairpin;

  const noteType = asEnum(raw.noteType, ['standard', 'grace', 'slash'] as const);
  if (noteType) item.noteType = noteType;

  const graceType = asEnum(raw.graceType, ['acciaccatura', 'appoggiatura'] as const);
  if (graceType) item.graceType = graceType;

  const fingering = asOptionalNumber(raw.fingering, 1, 5);
  if (fingering !== undefined) item.fingering = Math.round(fingering);

  const pedal = asEnum(raw.pedal, ['start', 'stop'] as const);
  if (pedal) item.pedal = pedal;

  const lyric = asOptionalString(raw.lyric);
  if (lyric) item.lyric = lyric;
  const chord = asOptionalString(raw.chord);
  if (chord) item.chord = chord;

  return item;
}

function normalizeMeasure(
  raw: unknown,
  makeId: (prefix: string, preferred?: string) => string
): Measure {
  const source = isRecord(raw) ? raw : {};
  const items = Array.isArray(source.items)
    ? source.items
        .map((item) => normalizeItem(item, makeId))
        .filter((item): item is ScoreItem => item !== null)
    : [];

  const measure: Measure = {
    id: makeId('m', asString(source.id)),
    items: items.length > 0 ? items : [{ id: makeId('item'), type: 'rest', duration: 'w' }],
  };

  if (asBoolean(source.repeatStart)) measure.repeatStart = true;
  if (asBoolean(source.repeatEnd)) measure.repeatEnd = true;
  const repeatCount = asOptionalNumber(source.repeatCount, 2, 32);
  if (repeatCount !== undefined) measure.repeatCount = Math.round(repeatCount);

  const volta = asOptionalString(source.volta);
  if (volta) measure.volta = volta;
  const barline = asEnum(source.barline, BARLINES);
  if (barline) measure.barline = barline;
  const navigationMark = asEnum(source.navigationMark, NAVIGATION_MARKS);
  if (navigationMark) measure.navigationMark = navigationMark;
  const rehearsalMark = asOptionalString(source.rehearsalMark);
  if (rehearsalMark) measure.rehearsalMark = rehearsalMark;

  if (asBoolean(source.isMeasureRepeat)) measure.isMeasureRepeat = true;
  if (asBoolean(source.caesura)) measure.caesura = true;
  if (asBoolean(source.breathMark)) measure.breathMark = true;
  if (asBoolean(source.systemBreak)) measure.systemBreak = true;
  if (asBoolean(source.pageBreak)) measure.pageBreak = true;

  const tempoText = asOptionalString(source.tempoText);
  if (tempoText) measure.tempoText = tempoText;
  const tempoBpm = asOptionalNumber(source.tempoBpm, 30, 300);
  if (tempoBpm !== undefined) measure.tempoBpm = Math.round(tempoBpm);

  const timeSignatureChange = normalizeTimeSignature(source.timeSignatureChange);
  if (timeSignatureChange) measure.timeSignatureChange = timeSignatureChange;
  const keySignatureChange = asKeySignature(source.keySignatureChange);
  if (keySignatureChange) measure.keySignatureChange = keySignatureChange;

  if (asBoolean(source.isAnacrusis)) {
    measure.isAnacrusis = true;
    measure.pickupBeats = asOptionalNumber(source.pickupBeats, 0.25, 32) ?? 1;
  }

  const multimeasureRest = asOptionalNumber(source.multimeasureRest, 2, 64);
  if (multimeasureRest !== undefined) measure.multimeasureRest = Math.round(multimeasureRest);

  return measure;
}

function normalizeStaff(
  raw: unknown,
  makeId: (prefix: string, preferred?: string) => string
): Staff | null {
  if (!isRecord(raw)) return null;

  const measures = Array.isArray(raw.measures)
    ? raw.measures.map((measure) => normalizeMeasure(measure, makeId))
    : [];

  const name = asOptionalString(raw.name);
  const staff: Staff = {
    id: makeId('staff', asString(raw.id)),
    name: name ?? 'Voz',
    clef: asEnum(raw.clef, CLEFS) ?? 'treble',
    measures: measures.length > 0 ? measures : [normalizeMeasure({}, makeId)],
  };

  const shortName = asOptionalString(raw.shortName);
  if (shortName) staff.shortName = shortName;
  const transposition = asOptionalNumber(raw.transposition, -24, 24);
  if (transposition !== undefined) staff.transposition = Math.round(transposition);

  return staff;
}

/**
 * Valida y repara una partitura de origen no confiable (localStorage, un archivo
 * importado o un enlace compartido). Devuelve `null` solo cuando no hay ninguna
 * partitura recuperable, para que quien llame decida el respaldo.
 *
 * La reparación es deliberadamente conservadora: rellena huecos y descarta
 * símbolos inválidos, pero nunca elimina material del usuario.
 */
export function normalizeScore(raw: unknown): Score | null {
  if (!isRecord(raw)) return null;

  const staves = Array.isArray(raw.staves) ? raw.staves : [];
  if (staves.length === 0) return null;

  const usedIds = new Set<string>();
  const makeId = createIdFactory(usedIds);

  const normalizedStaves = staves
    .map((staff) => normalizeStaff(staff, makeId))
    .filter((staff): staff is Staff => staff !== null);
  if (normalizedStaves.length === 0) return null;

  const now = Date.now();
  const score: Score = {
    id: asString(raw.id) || `score-${now}`,
    title: asString(raw.title) || 'Partitura sin título',
    composer: asString(raw.composer) || 'Anónimo',
    tempo: Math.round(asNumber(raw.tempo, 120, 30, 300)),
    timeSignature: normalizeTimeSignature(raw.timeSignature) ?? { beats: 4, beatType: 4 },
    keySignature: asKeySignature(raw.keySignature) ?? 'C',
    staves: normalizedStaves,
    createdAt: asNumber(raw.createdAt, now),
    updatedAt: asNumber(raw.updatedAt, now),
    schemaVersion: SCORE_SCHEMA_VERSION,
  };

  const subtitle = asOptionalString(raw.subtitle);
  if (subtitle) score.subtitle = subtitle;
  const lyricist = asOptionalString(raw.lyricist);
  if (lyricist) score.lyricist = lyricist;
  const partName = asOptionalString(raw.partName);
  if (partName) score.partName = partName;
  const copyright = asOptionalString(raw.copyright);
  if (copyright) score.copyright = copyright;

  // Migración: antes de existir la bandera, un gran pentagrama se reconocía
  // porque el toggle renombraba el par. Se sella aquí para dejar de depender
  // de los nombres (ver isPianoGrandStaff).
  if (asBoolean(raw.isGrandStaff)) {
    score.isGrandStaff = true;
  } else if (
    normalizedStaves.length === 2 &&
    normalizedStaves[0].name.trim().toLowerCase() === 'mano derecha' &&
    normalizedStaves[1].name.trim().toLowerCase() === 'mano izquierda'
  ) {
    score.isGrandStaff = true;
  }

  return score;
}
