import { describe, expect, it } from 'vitest';
import type { Score } from '../../types/music';
import type { MusicalReference } from '../../../scripts/omr-reference-check';
import {
  aggregateMetricsByCategory,
  alignSequences,
  evaluateAgainstReference,
} from '../../../scripts/omr-metrics';

function baseReference(): MusicalReference & { clef: string } {
  return {
    version: 1,
    id: 'synthetic-metrics-ref',
    clef: 'F4',
    source: {
      sha256: 'a'.repeat(64),
      raster: { width: 800, height: 400 },
    },
    timeSignature: [3, 4],
    review: {
      visualPasses: 2,
      audition: true,
      approved: true,
      pending: [],
    },
    systems: [
      {
        number: 1,
        page: 1,
        measures: [
          {
            index: 0,
            number: 1,
            printedNumber: null,
            events: [
              {
                id: 'r-1',
                pitch: 'C3',
                accidental: null,
                duration: [1, 4],
                dots: 0,
                position: [100, 100],
              },
              {
                id: 'r-2',
                pitch: 'D3',
                accidental: null,
                duration: [1, 4],
                dots: 0,
                position: [200, 100],
              },
              {
                id: 'r-3',
                pitch: 'E3',
                accidental: '#',
                duration: [1, 4],
                dots: 0,
                position: [300, 100],
              },
            ],
          },
          {
            index: 1,
            number: 2,
            printedNumber: null,
            timeSignature: [4, 4],
            events: [
              {
                id: 'r-4',
                pitch: 'G3',
                accidental: null,
                duration: [1, 2],
                dots: 0,
                position: [450, 100],
                tieTo: 'r-5',
              },
              {
                id: 'r-5',
                pitch: 'G3',
                accidental: null,
                duration: [1, 2],
                dots: 0,
                position: [600, 100],
              },
            ],
          },
        ],
      },
    ],
    directions: [
      { id: 'tempo-1', kind: 'tempo', measure: 1 },
      { id: 'segno-1', kind: 'segno', measure: 1 },
    ],
  };
}

function perfectScore(): Score {
  return {
    id: 'score-test',
    title: 'Test',
    composer: 'Test',
    tempo: 120,
    timeSignature: { beats: 3, beatType: 4 },
    keySignature: 'C',
    createdAt: 1,
    updatedAt: 1,
    staves: [
      {
        id: 'st-1',
        name: 'Bajo',
        clef: 'bass',
        measures: [
          {
            id: 'm-1',
            items: [
              {
                id: 'n-1',
                type: 'note',
                duration: 'q',
                pitch: { step: 'C', octave: 3, accidental: null },
              },
              {
                id: 'n-2',
                type: 'note',
                duration: 'q',
                pitch: { step: 'D', octave: 3, accidental: null },
              },
              {
                id: 'n-3',
                type: 'note',
                duration: 'q',
                pitch: { step: 'E', octave: 3, accidental: '#' },
              },
            ],
          },
          {
            id: 'm-2',
            timeSignatureChange: { beats: 4, beatType: 4 },
            items: [
              {
                id: 'n-4',
                type: 'note',
                duration: 'h',
                isTied: true,
                pitch: { step: 'G', octave: 3, accidental: null },
              },
              {
                id: 'n-5',
                type: 'note',
                duration: 'h',
                pitch: { step: 'G', octave: 3, accidental: null },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('evaluador de métricas musicales y puertas OMR (F0.4)', () => {
  it('calcula distancia de edición exacta en casos artificiales con una omisión, una sustitución y una inserción conocidas', () => {
    const refTokens = ['4C', '4D', '4E#', '2G', '2G'];
    // Caso 1: una omisión ('4D' eliminada)
    const omission = alignSequences(refTokens, ['4C', '4E#', '2G', '2G'], (a, b) => a === b, {
      definition: 'Test omisión',
      denominator: '5',
      sourceOfTruth: 'test',
    });
    expect(omission).toMatchObject({
      referenceCount: 5,
      predictedCount: 4,
      matches: 4,
      deletions: 1,
      substitutions: 0,
      insertions: 0,
      matchRate: 0.8,
      editErrorRate: 0.2,
    });

    // Caso 2: una sustitución ('4D' -> '4F')
    const substitution = alignSequences(
      refTokens,
      ['4C', '4F', '4E#', '2G', '2G'],
      (a, b) => a === b,
      {
        definition: 'Test sustitución',
        denominator: '5',
        sourceOfTruth: 'test',
      }
    );
    expect(substitution).toMatchObject({
      referenceCount: 5,
      predictedCount: 5,
      matches: 4,
      deletions: 0,
      substitutions: 1,
      insertions: 0,
      matchRate: 0.8,
      editErrorRate: 0.2,
    });

    // Caso 3: una inserción ('4A' añadida al final)
    const insertion = alignSequences(
      refTokens,
      ['4C', '4D', '4E#', '2G', '2G', '4A'],
      (a, b) => a === b,
      {
        definition: 'Test inserción',
        denominator: '5',
        sourceOfTruth: 'test',
      }
    );
    expect(insertion).toMatchObject({
      referenceCount: 5,
      predictedCount: 6,
      matches: 5,
      deletions: 0,
      substitutions: 0,
      insertions: 1,
      matchRate: 1,
      editErrorRate: 0.2,
    });

    // Caso combinado: 1 omisión ('4D') + 1 sustitución ('4E#' -> '4E') + 1 inserción ('4B' al final)
    const combined = alignSequences(refTokens, ['4C', '4E', '2G', '2G', '4B'], (a, b) => a === b, {
      definition: 'Test combinado',
      denominator: '5',
      sourceOfTruth: 'test',
    });
    expect(combined).toMatchObject({
      referenceCount: 5,
      predictedCount: 5,
      matches: 3,
      deletions: 1,
      substitutions: 1,
      insertions: 1,
      matchRate: 0.6,
      editErrorRate: 0.6,
    });
  });

  it('separa explícitamente la confianza CTC de la exactitud y evalúa componentes musicales', () => {
    const ref = baseReference();
    const score = perfectScore();
    // Introducir 1 sustitución de altura en n-2 (D3 -> F3) y 1 omisión de ligadura en n-4
    score.staves[0].measures[0].items[1] = {
      id: 'n-2',
      type: 'note',
      duration: 'q',
      pitch: { step: 'F', octave: 3, accidental: null },
    };
    score.staves[0].measures[1].items[0].isTied = false;

    const report = evaluateAgainstReference({
      sampleId: 'test-f4',
      reference: ref,
      score,
      modelConfidence: 92,
      category: {
        clef: 'F4',
        condition: 'clean',
        sourceType: 'pdf-image',
        partition: 'validation',
      },
    });

    expect(report.confidenceVsAccuracy.confidenceIsAccuracy).toBe(false);
    expect(report.confidenceVsAccuracy.ctcConfidencePercent).toBe(92);
    expect(report.confidenceVsAccuracy.exactEventMatchRatePercent).toBe(60); // 3/5 eventos exactos
    expect(report.confidenceVsAccuracy.overconfidenceGapPercent).toBe(32);

    expect(report.components.pitch.matched).toBe(4);
    expect(report.components.exactDuration.matched).toBe(5);
    expect(report.components.printedAccidentalRecall.rate).toBe(1);
    expect(report.components.clef.rate).toBe(1);
    expect(report.components.meter.rate).toBe(1); // 3/4@1 y 4/4@2
    expect(report.components.relationships.matched).toBe(0);
    expect(report.targets.passedCleanEventTarget).toBe(false);
  });

  it('rechaza calcular exactitud oficial contra una referencia en borrador no aprobada', () => {
    const ref = baseReference();
    ref.review.approved = false;
    expect(() =>
      evaluateAgainstReference({
        sampleId: 'draft-check',
        reference: ref,
        score: perfectScore(),
      })
    ).toThrow(/aprobada/);
  });

  it('informa media y peor caso por categoría sin ocultar un fallo en Fa con un acierto en Sol', () => {
    const refF4 = baseReference();
    const badF4Score = perfectScore();
    badF4Score.staves[0].measures[0].items = [];
    badF4Score.staves[0].measures[1].items = [];

    const refG2 = { ...baseReference(), id: 'ref-g2', clef: 'G2' };
    const goodG2Score = perfectScore();
    goodG2Score.staves[0].clef = 'treble';

    const reportF4 = evaluateAgainstReference({
      sampleId: 'bass-fail',
      reference: refF4,
      score: badF4Score,
      category: {
        clef: 'F4',
        condition: 'clean',
        sourceType: 'pdf-image',
        partition: 'validation',
      },
    });
    const reportG2 = evaluateAgainstReference({
      sampleId: 'treble-pass',
      reference: refG2,
      score: goodG2Score,
      category: { clef: 'G2', condition: 'clean', sourceType: 'image', partition: 'validation' },
    });

    const breakdown = aggregateMetricsByCategory([reportF4, reportG2]);
    const f4Bucket = breakdown.find((b) => b.dimension === 'clef' && b.bucket === 'F4');
    const g2Bucket = breakdown.find((b) => b.dimension === 'clef' && b.bucket === 'G2');
    const cleanBucket = breakdown.find((b) => b.dimension === 'condition' && b.bucket === 'clean');

    expect(f4Bucket?.worstExactEventMatchRate).toBe(0);
    expect(f4Bucket?.worstSampleId).toBe('bass-fail');
    expect(g2Bucket?.meanExactEventMatchRate).toBe(1);
    expect(cleanBucket?.meanExactEventMatchRate).toBe(0.5);
    expect(cleanBucket?.worstExactEventMatchRate).toBe(0);
    expect(cleanBucket?.worstSampleId).toBe('bass-fail');
  });
});
