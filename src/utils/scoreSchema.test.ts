import { describe, it, expect } from 'vitest';
import { DURATION_BEATS, KEY_SIGNATURE_DATA } from '../constants/pitches';
import { isPianoGrandStaff, Score, ScoreItem } from '../types/music';
import { SCORE_SCHEMA_VERSION, normalizeScore } from './scoreSchema';

const note = (overrides: Partial<ScoreItem> = {}): ScoreItem => ({
  id: 'item-1',
  type: 'note',
  pitch: { step: 'C', octave: 4, accidental: null },
  duration: 'q',
  ...overrides,
});

const validScore = (): Score => ({
  id: 'score-1',
  title: 'Oda a la Alegría',
  composer: 'Beethoven',
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  staves: [
    {
      id: 'staff-1',
      name: 'Violín',
      clef: 'treble',
      measures: [{ id: 'm-1', items: [note()] }],
    },
  ],
  createdAt: 1000,
  updatedAt: 2000,
});

const firstItem = (score: Score): ScoreItem => score.staves[0].measures[0].items[0];

describe('normalizeScore: partituras válidas', () => {
  it('conserva el material de una partitura correcta', () => {
    const score = normalizeScore(validScore())!;

    expect(score.title).toBe('Oda a la Alegría');
    expect(score.composer).toBe('Beethoven');
    expect(score.tempo).toBe(120);
    expect(score.keySignature).toBe('C');
    expect(score.staves).toHaveLength(1);
    expect(score.staves[0].name).toBe('Violín');
    expect(score.staves[0].clef).toBe('treble');
    expect(score.staves[0].measures[0].items).toHaveLength(1);
    expect(firstItem(score)).toMatchObject({ id: 'item-1', type: 'note', duration: 'q' });
    expect(firstItem(score).pitch).toEqual({ step: 'C', octave: 4, accidental: null });
  });

  it('conserva createdAt y updatedAt', () => {
    const score = normalizeScore(validScore())!;
    expect(score.createdAt).toBe(1000);
    expect(score.updatedAt).toBe(2000);
  });

  it('sella la versión del esquema', () => {
    expect(normalizeScore(validScore())!.schemaVersion).toBe(SCORE_SCHEMA_VERSION);
    expect(normalizeScore({ ...validScore(), schemaVersion: 0 })!.schemaVersion).toBe(
      SCORE_SCHEMA_VERSION
    );
  });

  it('es idempotente', () => {
    const once = normalizeScore(validScore())!;
    const twice = normalizeScore(once)!;
    expect(twice).toEqual(once);
  });
});

describe('normalizeScore: datos irrecuperables', () => {
  it('rechaza valores que no son un objeto', () => {
    expect(normalizeScore(null)).toBeNull();
    expect(normalizeScore(undefined)).toBeNull();
    expect(normalizeScore('partitura')).toBeNull();
    expect(normalizeScore(42)).toBeNull();
    expect(normalizeScore([validScore()])).toBeNull();
  });

  it('rechaza una partitura sin pentagramas utilizables', () => {
    expect(normalizeScore({})).toBeNull();
    expect(normalizeScore({ staves: [] })).toBeNull();
    expect(normalizeScore({ staves: 'Violín' })).toBeNull();
    expect(normalizeScore({ staves: ['Violín', 7, null] })).toBeNull();
  });
});

describe('normalizeScore: valores por defecto', () => {
  it('rellena los campos obligatorios que falten', () => {
    const score = normalizeScore({ staves: [{}] })!;

    expect(score.id).toBeTruthy();
    expect(score.title).toBe('Partitura sin título');
    expect(score.composer).toBe('Anónimo');
    expect(score.tempo).toBe(120);
    expect(score.timeSignature).toEqual({ beats: 4, beatType: 4 });
    expect(score.keySignature).toBe('C');
    expect(score.createdAt).toBeGreaterThan(0);
    expect(score.staves[0].clef).toBe('treble');
    expect(score.staves[0].measures).toHaveLength(1);
  });

  it('acota el tempo a un rango musical y lo redondea', () => {
    expect(normalizeScore({ staves: [{}], tempo: 9999 })!.tempo).toBe(300);
    expect(normalizeScore({ staves: [{}], tempo: 0 })!.tempo).toBe(30);
    expect(normalizeScore({ staves: [{}], tempo: 120.6 })!.tempo).toBe(121);
    expect(normalizeScore({ staves: [{}], tempo: Number.NaN })!.tempo).toBe(120);
    expect(normalizeScore({ staves: [{}], tempo: 'rápido' })!.tempo).toBe(120);
  });

  it('descarta un compás de compás inválido en lugar de romper la app', () => {
    const score = normalizeScore({ staves: [{}], timeSignature: { beats: 'x', beatType: null } })!;
    expect(score.timeSignature).toEqual({ beats: 4, beatType: 4 });
  });
});

describe('normalizeScore: dominios cerrados', () => {
  it('reemplaza símbolos fuera del dominio por su valor seguro', () => {
    const score = normalizeScore({
      staves: [
        {
          clef: 'soprano',
          measures: [
            {
              barline: 'triple',
              navigationMark: 'Solo',
              barline2: undefined,
              items: [{ type: 'note', duration: 'tu', articulation: 'golpe' }],
            },
          ],
        },
      ],
    })!;

    expect(score.staves[0].clef).toBe('treble');
    expect(score.staves[0].measures[0].barline).toBeUndefined();
    expect(score.staves[0].measures[0].navigationMark).toBeUndefined();
    expect(firstItem(score).duration).toBe('q');
    expect(firstItem(score).articulation).toBeUndefined();
  });

  it('rechaza los nombres heredados de Object.prototype como figuras', () => {
    const score = normalizeScore({
      staves: [{ measures: [{ items: [{ duration: 'toString' }] }] }],
    })!;
    expect(firstItem(score).duration).toBe('q');
  });

  it('acepta todas las figuras y tonalidades del modelo', () => {
    const durations = Object.keys(DURATION_BEATS) as Array<keyof typeof DURATION_BEATS>;
    durations.forEach((duration) => {
      const score = normalizeScore({ staves: [{ measures: [{ items: [{ duration }] }] }] })!;
      expect(firstItem(score).duration).toBe(duration);
    });

    const keys = Object.keys(KEY_SIGNATURE_DATA) as Array<keyof typeof KEY_SIGNATURE_DATA>;
    keys.forEach((keySignature) => {
      expect(normalizeScore({ staves: [{}], keySignature })!.keySignature).toBe(keySignature);
    });
  });

  it('rechaza una tonalidad desconocida', () => {
    expect(normalizeScore({ staves: [{}], keySignature: 'H' })!.keySignature).toBe('C');
    expect(normalizeScore({ staves: [{}], keySignature: 'toString' })!.keySignature).toBe('C');
  });

  it('conserva los símbolos válidos de la nota', () => {
    const score = normalizeScore({
      staves: [
        {
          measures: [
            {
              items: [
                {
                  type: 'note',
                  duration: '8',
                  isDotted: true,
                  isTied: true,
                  tuplet: { actual: 3, normal: 2 },
                  articulation: 'staccato',
                  dynamic: 'mf',
                  hairpin: 'cresc',
                  lyric: 'A-le',
                  chord: 'C/E',
                  fingering: 3,
                },
              ],
            },
          ],
        },
      ],
    })!;

    expect(firstItem(score)).toMatchObject({
      duration: '8',
      isDotted: true,
      isTied: true,
      tuplet: { actual: 3, normal: 2 },
      articulation: 'staccato',
      dynamic: 'mf',
      hairpin: 'cresc',
      lyric: 'A-le',
      chord: 'C/E',
      fingering: 3,
    });
  });

  it('no deja banderas en falso en el JSON normalizado', () => {
    const score = normalizeScore({
      staves: [{ measures: [{ items: [{ isDotted: false, isTied: false }] }] }],
    })!;
    expect('isDotted' in firstItem(score)).toBe(false);
    expect('isTied' in firstItem(score)).toBe(false);
  });
});

describe('normalizeScore: notas y silencios', () => {
  it('degrada a silencio una nota sin altura válida, conservando la duración', () => {
    const items = [
      { type: 'note', duration: 'h', pitch: { step: 'H', octave: 4 } },
      { type: 'note', duration: '8', pitch: { step: 'C', octave: 'x' } },
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'w', pitch: { step: 'C', octave: 4 } },
    ];
    const score = normalizeScore({ staves: [{ measures: [{ items }] }] })!;
    const normalized = score.staves[0].measures[0].items;

    expect(normalized[0]).toMatchObject({ type: 'rest', duration: 'h' });
    expect(normalized[1]).toMatchObject({ type: 'rest', duration: '8' });
    expect(normalized[2]).toMatchObject({ type: 'rest', duration: 'q' });
    expect(normalized[3].type).toBe('note');
  });

  it('deja coherentes la altura prima y la del acorde si discrepan', () => {
    // getItemPitches() ya prioriza `pitches`, así que la normalización alinea
    // `pitch` con `pitches[0]` en vez de dejar dos verdades distintas.
    const score = normalizeScore({
      staves: [
        {
          measures: [
            {
              items: [
                {
                  type: 'note',
                  duration: 'q',
                  pitch: { step: 'E', octave: 4 },
                  pitches: [{ step: 'G', octave: 4 }],
                },
              ],
            },
          ],
        },
      ],
    })!;

    expect(firstItem(score).pitches).toEqual([{ step: 'G', octave: 4, accidental: null }]);
    expect(firstItem(score).pitch).toEqual({ step: 'G', octave: 4, accidental: null });
  });

  it('descarta las alturas inválidas dentro de un acorde', () => {
    const score = normalizeScore({
      staves: [
        {
          measures: [
            {
              items: [
                {
                  type: 'note',
                  duration: 'q',
                  pitches: [
                    { step: 'C', octave: 4, accidental: '#' },
                    { step: 'inventado', octave: 4 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })!;

    expect(firstItem(score).pitches).toEqual([{ step: 'C', octave: 4, accidental: '#' }]);
    expect(firstItem(score).pitch).toEqual({ step: 'C', octave: 4, accidental: '#' });
    expect(firstItem(score).type).toBe('note');
  });

  it('acota la octava a un rango representable en MIDI', () => {
    const score = normalizeScore({
      staves: [
        {
          measures: [
            { items: [{ type: 'note', duration: 'q', pitch: { step: 'C', octave: 99 } }] },
          ],
        },
      ],
    })!;
    expect(firstItem(score).pitch!.octave).toBe(9);
  });

  it('garantiza al menos un item por compás y un compás por pentagrama', () => {
    const score = normalizeScore({
      staves: [{ measures: [{ items: [] }, { items: 'no' }] }, { measures: [] }],
    })!;

    expect(score.staves[0].measures).toHaveLength(2);
    expect(score.staves[0].measures[0].items).toHaveLength(1);
    expect(score.staves[0].measures[1].items).toHaveLength(1);
    expect(score.staves[1].measures).toHaveLength(1);
    expect(score.staves[1].measures[0].items[0].type).toBe('rest');
  });
});

describe('normalizeScore: ids', () => {
  it('regenera ids duplicados para que la selección no apunte a dos sitios', () => {
    const score = normalizeScore({
      staves: [
        {
          id: 'staff-1',
          measures: [
            { id: 'm-1', items: [{ id: 'item-1' }, { id: 'item-1' }] },
            { id: 'm-1', items: [] },
          ],
        },
      ],
    })!;

    const ids = [
      score.staves[0].id,
      ...score.staves[0].measures.map((m) => m.id),
      ...score.staves[0].measures.flatMap((m) => m.items.map((i) => i.id)),
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(score.staves[0].id).toBe('staff-1');
    expect(score.staves[0].measures[0].id).toBe('m-1');
    expect(score.staves[0].measures[0].items[0].id).toBe('item-1');
  });

  it('genera ids cuando faltan o están vacíos', () => {
    const score = normalizeScore({ staves: [{ measures: [{ items: [{ id: '  ' }] }] }] })!;

    expect(score.staves[0].id).toBeTruthy();
    expect(score.staves[0].measures[0].id).toBeTruthy();
    expect(firstItem(score).id).toBeTruthy();
    expect(firstItem(score).id.trim()).not.toBe('');
  });
});

describe('normalizeScore: migración del gran pentagrama', () => {
  it('marca la bandera cuando la partitura guardada solo tiene los nombres antiguos', () => {
    const score = normalizeScore({
      staves: [
        { name: 'Mano Derecha', clef: 'treble', measures: [] },
        { name: 'Mano Izquierda', clef: 'bass', measures: [] },
      ],
    })!;

    expect(score.isGrandStaff).toBe(true);
    expect(isPianoGrandStaff(score)).toBe(true);
    // La migración no reescribe los pentagramas.
    expect(score.staves[0].name).toBe('Mano Derecha');
    expect(score.staves[1].clef).toBe('bass');
  });

  it('respeta una partitura que ya trae la bandera', () => {
    const score = normalizeScore({
      isGrandStaff: true,
      staves: [
        { name: 'Piano', measures: [] },
        { name: 'Piano', measures: [] },
      ],
    })!;

    expect(score.isGrandStaff).toBe(true);
  });

  it('no marca la bandera en ensambles ni en pentagramas sueltos', () => {
    const ensemble = normalizeScore({
      staves: [
        { name: 'Mano Derecha', measures: [] },
        { name: 'Mano Izquierda', measures: [] },
        { name: 'Bajo', measures: [] },
      ],
    })!;
    expect(ensemble.isGrandStaff).toBeUndefined();
    expect(isPianoGrandStaff(ensemble)).toBe(false);

    const single = normalizeScore({ staves: [{ name: 'Mano Izquierda', measures: [] }] })!;
    expect(single.isGrandStaff).toBeUndefined();
  });

  it('conserva nombre y clave de un gran pentagrama con instrumento propio', () => {
    const score = normalizeScore({
      isGrandStaff: true,
      staves: [
        { name: 'Saxofón Alto', clef: 'treble', measures: [], transposition: 9 },
        { name: 'Saxofón Barítono', clef: 'bass', measures: [], transposition: -9 },
      ],
    })!;

    expect(score.staves[0].name).toBe('Saxofón Alto');
    expect(score.staves[0].clef).toBe('treble');
    expect(score.staves[0].transposition).toBe(9);
    expect(score.staves[1].transposition).toBe(-9);
  });
});
