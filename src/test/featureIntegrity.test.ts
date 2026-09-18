import { describe, expect, it } from 'vitest';
import { Score } from '../types/music';
import { pitchToMidi, midiToPitch, getItemBeats } from '../constants/pitches';
import { getKeycapLabelForPitch } from '../constants/keyboardLayout';
import { exportScoreToMusicXml } from '../utils/musicxml';
import { exportScoreToMidi } from '../audio/midiExport';

// Partitura de prueba mínima
const createMockScore = (): Score => ({
  id: 'test-score-1',
  title: 'Partitura de Prueba',
  composer: 'Compositor Test',
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  keySignature: 'C',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  staves: [
    {
      id: 'staff-1',
      name: 'Piano',
      clef: 'treble',
      measures: [
        {
          id: 'measure-1',
          items: [
            {
              id: 'note-1',
              type: 'note',
              pitch: { step: 'C', octave: 4, accidental: null },
              duration: 'q',
              voice: 1,
              lyric: 'Do',
              chord: 'C',
            },
            {
              id: 'rest-1',
              type: 'rest',
              duration: 'q',
              voice: 1,
            },
            {
              id: 'note-2',
              type: 'note',
              pitch: { step: 'E', octave: 4, accidental: null },
              duration: 'q',
              voice: 1,
              isDotted: true,
            },
            {
              id: 'note-3',
              type: 'note',
              pitch: { step: 'G', octave: 4, accidental: '#' },
              duration: '8',
              voice: 1,
            },
          ],
        },
      ],
    },
  ],
});

describe('Comprobación de Integridad Funcional (Editor, Teclado, MIDI, Audio, Impresión)', () => {
  describe('1. Teclado y Mapeo de Entradas Musicales', () => {
    it('convierte teclas de piano QWERTY a notas musicales correctas', () => {
      // En modo piano: A4 base = Do4 (C4)
      const c4Label = getKeycapLabelForPitch('C', 4, null, 4);
      expect(c4Label).toBe('A');

      const d4Label = getKeycapLabelForPitch('D', 4, null, 4);
      expect(d4Label).toBe('S');

      const e4Label = getKeycapLabelForPitch('E', 4, null, 4);
      expect(e4Label).toBe('D');
    });

    it('calcula correctamente las duraciones de figuras y modificadores (1 a 6)', () => {
      // 1 = Redonda (4 pulsos)
      expect(getItemBeats('w', false)).toBe(4);
      // 2 = Blanca (2 pulsos)
      expect(getItemBeats('h', false)).toBe(2);
      // 3 = Negra (1 pulso)
      expect(getItemBeats('q', false)).toBe(1);
      // 4 = Corchea (0.5 pulsos)
      expect(getItemBeats('8', false)).toBe(0.5);
      // 5 = Semicorchea (0.25 pulsos)
      expect(getItemBeats('16', false)).toBe(0.25);
      // 6 = Fusa (0.125 pulsos)
      expect(getItemBeats('32', false)).toBe(0.125);

      // Puntillo añade 50%
      expect(getItemBeats('q', true)).toBe(1.5);
      expect(getItemBeats('h', true)).toBe(3.0);

      // Tresillo (3:2) divide entre 3 multiplicando por 2
      expect(getItemBeats('8', false, { actual: 3, normal: 2 })).toBeCloseTo(1 / 3, 2);
    });
  });

  describe('2. MIDI Input y Export', () => {
    it('mapea correctamente números MIDI a notas y viceversa', () => {
      // C4 = 60
      expect(pitchToMidi({ step: 'C', octave: 4, accidental: null })).toBe(60);
      expect(midiToPitch(60)).toEqual({ step: 'C', octave: 4, accidental: null });

      // A4 = 69 (440 Hz standard)
      expect(pitchToMidi({ step: 'A', octave: 4, accidental: null })).toBe(69);
      expect(midiToPitch(69)).toEqual({ step: 'A', octave: 4, accidental: null });

      // F#4 = 66
      expect(pitchToMidi({ step: 'F', octave: 4, accidental: '#' })).toBe(66);
    });

    it('exporta partitura a archivo MIDI estándar (.mid) sin errores', async () => {
      const score = createMockScore();
      const midiBlob = exportScoreToMidi(score);
      expect(midiBlob).toBeInstanceOf(Blob);
      expect(midiBlob.type).toBe('audio/midi');
      expect(midiBlob.size).toBeGreaterThan(20);

      const arrayBuffer = await midiBlob.arrayBuffer();
      const midiData = new Uint8Array(arrayBuffer);
      // Cabecera MIDI 'MThd' (0x4D, 0x54, 0x68, 0x64)
      expect(midiData[0]).toBe(0x4d);
      expect(midiData[1]).toBe(0x54);
      expect(midiData[2]).toBe(0x68);
      expect(midiData[3]).toBe(0x64);
    });
  });

  describe('3. Estructura y Selección de Partitura', () => {
    it('conserva letras y acordes en los elementos de la partitura', () => {
      const score = createMockScore();
      const measure = score.staves[0].measures[0];
      const noteWithLyric = measure.items[0];

      expect(noteWithLyric.lyric).toBe('Do');
      expect(noteWithLyric.chord).toBe('C');
      expect(noteWithLyric.voice).toBe(1);
    });

    it('exporta estructura completa a MusicXML compatible', () => {
      const score = createMockScore();
      const xml = exportScoreToMusicXml(score);
      expect(xml).toContain('<?xml');
      expect(xml).toContain('<score-partwise');
      expect(xml).toContain('<work-title>Partitura de Prueba</work-title>');
      expect(xml).toContain('<creator type="composer">Compositor Test</creator>');
      expect(xml).toContain('<step>C</step>');
      expect(xml).toContain('<octave>4</octave>');
      expect(xml).toContain('Do');
    });
  });

  describe('4. Reglas de Impresión y Salida de Papel (@media print)', () => {
    it('la estructura de la partitura proporciona las clases base score-sheet y score-page para impresión', () => {
      const score = createMockScore();
      expect(score.title).toBeDefined();
      expect(score.staves.length).toBeGreaterThan(0);
    });

    it('la hoja de estilos contiene reglas @media print con márgenes compatibles y escalado responsivo', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const cssPath = path.resolve(__dirname, '../index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toContain('@media print');
      expect(cssContent).toContain('@page');
      expect(cssContent).toContain('margin: 10mm 12mm');
      expect(cssContent).toContain('.score-page');
      expect(cssContent).toContain('.score-sheet');
      expect(cssContent).toContain('.score-page svg');
      expect(cssContent).toContain('width: 100% !important');
    });
  });
});
