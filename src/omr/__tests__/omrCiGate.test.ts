import { describe, expect, it } from 'vitest';
import { assertOmrCiGate, assertOmrRobustnessGate } from '../../../scripts/omr-ci-gate';

const passing = {
  sample: 'pdmx-line-clean',
  variant: 'baseline',
  decoder: 'greedy',
  staves: 1,
  systems: 1,
  measures: 6,
  exact: 1,
  barMeasure: 1,
};

describe('puerta de reconocimiento OMR en CI', () => {
  it('acepta la inferencia real de la muestra pública', () => {
    expect(() => assertOmrCiGate([passing])).not.toThrow();
  });

  it('falla si falta una pauta, un compás o exactitud aunque haya confianza alta', () => {
    expect(() => assertOmrCiGate([{ ...passing, staves: 0 }])).toThrow(/pautas/);
    expect(() => assertOmrCiGate([{ ...passing, measures: 5 }])).toThrow(/compases/);
    expect(() => assertOmrCiGate([{ ...passing, exact: 0.99 }])).toThrow(/eventos/);
    expect(() => assertOmrCiGate([{ ...passing, barMeasure: 0.99 }])).toThrow(/barras/);
    expect(() => assertOmrCiGate([])).toThrow(/muestra pública/);
  });

  it('rechaza una condición de imagen ausente o peor que su mínimo publicado', () => {
    const rows = [
      passing,
      ...[
        ['low-contrast', 1, 1],
        ['rotated', 0.75, 0.33],
        ['jpeg-compressed', 1, 1],
        ['low-resolution', 1, 1],
        ['uneven-contrast', 0.3333, 0.33],
        ['broken-lines', 1, 1],
        ['stains', 1, 1],
        ['clipped-border', 0.25, 0.33],
        ['large-header', 1, 1],
        ['perspective', 0, 0],
      ].map(([suffix, exact, barMeasure]) => ({
        ...passing,
        sample: `pdmx-line-${suffix}`,
        exact: Number(exact),
        barMeasure: Number(barMeasure),
      })),
    ];
    expect(() => assertOmrRobustnessGate(rows)).not.toThrow();
    expect(() => assertOmrRobustnessGate(rows.slice(1))).toThrow(/pdmx-line-clean/);
    expect(() =>
      assertOmrRobustnessGate(
        rows.map((row) => (row.sample === 'pdmx-line-rotated' ? { ...row, exact: 0.5 } : row))
      )
    ).toThrow(/rotated.*eventos/);
  });
});
