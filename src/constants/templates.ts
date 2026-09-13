import { Score } from '../types/music';

export interface ScoreTemplate {
  id: string;
  name: string;
  description: string;
  score: Score;
}

export const TEMPLATES: ScoreTemplate[] = [
  {
    id: 'ode-to-joy',
    name: 'Himno a la Alegría (Beethoven)',
    description: 'Famosa melodía de la 9ª Sinfonía, ideal para iniciación y práctica melódica.',
    score: {
      id: 'template-ode-to-joy',
      title: 'Himno a la Alegría',
      composer: 'L. v. Beethoven',
      tempo: 116,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [{
        id: 'staff-1',
        name: 'Melodía',
        clef: 'treble',
        measures: [
          {
            id: 'm1',
            items: [
              { id: 'n1', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q', lyric: 'Es-' },
              { id: 'n2', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q', lyric: 'cu-' },
              { id: 'n3', type: 'note', pitch: { step: 'F', octave: 4, accidental: null }, duration: 'q', lyric: 'cha' },
              { id: 'n4', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q', lyric: 'her-' },
            ]
          },
          {
            id: 'm2',
            items: [
              { id: 'n5', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q', lyric: 'ma-' },
              { id: 'n6', type: 'note', pitch: { step: 'F', octave: 4, accidental: null }, duration: 'q', lyric: 'no' },
              { id: 'n7', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q', lyric: 'el' },
              { id: 'n8', type: 'note', pitch: { step: 'D', octave: 4, accidental: null }, duration: 'q', lyric: 'can-' },
            ]
          },
          {
            id: 'm3',
            items: [
              { id: 'n9', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q', lyric: 'to' },
              { id: 'n10', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q', lyric: 'de' },
              { id: 'n11', type: 'note', pitch: { step: 'D', octave: 4, accidental: null }, duration: 'q', lyric: 'a-' },
              { id: 'n12', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q', lyric: 'le-' },
            ]
          },
          {
            id: 'm4',
            items: [
              { id: 'n13', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q', isDotted: true, lyric: 'grí-' },
              { id: 'n14', type: 'note', pitch: { step: 'D', octave: 4, accidental: null }, duration: '8' },
              { id: 'n15', type: 'note', pitch: { step: 'D', octave: 4, accidental: null }, duration: 'h', lyric: 'a.' },
            ]
          }
        ]
      }],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    }
  },
  {
    id: 'c-major-exercise',
    name: 'Estudio de Solfeo: Escala y Arpegio',
    description: 'Ejercicio pedagógico de digitación y entonación en Do Mayor.',
    score: {
      id: 'template-solfege-c',
      title: 'Escala y Arpegio de Do Mayor',
      composer: 'Estudio Técnico',
      tempo: 100,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [{
        id: 'staff-1',
        name: 'Voz / Flauta',
        clef: 'treble',
        measures: [
          {
            id: 'm1',
            items: [
              { id: 's1', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q', lyric: 'Do' },
              { id: 's2', type: 'note', pitch: { step: 'D', octave: 4, accidental: null }, duration: 'q', lyric: 'Re' },
              { id: 's3', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q', lyric: 'Mi' },
              { id: 's4', type: 'note', pitch: { step: 'F', octave: 4, accidental: null }, duration: 'q', lyric: 'Fa' },
            ]
          },
          {
            id: 'm2',
            items: [
              { id: 's5', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q', lyric: 'Sol' },
              { id: 's6', type: 'note', pitch: { step: 'A', octave: 4, accidental: null }, duration: 'q', lyric: 'La' },
              { id: 's7', type: 'note', pitch: { step: 'B', octave: 4, accidental: null }, duration: 'q', lyric: 'Si' },
              { id: 's8', type: 'note', pitch: { step: 'C', octave: 5, accidental: null }, duration: 'q', lyric: 'Do' },
            ]
          },
          {
            id: 'm3',
            items: [
              { id: 's9', type: 'note', pitch: { step: 'C', octave: 5, accidental: null }, duration: 'q', lyric: 'Do' },
              { id: 's10', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q', lyric: 'Sol' },
              { id: 's11', type: 'note', pitch: { step: 'E', octave: 4, accidental: null }, duration: 'q', lyric: 'Mi' },
              { id: 's12', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'q', lyric: 'Do' },
            ]
          },
          {
            id: 'm4',
            items: [
              { id: 's13', type: 'note', pitch: { step: 'C', octave: 4, accidental: null }, duration: 'w', lyric: 'Fin.' }
            ]
          }
        ]
      }],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    }
  },
  {
    id: 'bach-minuet',
    name: 'Minueto en Sol (J. S. Bach)',
    description: 'Clásico del barroco en compás de 3/4 con armadura de Sol Mayor (Fa♯).',
    score: {
      id: 'template-bach-minuet',
      title: 'Minueto en Sol Mayor',
      composer: 'J. S. Bach (BWV Anh. 114)',
      tempo: 126,
      timeSignature: { beats: 3, beatType: 4 },
      keySignature: 'G',
      staves: [{
        id: 'staff-1',
        name: 'Clave de Sol',
        clef: 'treble',
        measures: [
          {
            id: 'm1',
            items: [
              { id: 'b1', type: 'note', pitch: { step: 'D', octave: 5, accidental: null }, duration: 'q' },
              { id: 'b2', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: '8' },
              { id: 'b3', type: 'note', pitch: { step: 'A', octave: 4, accidental: null }, duration: '8' },
              { id: 'b4', type: 'note', pitch: { step: 'B', octave: 4, accidental: null }, duration: '8' },
              { id: 'b5', type: 'note', pitch: { step: 'C', octave: 5, accidental: null }, duration: '8' },
            ]
          },
          {
            id: 'm2',
            items: [
              { id: 'b6', type: 'note', pitch: { step: 'D', octave: 5, accidental: null }, duration: 'q' },
              { id: 'b7', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q' },
              { id: 'b8', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q' },
            ]
          },
          {
            id: 'm3',
            items: [
              { id: 'b9', type: 'note', pitch: { step: 'E', octave: 5, accidental: null }, duration: 'q' },
              { id: 'b10', type: 'note', pitch: { step: 'C', octave: 5, accidental: null }, duration: '8' },
              { id: 'b11', type: 'note', pitch: { step: 'D', octave: 5, accidental: null }, duration: '8' },
              { id: 'b12', type: 'note', pitch: { step: 'E', octave: 5, accidental: null }, duration: '8' },
              { id: 'b13', type: 'note', pitch: { step: 'F', octave: 5, accidental: '#' }, duration: '8' },
            ]
          },
          {
            id: 'm4',
            items: [
              { id: 'b14', type: 'note', pitch: { step: 'G', octave: 5, accidental: null }, duration: 'q' },
              { id: 'b15', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q' },
              { id: 'b16', type: 'note', pitch: { step: 'G', octave: 4, accidental: null }, duration: 'q' },
            ]
          }
        ]
      }],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    }
  },
  {
    id: 'blank-score',
    name: 'Partitura en Blanco (4 Compases)',
    description: 'Lienzo limpio preparado para componer desde cero en compás de 4/4.',
    score: {
      id: 'template-blank',
      title: 'Mi Nueva Composición',
      composer: 'Compositor',
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 'C',
      staves: [{
        id: 'staff-1',
        name: 'Voz / Instrumento',
        clef: 'treble',
        measures: [
          { id: 'bm1', items: [{ id: 'br1', type: 'rest', duration: 'w' }] },
          { id: 'bm2', items: [{ id: 'br2', type: 'rest', duration: 'w' }] },
          { id: 'bm3', items: [{ id: 'br3', type: 'rest', duration: 'w' }] },
          { id: 'bm4', items: [{ id: 'br4', type: 'rest', duration: 'w' }] }
        ]
      }],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    }
  }
];
