import { writeFileSync } from 'node:fs';
import { exportScoreToMusicXml } from '../src/utils/musicxml';
import type { Score } from '../src/types/music';

const score: Score = {
  id: 'f6',
  title: 'F6',
  composer: 'Composer',
  arranger: 'Arranger',
  copyright: '© Test',
  tempo: 120,
  timeSignature: { beats: 3, beatType: 4 },
  keySignature: 'C',
  createdAt: 0,
  updatedAt: 0,
  staves: [
    {
      id: 'part',
      name: 'Guitarrón',
      clef: 'bass',
      measures: [
        {
          id: 'm1',
          systemBreak: true,
          navigationMark: 'segno',
          items: [
            {
              id: 'n1',
              type: 'note',
              duration: 'h',
              isDotted: true,
              isTied: true,
              pitch: { step: 'C', octave: 3, accidental: null },
            },
          ],
        },
        {
          id: 'm2',
          timeSignatureChange: { beats: 4, beatType: 4 },
          meterGlyph: 'common',
          tempoBpm: 90,
          metronomeMark: { beatUnit: 'q', dots: 0, perMinute: 90 },
          metricEquivalence: { previousUnit: '8', previousDots: 0, nextUnit: 'q', nextDots: 0 },
          rehearsalMark: 'A',
          items: [
            {
              id: 'n2',
              type: 'note',
              duration: 'q',
              pitch: { step: 'C', octave: 3, accidental: null },
            },
            { id: 'r2', type: 'rest', duration: 'q', articulation: 'fermata' },
            {
              id: 'n3',
              type: 'note',
              duration: '32',
              isDotted: true,
              tuplet: { actual: 3, normal: 2 },
              pitch: { step: 'D', octave: 3, accidental: '#' },
            },
          ],
        },
        {
          id: 'm3',
          items: [
            {
              id: 'c1',
              type: 'note',
              duration: 'h',
              voice: 1,
              pitches: [
                { step: 'C', octave: 3, accidental: null },
                { step: 'E', octave: 3, accidental: null },
              ],
            },
            {
              id: 'n4',
              type: 'note',
              duration: 'h',
              voice: 1,
              pitch: { step: 'G', octave: 3, accidental: null },
            },
            { id: 'r3', type: 'rest', duration: 'w', voice: 2, isFullMeasureRest: true },
          ],
        },
      ],
    },
  ],
};
const outIndex = process.argv.indexOf('--out');
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error('Indica --out para el XML de prueba.');
writeFileSync(process.argv[outIndex + 1], exportScoreToMusicXml(score));
