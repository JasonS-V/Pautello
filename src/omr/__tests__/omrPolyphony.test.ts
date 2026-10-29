import { describe, expect, it } from 'vitest';
import { assembleIR, lineFragment, OmrDecodedLine } from '../omrDecode';
import { convertOmrIrToScore } from '../omrToScore';
import { getItemPitches, Score } from '../../types/music';
import { exportScoreToMusicXml, importMusicXmlToScore } from '../../utils/musicxml';
import { buildPlaybackPlan, collectPerformedNotes } from '../../audio/playbackPlan';
import { getMeasureItemStreamTimings } from '../../utils/measureTiming';
import { assignPartIdentities } from '../omrParts';
import { parseChordToMidi } from '../../utils/chordUtils';

function line(tokens: string[], page = 1, system = 0, staffIndex = 0): OmrDecodedLine {
  const staff = {
    page,
    system,
    staffIndex,
    bbox: [0, 40, 1200, 100] as [number, number, number, number],
    lineSpacingPx: 10,
    normSpacing: 10,
  };
  return {
    staff,
    elements: lineFragment(
      tokens.map((token, i) => ({ token, f0: i * 2, f1: i * 2 + 1, confidence: 0.95 })),
      staff
    ),
  };
}

describe('F8.2: Notación polifónica — Acordes (F8.2a) y Dos Voces (F8.2b)', () => {
  describe('F8.2a: Acordes simultáneos y relaciones por altura', () => {
    it('decodifica acordes con múltiples alturas y alteraciones independientes', () => {
      // Acorde de Do sostenido mayor (C#4, E4, G#4) en una negra
      const decoded = line([
        '*clefG2',
        '<b>',
        '*M4/4',
        '<b>',
        '4',
        'c',
        '#',
        'e',
        'g',
        '#',
        '<b>',
        '==',
      ]);
      const ir = assembleIR([decoded]);
      const noteEvent = ir.parts[0].measures[0].events[0];

      expect(noteEvent.kind).toBe('note');
      if (noteEvent.kind === 'note') {
        expect(noteEvent.pitches).toHaveLength(3);
        expect(noteEvent.pitches).toMatchObject([
          { step: 'C', octave: 4, alter: 1, rawToken: '#' },
          { step: 'E', octave: 4, alter: 0 },
          { step: 'G', octave: 4, alter: 1, rawToken: '#' },
        ]);
      }

      const { score } = convertOmrIrToScore(ir);
      const scoreItem = score.staves[0].measures[0].items[0];
      expect(scoreItem.type).toBe('note');
      expect(scoreItem.duration).toBe('q');

      const pitches = getItemPitches(scoreItem);
      expect(pitches).toHaveLength(3);
      expect(pitches).toEqual([
        { step: 'C', octave: 4, accidental: '#' },
        { step: 'E', octave: 4, accidental: null },
        { step: 'G', octave: 4, accidental: '#' },
      ]);
    });

    it('soporta tokens compuestos kern con espacios y duraciones unificadas', () => {
      // Acorde representado en estándar kern con sub-tokens con espacio
      const decoded = line(['*clefG2', '<b>', '*M4/4', '<b>', '4c# 4e 4g#', '<b>', '==']);
      const ir = assembleIR([decoded]);
      const { score } = convertOmrIrToScore(ir);
      const scoreItem = score.staves[0].measures[0].items[0];

      expect(scoreItem.type).toBe('note');
      const pitches = getItemPitches(scoreItem);
      expect(pitches).toHaveLength(3);
      expect(pitches[0]).toEqual({ step: 'C', octave: 4, accidental: '#' });
      expect(pitches[1]).toEqual({ step: 'E', octave: 4, accidental: null });
      expect(pitches[2]).toEqual({ step: 'G', octave: 4, accidental: '#' });
    });

    it('conserva ligadura completa en acordes cuando todas las alturas coinciden y tienen ligadura explícita', () => {
      // Dos acordes C4+E4 ligados completamente
      const decoded = line([
        '*clefG2',
        '<b>',
        '*M4/4',
        '<b>',
        '[',
        'c',
        '[',
        'e',
        '4',
        '<b>',
        ']',
        'c',
        ']',
        'e',
        '4',
        '<b>',
        '==',
      ]);
      const ir = assembleIR([decoded]);
      const { score, warnings } = convertOmrIrToScore(ir);

      const item1 = score.staves[0].measures[0].items[0];
      const item2 = score.staves[0].measures[0].items[1];

      expect(item1.isTied).toBe(true);
      expect(item2.isTied).toBeUndefined();
      expect(warnings.some((w) => w.code === 'invalid-tie')).toBe(false);
    });

    it('detecta ligadura parcial en acorde y no la extiende silenciosamente a notas no ligadas', () => {
      // C4+E4 seguido de C4+G4: solo C4 coincide, E4 no continúa
      const decoded = line([
        '*clefG2',
        '<b>',
        '*M4/4',
        '<b>',
        '[',
        'c',
        '[',
        'e',
        '4',
        '<b>',
        'c',
        'g',
        '4',
        '<b>',
        '==',
      ]);
      const ir = assembleIR([decoded]);
      const { score, warnings } = convertOmrIrToScore(ir);

      const item1 = score.staves[0].measures[0].items[0];
      // La ligadura en el score se anula porque ScoreItem representa ligadura de todo el item
      expect(item1.isTied).toBeUndefined();
      // Se emite aviso explícito de ligadura parcial
      const tieWarning = warnings.find((w) => w.code === 'invalid-tie');
      expect(tieWarning).toBeDefined();
      expect(tieWarning?.message).toContain('Ligadura parcial en acorde detectada');
    });

    it('exporta e importa acordes y ligaduras en MusicXML 4.0 sin perder simultaneidad', () => {
      const decoded = line([
        '*clefG2',
        '<b>',
        '*M4/4',
        '<b>',
        '[',
        'c',
        '[',
        'e',
        '4',
        '<b>',
        ']',
        'c',
        ']',
        'e',
        '4',
        '<b>',
        '==',
      ]);
      const ir = assembleIR([decoded]);
      const { score } = convertOmrIrToScore(ir);

      const xml = exportScoreToMusicXml(score);
      expect(xml).toContain('<chord/>');
      expect(xml).toContain('<tie type="start"/>');
      expect(xml).toContain('<tie type="stop"/>');

      const reimported = importMusicXmlToScore(xml);
      expect(reimported.staves[0].measures[0].items).toHaveLength(2);

      const item1 = reimported.staves[0].measures[0].items[0];
      const item2 = reimported.staves[0].measures[0].items[1];

      expect(getItemPitches(item1)).toHaveLength(2);
      expect(getItemPitches(item2)).toHaveLength(2);
      expect(item1.isTied).toBe(true);
    });

    it('genera ataques simultáneos en el plan de reproducción de audio para todas las notas del acorde', () => {
      const decoded = line([
        '*clefG2',
        '<b>',
        '*M4/4',
        '<b>',
        '4',
        'c',
        'e',
        'g',
        '<b>',
        '4',
        'd',
        'f',
        'a',
        '<b>',
        '==',
      ]);
      const ir = assembleIR([decoded]);
      const { score } = convertOmrIrToScore(ir);

      const plan = buildPlaybackPlan(score);
      const notes = collectPerformedNotes(score, plan);
      // 2 acordes de 3 notas = 6 notas interpretadas
      expect(notes).toHaveLength(6);

      // Las 3 notas del primer acorde (C4=60, E4=64, G4=67) comparten startBeat 0
      const chord1 = notes.slice(0, 3);
      expect(chord1.map((n) => n.pitch)).toEqual([60, 64, 67]);
      expect(chord1.every((n) => n.startBeat === 0)).toBe(true);
      expect(chord1.every((n) => n.endBeat === 1)).toBe(true);

      // Las 3 notas del segundo acorde (D4=62, F4=65, A4=69) comparten startBeat 1
      const chord2 = notes.slice(3, 6);
      expect(chord2.map((n) => n.pitch)).toEqual([62, 65, 69]);
      expect(chord2.every((n) => n.startBeat === 1)).toBe(true);
      expect(chord2.every((n) => n.endBeat === 2)).toBe(true);
    });
  });

  describe('F8.2b: Dos voces independientes en una pauta', () => {
    it('calcula tiempos independientes para Voz 1 y Voz 2 sin que un evento alargue la otra voz', () => {
      const mockScore: Score = {
        id: 'two-voices-test',
        title: 'Polifonía 2 Voces',
        composer: 'Test',
        tempo: 120,
        timeSignature: { beats: 4, beatType: 4 },
        keySignature: 'C',
        createdAt: 0,
        updatedAt: 0,
        staves: [
          {
            id: 'staff-1',
            name: 'Pauta 1',
            clef: 'treble',
            measures: [
              {
                id: 'm1',
                items: [
                  // Voz 1: dos blancas (2 beats + 2 beats = 4 beats)
                  {
                    id: 'v1-1',
                    type: 'note',
                    duration: 'h',
                    pitch: { step: 'G', octave: 4, accidental: null },
                    voice: 1,
                  },
                  {
                    id: 'v1-2',
                    type: 'note',
                    duration: 'h',
                    pitch: { step: 'A', octave: 4, accidental: null },
                    voice: 1,
                  },
                  // Voz 2: cuatro negras (1 + 1 + 1 + 1 = 4 beats)
                  {
                    id: 'v2-1',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'C', octave: 4, accidental: null },
                    voice: 2,
                  },
                  {
                    id: 'v2-2',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'D', octave: 4, accidental: null },
                    voice: 2,
                  },
                  {
                    id: 'v2-3',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'E', octave: 4, accidental: null },
                    voice: 2,
                  },
                  {
                    id: 'v2-4',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'F', octave: 4, accidental: null },
                    voice: 2,
                  },
                ],
              },
            ],
          },
        ],
      };

      const timings = getMeasureItemStreamTimings(mockScore.staves[0].measures[0].items, 4);

      // Voz 1: inicia en 0 y 2
      const v1Timings = timings.filter((t) => t.item.voice === 1);
      expect(v1Timings[0].startBeat).toBe(0);
      expect(v1Timings[0].durationBeats).toBe(2);
      expect(v1Timings[1].startBeat).toBe(2);
      expect(v1Timings[1].durationBeats).toBe(2);

      // Voz 2: inicia en 0, 1, 2, 3 de forma totalmente independiente
      const v2Timings = timings.filter((t) => t.item.voice === 2);
      expect(v2Timings[0].startBeat).toBe(0);
      expect(v2Timings[0].durationBeats).toBe(1);
      expect(v2Timings[1].startBeat).toBe(1);
      expect(v2Timings[1].durationBeats).toBe(1);
      expect(v2Timings[2].startBeat).toBe(2);
      expect(v2Timings[2].durationBeats).toBe(1);
      expect(v2Timings[3].startBeat).toBe(3);
      expect(v2Timings[3].durationBeats).toBe(1);
    });

    it('exporta dos voces a MusicXML con etiqueta backup y división adecuada', () => {
      const mockScore: Score = {
        id: 'two-voices-xml',
        title: 'Dos Voces XML',
        composer: 'Test',
        tempo: 120,
        timeSignature: { beats: 4, beatType: 4 },
        keySignature: 'C',
        createdAt: 0,
        updatedAt: 0,
        staves: [
          {
            id: 'staff-1',
            name: 'Pauta 1',
            clef: 'treble',
            measures: [
              {
                id: 'm1',
                items: [
                  {
                    id: 'v1-1',
                    type: 'note',
                    duration: 'h',
                    pitch: { step: 'E', octave: 5, accidental: null },
                    voice: 1,
                  },
                  {
                    id: 'v1-2',
                    type: 'note',
                    duration: 'h',
                    pitch: { step: 'E', octave: 5, accidental: null },
                    voice: 1,
                  },
                  {
                    id: 'v2-1',
                    type: 'note',
                    duration: 'w',
                    pitch: { step: 'C', octave: 4, accidental: null },
                    voice: 2,
                  },
                ],
              },
            ],
          },
        ],
      };

      const xml = exportScoreToMusicXml(mockScore);
      expect(xml).toContain('<voice>1</voice>');
      expect(xml).toContain('<backup>');
      expect(xml).toContain('<voice>2</voice>');

      const reimported = importMusicXmlToScore(xml);
      const items = reimported.staves[0].measures[0].items;
      expect(items.some((it) => it.voice === 1)).toBe(true);
      expect(items.some((it) => it.voice === 2)).toBe(true);
    });

    it('asigna simultaneidad polifónica precisa en la interpretación sonora', () => {
      const mockScore: Score = {
        id: 'two-voices-audio',
        title: 'Audio 2 Voces',
        composer: 'Test',
        tempo: 60, // 1 beat = 1 segundo
        timeSignature: { beats: 4, beatType: 4 },
        keySignature: 'C',
        createdAt: 0,
        updatedAt: 0,
        staves: [
          {
            id: 'staff-1',
            name: 'Pauta 1',
            clef: 'treble',
            measures: [
              {
                id: 'm1',
                items: [
                  {
                    id: 'v1-1',
                    type: 'note',
                    duration: 'h',
                    pitch: { step: 'G', octave: 4, accidental: null },
                    voice: 1,
                  }, // 67
                  {
                    id: 'v1-2',
                    type: 'note',
                    duration: 'h',
                    pitch: { step: 'A', octave: 4, accidental: null },
                    voice: 1,
                  }, // 69
                  {
                    id: 'v2-1',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'C', octave: 4, accidental: null },
                    voice: 2,
                  }, // 60
                  {
                    id: 'v2-2',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'D', octave: 4, accidental: null },
                    voice: 2,
                  }, // 62
                  {
                    id: 'v2-3',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'E', octave: 4, accidental: null },
                    voice: 2,
                  }, // 64
                  {
                    id: 'v2-4',
                    type: 'note',
                    duration: 'q',
                    pitch: { step: 'F', octave: 4, accidental: null },
                    voice: 2,
                  }, // 65
                ],
              },
            ],
          },
        ],
      };

      const plan = buildPlaybackPlan(mockScore);
      const notes = collectPerformedNotes(mockScore, plan);
      expect(notes).toHaveLength(6);

      // En el segundo 0 atacan simultáneamente V1 (G4) y V2 (C4)
      const at0 = notes.filter((n) => Math.abs(n.startSeconds - 0) < 0.001);
      expect(at0.map((n) => n.pitch).sort((a, b) => a - b)).toEqual([60, 67]);

      // En el segundo 1 solo ataca V2 (D4), mientras V1 (G4) sigue sonando hasta segundo 2
      const at1 = notes.filter((n) => Math.abs(n.startSeconds - 1) < 0.001);
      expect(at1.map((n) => n.pitch)).toEqual([62]);

      // En el segundo 2 atacan simultáneamente V1 (A4) y V2 (E4)
      const at2 = notes.filter((n) => Math.abs(n.startSeconds - 2) < 0.001);
      expect(at2.map((n) => n.pitch).sort((a, b) => a - b)).toEqual([64, 69]);
    });
  });

  describe('F8.2c: Piano y ensamble con continuidad entre páginas y pautas ocultas', () => {
    it('asigna identidad de Gran Pentagrama a dos pautas con indicación de piano', () => {
      const decodedL1 = line(['*clefG2', '<b>', '*M4/4', '<b>', '1', 'c', '<b>', '=='], 1, 0, 0);
      const decodedL2 = line(['*clefF4', '<b>', '*M4/4', '<b>', '1', 'C', '<b>', '=='], 1, 0, 1);
      decodedL1.staff.partLabel = 'Piano (Mano Derecha)';
      decodedL2.staff.partLabel = 'Piano (Mano Izquierda)';

      const ir = assembleIR([decodedL1, decodedL2]);
      const { score } = convertOmrIrToScore(ir, { partName: 'Piano', isGrandStaff: true });

      expect(score.staves).toHaveLength(2);
      expect(score.isGrandStaff).toBe(true);
      expect(score.staves[0].clef).toBe('treble');
      expect(score.staves[1].clef).toBe('bass');
    });

    it('conserva continuidad de parte cuando un sistema oculta una pauta (tacet)', () => {
      // Sistema 0: 3 pautas (Violín 1, Violín 2, Cello)
      const s0p0 = line(['*clefG2', '<b>', '1', 'c', '<b>', '=='], 1, 0, 0);
      s0p0.staff.partLabel = 'Violin 1';
      const s0p1 = line(['*clefG2', '<b>', '1', 'e', '<b>', '=='], 1, 0, 1);
      s0p1.staff.partLabel = 'Violin 2';
      const s0p2 = line(['*clefF4', '<b>', '1', 'C', '<b>', '=='], 1, 0, 2);
      s0p2.staff.partLabel = 'Cello';

      // Sistema 1: 2 pautas (Violín 1 y Cello; Violín 2 está tacet / oculta)
      const s1p0 = line(['*clefG2', '<b>', '1', 'd', '<b>', '=='], 1, 1, 0);
      s1p0.staff.partLabel = 'Violin 1';
      const s1p2 = line(['*clefF4', '<b>', '1', 'D', '<b>', '=='], 1, 1, 1);
      s1p2.staff.partLabel = 'Cello';

      const assigned = assignPartIdentities([s0p0, s0p1, s0p2, s1p0, s1p2]);

      const s1Assigned = assigned.filter((l) => l.staff.system === 1);
      expect(s1Assigned).toHaveLength(2);
      // Violín 1 conserva partIndex 0
      expect(s1Assigned[0].staff.partIndex).toBe(0);
      // Cello conserva partIndex 2 a pesar de estar en la segunda posición física
      expect(s1Assigned[1].staff.partIndex).toBe(2);
    });
  });

  describe('F8.2d: Figuras, tuplets y claves adicionales', () => {
    it('retiene figuras no estándar o doble puntillo en el IR con aviso explícito sin corromper el compás', () => {
      // Breve ("0") o doble puntillo ("4..") no son degradadas silenciosamente
      const decoded = line(['*clefG2', '<b>', '*M4/4', '<b>', '4..', 'c', '<b>', '==']);
      const ir = assembleIR([decoded]);
      const { score, warnings } = convertOmrIrToScore(ir);

      // Evento no representable sin pérdida se retiene en el IR
      expect(warnings.some((w) => w.code === 'unsupported-event')).toBe(true);
      // El IR conserva el token original exacto
      expect(ir.parts[0].measures[0].events[0].tokens).toContain('4..');
      // No inventa notas arbitrarias en el Score
      expect(score.staves[0].measures[0].items.filter((it) => it.type === 'note')).toHaveLength(0);
    });

    it('conserva y exporta tresillos y tuplets con duraciones exactas a MusicXML', () => {
      // 3 corcheas en tresillo (duración base 6 = 48/6 * 4 = corchea de tresillo)
      const decoded = line([
        '*clefG2',
        '<b>',
        '*M4/4',
        '<b>',
        '6',
        'c',
        '<b>',
        '6',
        'd',
        '<b>',
        '6',
        'e',
        '<b>',
        '==',
      ]);
      const ir = assembleIR([decoded]);
      const { score } = convertOmrIrToScore(ir);

      const items = score.staves[0].measures[0].items;
      expect(items).toHaveLength(3);
      expect(items.every((it) => it.tuplet?.actual === 3 && it.tuplet.normal === 2)).toBe(true);

      const xml = exportScoreToMusicXml(score);
      expect(xml).toContain('<actual-notes>3</actual-notes>');
      expect(xml).toContain('<normal-notes>2</normal-notes>');
    });
  });

  describe('F8.2e: Cifrado armónico, texto lírico y tablaturas como extensiones independientes', () => {
    it('mantiene texto no anclado de forma no destructiva con advertencia unanchored-text', () => {
      const decoded = line(['*clefG2', '<b>', '*M4/4', '<b>', '4', 'c', '<b>', '==']);
      const ir = assembleIR([decoded]);
      const { warnings } = convertOmrIrToScore(ir, {
        lyrics: ['Canto libre sin alineación temporal'],
        chords: ['Cmaj7', 'G7'],
      });

      expect(warnings.some((w) => w.code === 'unanchored-text')).toBe(true);
      const w = warnings.find((entry) => entry.code === 'unanchored-text');
      expect(w?.provenance).toBe('unsupported');
    });

    it('decodifica cifrados armónicos a notas MIDI sin alterar la notación tradicional', () => {
      // "Cmaj7" -> [48, 52, 55, 59]
      expect(parseChordToMidi('Cmaj7', 3)).toEqual([48, 52, 55, 59]);
      // "G7" -> [55, 59, 62, 65]
      expect(parseChordToMidi('G7', 3)).toEqual([55, 59, 62, 65]);
    });
  });
});
